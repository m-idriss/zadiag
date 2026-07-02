import { onAuthStateChanged, signInAnonymously, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { AppRepository } from './contracts';
import { getFirebaseServices, type FirebaseServices } from './firebaseClient';
import { defaultPlan, type AppState, type Locale, type MonitoringPlan, type Role, type VerificationEvent } from '../domain/models';
import { isFreshCapture } from '../domain/adherence';

const PREFERENCES_KEY = 'zadiag.preferences.v1';

interface UserProfile {
  familyId: string;
  role: Role;
  linkingCode?: string;
  notificationsEnabled?: boolean;
}
interface FamilyDocument {
  childName: string;
  linkingCode?: string;
  plan?: MonitoringPlan;
  members?: Record<string, string>;
}

const initialState = (): AppState => {
  const preferences = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}') as { locale?: Locale; role?: Role };
  return {
    locale: preferences.locale ?? 'en',
    notificationsEnabled: false,
    role: preferences.role,
    family: { linked: false, childLinked: false, childName: '', linkingCode: '', consented: false },
    plan: defaultPlan,
    events: [],
  };
};

const asEvent = (id: string, data: DocumentData): VerificationEvent => ({
  id,
  sessionId: String(data.sessionId),
  requestedAt: String(data.requestedAt),
  expiresAt: String(data.expiresAt),
  capturedAt: data.capturedAt ? String(data.capturedAt) : undefined,
  status: data.status,
  confidence: data.confidence,
  imageQuality: data.imageQuality,
  reason: data.reason,
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
  }

  async linkParent(childName: string) {
    const createFamily = httpsCallable<{ childName: string }, { familyId: string; code: string }>(this.services.functions, 'createFamily');
    const result = await createFamily({ childName });
    this.state.family.linkingCode = result.data.code;
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
    const requestCheckNow = httpsCallable<{ familyId: string }, void>(this.services.functions, 'requestCheckNow');
    try { await requestCheckNow({ familyId: this.state.family.id }); }
    catch (error) {
      if ((error as { code?: string }).code === 'functions/already-exists') throw new Error('active_check_exists');
      throw error;
    }
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

  async savePlan(plan: MonitoringPlan) {
    if (!this.state.family.id || this.state.role !== 'parent') throw new Error('permission_denied');
    const updatePlan = httpsCallable<{ familyId: string; plan: MonitoringPlan }, void>(this.services.functions, 'updatePlan');
    await updatePlan({ familyId: this.state.family.id, plan });
  }

  activeSession() {
    const now = Date.now();
    return this.state.events.find((event) => event.status === 'pending' && Date.parse(event.expiresAt) > now);
  }

  async submitCapture(sessionId: string, capturedAt: Date) {
    const familyId = this.state.family.id;
    const event = this.state.events.find((item) => item.sessionId === sessionId);
    if (!familyId || !event || !isFreshCapture(event, capturedAt)) throw new Error('invalid_or_replayed_capture');
    const eventRef = doc(this.services.db, 'families', familyId, 'checks', event.id);
    await runTransaction(this.services.db, async (transaction) => {
      const snapshot = await transaction.get(eventRef);
      if (!snapshot.exists() || snapshot.data().status !== 'pending') throw new Error('invalid_or_replayed_capture');
      transaction.update(eventRef, { status: 'analyzing', capturedAt: capturedAt.toISOString() });
    });
    const analyzeCheck = httpsCallable<{ familyId: string; checkId: string }, VerificationEvent>(this.services.functions, 'analyzeCheck');
    const result = await analyzeCheck({ familyId, checkId: event.id });
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
    await this.attachFamily(data.familyId, data.role);
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
    const familyRef = doc(this.services.db, 'families', familyId);
    this.remoteSubscriptions.push(onSnapshot(familyRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const family = snapshot.data() as FamilyDocument;
      const childLinked = Object.values(family.members ?? {}).some((memberRole) => memberRole === 'child');
      this.state.family.childName = family.childName;
      this.state.family.childLinked = childLinked;
      this.state.family.linkingCode = family.linkingCode ?? this.state.family.linkingCode;
      this.state.plan = family.plan ?? defaultPlan;
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

  private emit() { this.listeners.forEach((listener) => listener()); }
}
