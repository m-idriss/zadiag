import { onAuthStateChanged, signInAnonymously, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { AppRepository } from './contracts';
import { getFirebaseServices, type FirebaseServices } from './firebaseClient';
import {
  DEFAULT_ROUTINE_ID,
  type AppState,
  type Locale,
  type MonitoringPlan,
  type Role,
  type RoutineAssignment,
  type VerificationEvent,
} from '../domain/models';
import { isFreshCapture } from '../domain/adherence';

const PREFERENCES_KEY = 'zadiag.preferences.v1';

const browserLocale = (): Locale => navigator.language?.startsWith('fr') ? 'fr' : 'en';

interface UserProfile {
  familyId: string;
  role: Role;
  linkingCode?: string;
  parentRecoveryCode?: string;
  notificationsEnabled?: boolean;
}
interface FamilyDocument {
  childName: string;
  linkingCode?: string;
  parentRecoveryCode?: string;
  members?: Record<string, string>;
}

const initialState = (): AppState => {
  const preferences = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}') as { locale?: Locale; role?: Role };
  return {
    locale: preferences.locale ?? browserLocale(),
    notificationsEnabled: false,
    role: preferences.role,
    family: { linked: false, childLinked: false, childName: '', linkingCode: '', parentRecoveryCode: '', consented: false },
    routineAssignments: [],
    routinesLoaded: false,
    routinesError: false,
    events: [],
  };
};

const asEvent = (id: string, data: DocumentData): VerificationEvent => ({
  id,
  routineId: String(data.routineId ?? DEFAULT_ROUTINE_ID),
  sessionId: String(data.sessionId),
  requestedAt: String(data.requestedAt),
  expiresAt: String(data.expiresAt),
  capturedAt: data.capturedAt ? String(data.capturedAt) : undefined,
  status: data.status,
  analysisSource: data.analysisSource,
  confidence: data.confidence,
  imageQuality: data.imageQuality,
  reason: data.reason,
});

const asRoutineAssignment = (id: string, data: DocumentData): RoutineAssignment => ({
  id,
  routineId: String(data.routineId ?? id),
  routine: {
    id: String(data.routine?.id ?? data.routineId ?? id),
    name: String(data.routine?.name ?? ''),
    description: String(data.routine?.description ?? ''),
    instructions: data.routine?.instructions ? String(data.routine.instructions) : undefined,
    icon: data.routine?.icon ? String(data.routine.icon) : undefined,
    accentColor: data.routine?.accentColor ? String(data.routine.accentColor) : undefined,
    proofType: data.routine?.proofType ? String(data.routine.proofType) : undefined,
    responsibleName: data.routine?.responsibleName ? String(data.routine.responsibleName) : undefined,
    instructionSteps: Array.isArray(data.routine?.instructionSteps) ? data.routine.instructionSteps : undefined,
    translations: data.routine?.translations,
  },
  plan: data.plan as MonitoringPlan,
  status: data.status,
  assignedAt: String(data.assignedAt),
});

export class FirebaseRepository implements AppRepository {
  private readonly services: FirebaseServices = getFirebaseServices();
  private state = initialState();
  private listeners = new Set<() => void>();
  private remoteSubscriptions: Unsubscribe[] = [];
  private user?: User;

  snapshot() { return structuredClone(this.state); }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async initialize() {
    this.user = await new Promise<User>((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(this.services.auth, async (user) => {
        unsubscribe();
        if (user) resolve(user);
        else {
          try { resolve((await signInAnonymously(this.services.auth)).user); }
          catch (error) { reject(error); }
        }
      }, reject);
    });
    await this.restoreProfile();
  }

  async selectRole(role: Role) {
    this.state.role = role;
    this.persistPreferences();
    this.emit();
  }

  async setLocale(locale: Locale) {
    this.state.locale = locale;
    this.persistPreferences();
    this.emit();
    await this.syncPushSubscriptionLocale();
  }

  async linkParent(childName: string) {
    const createFamily = httpsCallable<{ childName: string }, { familyId: string; code: string; recoveryCode: string }>(this.services.functions, 'createFamily');
    const result = await createFamily({ childName });
    this.state.family.linkingCode = result.data.code;
    this.state.family.parentRecoveryCode = result.data.recoveryCode;
    await this.attachFamily(result.data.familyId, 'parent');
  }

  async recoverParent(code: string) {
    const recoverParent = httpsCallable<{ code: string }, { familyId: string; childName: string; recoveryCode: string }>(this.services.functions, 'recoverParent');
    const result = await recoverParent({ code: code.trim().toUpperCase() });
    this.state.family.parentRecoveryCode = result.data.recoveryCode;
    await this.attachFamily(result.data.familyId, 'parent');
  }

  async linkChild(code: string) {
    const joinFamily = httpsCallable<{ code: string }, { familyId: string }>(this.services.functions, 'joinFamily');
    const result = await joinFamily({ code: code.trim().toUpperCase() });
    await this.attachFamily(result.data.familyId, 'child');
  }

  async regenerateLinkCode() {
    if (!this.state.family.id || this.state.role !== 'parent') throw new Error('permission_denied');
    const regenerateLinkCode = httpsCallable<{ familyId: string }, { code: string }>(this.services.functions, 'regenerateLinkCode');
    const result = await regenerateLinkCode({ familyId: this.state.family.id });
    this.state.family.linkingCode = result.data.code;
    this.emit();
  }

  async requestCheckNow() {
    if (!this.state.family.id || this.state.role !== 'parent') throw new Error('permission_denied');
    const requestCheckNow = httpsCallable<{ familyId: string; routineId: string }, void>(this.services.functions, 'requestCheckNow');
    try { await requestCheckNow({ familyId: this.state.family.id, routineId: DEFAULT_ROUTINE_ID }); }
    catch (error) {
      if ((error as { code?: string }).code === 'functions/already-exists') throw new Error('active_check_exists');
      throw error;
    }
  }

  async updateRoutine(routineId: string, plan: MonitoringPlan) {
    if (!this.state.family.id || this.state.role !== 'parent') throw new Error('permission_denied');
    const updateRoutine = httpsCallable<{ familyId: string; routineId: string; plan: MonitoringPlan }, void>(this.services.functions, 'updateRoutineAssignment');
    try { await updateRoutine({ familyId: this.state.family.id, routineId, plan }); }
    catch (error) { throw error; }
  }

  async savePushSubscription(subscription: PushSubscriptionJSON) {
    if (!this.state.family.id || this.state.role !== 'child') throw new Error('permission_denied');
    const savePushSubscription = httpsCallable<{
      familyId: string;
      subscription: PushSubscriptionJSON;
      locale: Locale;
    }, void>(this.services.functions, 'savePushSubscription');
    await savePushSubscription({
      familyId: this.state.family.id,
      subscription,
      locale: this.state.locale,
    });
    this.state.notificationsEnabled = true;
    this.emit();
  }

  async savePlan(plan: MonitoringPlan, routineId = DEFAULT_ROUTINE_ID) {
    if (!this.state.family.id || this.state.role !== 'parent') throw new Error('permission_denied');
    const updatePlan = httpsCallable<{ familyId: string; routineId: string; plan: MonitoringPlan }, void>(this.services.functions, 'updatePlan');
    await updatePlan({ familyId: this.state.family.id, routineId, plan });
  }

  activeSession() {
    const now = Date.now();
    return this.state.events.find((event) => event.status === 'pending' && Date.parse(event.expiresAt) > now);
  }

  async submitCapture(sessionId: string, capturedAt: Date, imageDataUrl: string) {
    const familyId = this.state.family.id;
    const event = this.state.events.find((item) => item.sessionId === sessionId);
    if (!familyId || !event || !isFreshCapture(event, capturedAt)) throw new Error('invalid_or_replayed_capture');
    const analyzeCheck = httpsCallable<{
      familyId: string;
      checkId: string;
      capturedAt: string;
      imageDataUrl: string;
      locale: Locale;
    }, VerificationEvent>(this.services.functions, 'analyzeCheck');
    const result = await analyzeCheck({
      familyId,
      checkId: event.id,
      capturedAt: capturedAt.toISOString(),
      imageDataUrl,
      locale: this.state.locale,
    });
    this.state.events = this.state.events.map((item) => item.id === result.data.id ? result.data : item);
    this.emit();
    return result.data;
  }

  async reset() {
    this.remoteSubscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
    if (this.state.family.linked) {
      const deleteAccountData = httpsCallable<void, void>(this.services.functions, 'deleteAccountData');
      await deleteAccountData();
    }
    await signOut(this.services.auth);
    localStorage.removeItem(PREFERENCES_KEY);
    this.state = initialState();
    this.emit();
    await this.initialize();
  }

  private async restoreProfile() {
    if (!this.user) return;
    const profile = await getDoc(doc(this.services.db, 'users', this.user.uid));
    if (!profile.exists()) { this.emit(); return; }
    const data = profile.data() as UserProfile;
    this.state.notificationsEnabled = data.notificationsEnabled === true;
    this.state.family.linkingCode = data.linkingCode ?? '';
    this.state.family.parentRecoveryCode = data.parentRecoveryCode ?? '';
    await this.attachFamily(data.familyId, data.role);
    await this.syncPushSubscriptionLocale();
  }

  private async attachFamily(familyId: string, role: Role) {
    this.remoteSubscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
    this.state.role = role;
    this.state.family = {
      ...this.state.family,
      id: familyId,
      linked: true,
      childLinked: role === 'child',
      consented: role === 'parent',
    };
    if (role === 'parent') try {
      const ensureRecoveryCode = httpsCallable<{ familyId: string }, { recoveryCode: string }>(
        this.services.functions,
        'ensureParentRecoveryCode',
      );
      const recovery = await ensureRecoveryCode({ familyId });
      this.state.family.parentRecoveryCode = recovery.data.recoveryCode;
    } catch (error) {
      console.error('Unable to refresh the parent recovery code', error);
    }
    const migrateRoutines = httpsCallable<{ familyId: string }, void>(this.services.functions, 'migrateFamilyRoutines');
    try {
      await migrateRoutines({ familyId });
    } catch (error) {
      console.error('Unable to migrate family routines', error);
    }
    const familyRef = doc(this.services.db, 'families', familyId);
    this.remoteSubscriptions.push(onSnapshot(familyRef, async (snapshot) => {
      if (!snapshot.exists()) return;
      const family = snapshot.data() as FamilyDocument;
      const childLinked = Object.values(family.members ?? {}).some((memberRole) => memberRole === 'child');
      this.state.family.childName = family.childName;
      this.state.family.childLinked = childLinked;
      this.state.family.linkingCode = family.linkingCode ?? this.state.family.linkingCode;
      this.state.family.parentRecoveryCode = family.parentRecoveryCode ?? this.state.family.parentRecoveryCode;
      
      // For child role, fetch recovery code from parent profile
      if (role === 'child' && !this.state.family.parentRecoveryCode && family.members) {
        try {
          const parentUids = Object.entries(family.members)
            .filter(([, memberRole]) => memberRole === 'parent')
            .map(([uid]) => uid);
          
          if (parentUids.length > 0) {
            const parentProfile = await getDoc(doc(this.services.db, 'users', parentUids[0]));
            if (parentProfile.exists()) {
              const parentData = parentProfile.data();
              if (parentData?.parentRecoveryCode) {
                this.state.family.parentRecoveryCode = parentData.parentRecoveryCode;
                this.emit();
              }
            }
          }
        } catch (error) {
          console.error('Unable to fetch parent recovery code from profile', error);
        }
      } else {
        this.emit();
      }
    }));
    const assignments = query(collection(familyRef, 'routineAssignments'), orderBy('assignedAt', 'asc'));
    this.remoteSubscriptions.push(onSnapshot(assignments, (snapshot) => {
      this.state.routineAssignments = snapshot.docs.map((item) => asRoutineAssignment(item.id, item.data()));
      this.state.routinesLoaded = true;
      this.state.routinesError = false;
      this.emit();
    }, (error) => {
      console.error('Unable to load routine assignments', error);
      this.state.routinesLoaded = true;
      this.state.routinesError = true;
      this.emit();
    }));
    const checks = query(collection(familyRef, 'checks'), orderBy('requestedAt', 'desc'));
    this.remoteSubscriptions.push(onSnapshot(checks, (snapshot) => {
      this.state.events = snapshot.docs.map((item) => asEvent(item.id, item.data()));
      this.emit();
    }));
    this.persistPreferences();
    this.emit();
  }

  private persistPreferences() {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ locale: this.state.locale, role: this.state.role }));
  }

  private async syncPushSubscriptionLocale() {
    if (this.state.role !== 'child' || !this.user || !this.state.family.id || !this.state.notificationsEnabled) return;
    try {
      await updateDoc(doc(this.services.db, 'families', this.state.family.id, 'pushSubscriptions', this.user.uid), {
        locale: this.state.locale,
      });
    } catch (error) {
      console.error('Unable to update push subscription locale', error);
    }
  }

  private emit() { this.listeners.forEach((listener) => listener()); }
}
