import { onAuthStateChanged, signInAnonymously, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref as storageRef } from 'firebase/storage';
import type { AppRepository } from './contracts';
import { getFirebaseServices, type FirebaseServices } from './firebaseClient';
import {
  DEFAULT_ROUTINE_ID,
  normalizeAppPreferences,
  type AppPreferences,
  type Locale,
  type MonitoringPlan,
  type MembershipRole,
  type ParticipantAccess,
  type Role,
  type RoutineAssignment,
  type RoutineAssignmentCreator,
  type RoutineValidationMode,
  type VerificationEvent,
} from '../domain/models';
import { routineFromCatalog } from '../domain/routineCatalog';
import { isFreshCapture } from '../domain/adherence';
import { activeParticipantAccess } from '../domain/participantAccess';
import { initialRemoteState, PREFERENCES_KEY } from './appStateDefaults';
import { coalesceInFlight } from './idempotency';

interface UserProfile {
  familyId?: string;
  role?: Role;
  linkingCode?: string;
  parentRecoveryCode?: string;
  notificationsEnabled?: boolean;
}
interface ParticipantDocument {
  displayName?: string;
  userId?: string;
  status?: string;
}
interface PushSubscriptionDocument {
  endpoint?: string;
  lastSuccessfulSaveAt?: { toDate?: () => Date } | string;
  lastDispatchResult?: 'success' | 'failed' | 'invalidated';
  lastDispatchAt?: { toDate?: () => Date } | string;
  lastDispatchError?: string;
}
interface FamilyDocument {
  childName: string;
  linkingCode?: string;
  parentRecoveryCode?: string;
  members?: Record<string, string>;
  notificationPreferences?: Partial<Pick<AppPreferences, 'reminderRepeatMinutes'>>;
}

const asReviewStatus = (value: unknown): VerificationEvent['reviewStatus'] =>
  value === 'pending' || value === 'approved' || value === 'rejected' ? value : undefined;

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
  proofImagePath: data.proofImagePath ? String(data.proofImagePath) : undefined,
  proofImageExpiresAt: data.proofImageExpiresAt ? String(data.proofImageExpiresAt) : undefined,
  reviewStatus: asReviewStatus(data.reviewStatus),
  reviewedAt: data.reviewedAt ? String(data.reviewedAt) : undefined,
  reviewedBy: data.reviewedBy ? String(data.reviewedBy) : undefined,
  reviewReason: data.reviewReason ? String(data.reviewReason) : undefined,
});

const asRoutineAssignment = (id: string, data: DocumentData): RoutineAssignment => {
  const routineId = String(data.routineId ?? id);
  const catalogRoutine = routineFromCatalog(routineId);
  const createdBy = ['parent', 'child', 'system'].includes(String(data.createdBy)) ? String(data.createdBy) as RoutineAssignmentCreator : undefined;
  const validationMode = data.validationMode === 'auto' ? 'auto' : 'ai';
  return {
    id,
    routineId,
    routine: catalogRoutine ?? {
      id: String(data.routine?.id ?? routineId),
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
    createdBy,
    validationMode,
  };
};

export class FirebaseRepository implements AppRepository {
  private readonly services: FirebaseServices = getFirebaseServices();
  private state = initialRemoteState();
  private listeners = new Set<() => void>();
  private remoteSubscriptions: Unsubscribe[] = [];
  private inFlightCallables = new Map<string, Promise<unknown>>();
  private user?: User;
  private legacyFamilyId?: string;
  private legacyRole?: Role;

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

  async selectActiveParticipant(participantId: string) {
    const access = activeParticipantAccess(this.state.participantAccess, participantId);
    if (!access) throw new Error('participant_access_not_found');
    if (participantId === this.legacyFamilyId && this.legacyRole) {
      await this.attachFamily(participantId, this.legacyRole);
    } else {
      await this.attachParticipant(participantId, access.membership.role);
    }
  }

  async createParticipant(displayName: string, selfManaged = false) {
    const normalizedName = displayName.trim();
    const result = await coalesceInFlight(this.inFlightCallables, `createParticipant:${normalizedName}:${selfManaged}`, async () => {
      const createParticipant = httpsCallable<
        { displayName: string; selfManaged: boolean },
        { participantId: string }
      >(this.services.functions, 'createParticipant');
      return createParticipant({ displayName: normalizedName, selfManaged });
    });
    await this.loadParticipantAccess();
    const access = activeParticipantAccess(this.state.participantAccess, result.data.participantId);
    if (access) await this.attachParticipant(result.data.participantId, access.membership.role);
    return result.data.participantId;
  }

  async inviteParticipantMember(participantId: string, role: Exclude<MembershipRole, 'owner'>) {
    const createInvitation = httpsCallable<
      { participantId: string; role: Exclude<MembershipRole, 'owner'> },
      { code: string; expiresAt: string }
    >(this.services.functions, 'createRelationshipInvitation');
    const result = await createInvitation({ participantId, role });
    return result.data;
  }

  async acceptParticipantInvitation(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    const result = await coalesceInFlight(this.inFlightCallables, `acceptParticipantInvitation:${normalizedCode}`, async () => {
      const acceptInvitation = httpsCallable<{ code: string }, { participantId: string }>(
        this.services.functions,
        'acceptRelationshipInvitation',
      );
      return acceptInvitation({ code: normalizedCode });
    });
    await this.loadParticipantAccess();
    const access = activeParticipantAccess(this.state.participantAccess, result.data.participantId);
    if (access) await this.attachParticipant(result.data.participantId, access.membership.role);
    return result.data.participantId;
  }

  async leaveParticipant(participantId: string) {
    const removeMembership = httpsCallable<{ participantId: string }, void>(
      this.services.functions,
      'removeParticipantMembership',
    );
    try {
      await removeMembership({ participantId });
    } catch (error) {
      console.error('Unable to leave participant relationship', { participantId, error });
      throw error;
    }
    await this.loadParticipantAccess();
    const next = this.state.participantAccess?.find((entry) => entry.membership.status === 'active');
    if (next) await this.selectActiveParticipant(next.participant.id);
    else {
      this.remoteSubscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
      this.state = { ...initialRemoteState(), locale: this.state.locale, preferences: this.state.preferences };
      this.emit();
    }
  }

  async createRelationshipRecovery(participantId: string) {
    const createRecovery = httpsCallable<
      { participantId: string },
      { recoveryCode: string; expiresAt: string }
    >(this.services.functions, 'createRelationshipRecovery');
    return (await createRecovery({ participantId })).data;
  }

  async recoverRelationship(code: string) {
    const recover = httpsCallable<
      { code: string },
      { participantId: string; recoveryCode?: string; expiresAt?: string }
    >(this.services.functions, 'recoverRelationship');
    const result = await recover({ code: code.trim().toUpperCase() });
    await this.loadParticipantAccess();
    const access = activeParticipantAccess(this.state.participantAccess, result.data.participantId);
    if (access) await this.attachParticipant(result.data.participantId, access.membership.role);
    return result.data;
  }

  async setLocale(locale: Locale) {
    this.state.locale = locale;
    this.persistPreferences();
    this.emit();
    await this.syncPushSubscriptionLocale();
  }

  async setPreferences(preferences: Partial<AppPreferences>) {
    this.state.preferences = normalizeAppPreferences({ ...this.state.preferences, ...preferences });
    this.persistPreferences();
    this.emit();
    await this.syncPushSubscriptionPreferences();
    await this.syncFamilyNotificationPreferences();
  }

  async linkParent(childName: string) {
    const result = await coalesceInFlight(this.inFlightCallables, `createFamily:${childName.trim()}`, async () => {
      const createFamily = httpsCallable<{ childName: string }, { familyId: string; code: string; recoveryCode: string }>(this.services.functions, 'createFamily');
      return createFamily({ childName });
    });
    this.state.family.linkingCode = result.data.code;
    this.state.family.parentRecoveryCode = result.data.recoveryCode;
    await this.attachFamily(result.data.familyId, 'parent');
  }

  async recoverParent(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    const result = await coalesceInFlight(this.inFlightCallables, `recoverParent:${normalizedCode}`, async () => {
      const recoverParent = httpsCallable<{ code: string }, { familyId: string; childName: string; recoveryCode: string }>(this.services.functions, 'recoverParent');
      return recoverParent({ code: normalizedCode });
    });
    this.state.family.parentRecoveryCode = result.data.recoveryCode;
    await this.attachFamily(result.data.familyId, 'parent');
    this.state.family.childLinked = true;
    this.state.family.childName = result.data.childName;
    this.emit();
  }

  async linkChild(code: string) {
    const normalizedCode = code.trim().toUpperCase();
    const result = await coalesceInFlight(this.inFlightCallables, `joinFamily:${normalizedCode}`, async () => {
      const joinFamily = httpsCallable<{ code: string }, { familyId: string }>(this.services.functions, 'joinFamily');
      return joinFamily({ code: normalizedCode });
    });
    await this.attachFamily(result.data.familyId, 'child');
  }

  async regenerateLinkCode() {
    if (!this.state.family.id || this.state.role !== 'parent') throw new Error('permission_denied');
    const familyId = this.state.family.id;
    const result = await coalesceInFlight(this.inFlightCallables, `regenerateLinkCode:${familyId}`, async () => {
      const regenerateLinkCode = httpsCallable<{ familyId: string }, { code: string }>(this.services.functions, 'regenerateLinkCode');
      return regenerateLinkCode({ familyId });
    });
    this.state.family.linkingCode = result.data.code;
    this.emit();
  }

  async assignRoutine(routineId: string) {
    if (!this.state.family.id || this.state.role !== 'parent') throw new Error('permission_denied');
    const familyId = this.state.family.id;
    await coalesceInFlight(this.inFlightCallables, `assignRoutine:${familyId}:${routineId}`, async () => {
      const assignRoutine = httpsCallable<{ familyId: string; routineId: string }, void>(this.services.functions, 'assignRoutine');
      return assignRoutine({ familyId, routineId });
    });
  }

  async deleteRoutine(routineId: string) {
    if (!this.state.family.id || this.state.role !== 'parent') throw new Error('permission_denied');
    const familyId = this.state.family.id;
    await coalesceInFlight(this.inFlightCallables, `deleteRoutine:${familyId}:${routineId}`, async () => {
      const deleteRoutine = httpsCallable<{ familyId: string; routineId: string }, void>(this.services.functions, 'deleteRoutine');
      return deleteRoutine({ familyId, routineId });
    });
  }

  async requestCheckNow(routineId = DEFAULT_ROUTINE_ID) {
    if (!this.state.family.id || this.state.role !== 'parent') throw new Error('permission_denied');
    const familyId = this.state.family.id;
    try {
      await coalesceInFlight(this.inFlightCallables, `requestCheckNow:${familyId}:${routineId}`, async () => {
        const requestCheckNow = httpsCallable<{ familyId: string; routineId: string }, void>(this.services.functions, 'requestCheckNow');
        return requestCheckNow({ familyId, routineId });
      });
    }
    catch (error) {
      if ((error as { code?: string }).code === 'functions/already-exists') throw new Error('active_check_exists');
      throw error;
    }
  }

  async updateRoutine(routineId: string, plan: MonitoringPlan, validationMode?: RoutineValidationMode) {
    if (!this.state.family.id || this.state.role !== 'parent') throw new Error('permission_denied');
    const familyId = this.state.family.id;
    try {
      await coalesceInFlight(this.inFlightCallables, `updateRoutine:${familyId}:${routineId}`, async () => {
        const updateRoutine = httpsCallable<{ familyId: string; routineId: string; plan: MonitoringPlan; validationMode?: RoutineValidationMode }, void>(this.services.functions, 'updateRoutineAssignment');
        return updateRoutine({ familyId, routineId, plan, validationMode });
      });
    }
    catch (error) { throw error; }
  }

  async savePushSubscription(subscription: PushSubscriptionJSON) {
    if (!this.state.family.id || !['child', 'parent'].includes(String(this.state.role))) throw new Error('permission_denied');
    const savePushSubscription = httpsCallable<{
      familyId: string;
      subscription: PushSubscriptionJSON;
      locale: Locale;
      preferences: AppPreferences;
    }, void>(this.services.functions, 'savePushSubscription');
    await savePushSubscription({
      familyId: this.state.family.id,
      subscription,
      locale: this.state.locale,
      preferences: normalizeAppPreferences(this.state.preferences),
    });
    this.state.notificationsEnabled = true;
    this.state.pushHealth = {
      ...this.state.pushHealth,
      permission: 'Notification' in window ? Notification.permission : 'unsupported',
      endpointPresent: Boolean(subscription.endpoint),
      lastSuccessfulSaveAt: new Date().toISOString(),
    };
    this.emit();
  }

  async sendTestPushNotification() {
    if (!this.state.family.id || !['child', 'parent'].includes(String(this.state.role))) throw new Error('permission_denied');
    const familyId = this.state.family.id;
    await coalesceInFlight(this.inFlightCallables, `sendTestPushNotification:${familyId}:${this.user?.uid ?? 'anonymous'}`, async () => {
      const sendTestPushNotification = httpsCallable<{ familyId: string }, void>(this.services.functions, 'sendTestPushNotification');
      return sendTestPushNotification({ familyId });
    });
  }

  async savePlan(plan: MonitoringPlan, routineId = DEFAULT_ROUTINE_ID) {
    if (!this.state.family.id || this.state.role !== 'parent') throw new Error('permission_denied');
    const familyId = this.state.family.id;
    await coalesceInFlight(this.inFlightCallables, `savePlan:${familyId}:${routineId}`, async () => {
      const updatePlan = httpsCallable<{ familyId: string; routineId: string; plan: MonitoringPlan }, void>(this.services.functions, 'updatePlan');
      return updatePlan({ familyId, routineId, plan });
    });
  }

  activeSession(routineId?: string) {
    const now = Date.now();
    return this.state.events.find((event) => event.status === 'pending' && Date.parse(event.expiresAt) > now && (!routineId || event.routineId === routineId));
  }

  async submitCapture(sessionId: string, capturedAt: Date, imageDataUrl: string) {
    const familyId = this.state.family.id;
    const event = this.state.events.find((item) => item.sessionId === sessionId);
    if (!familyId || !event || !isFreshCapture(event, capturedAt)) throw new Error('invalid_or_replayed_capture');
    const capturedAtIso = capturedAt.toISOString();
    const result = await coalesceInFlight(this.inFlightCallables, `analyzeCheck:${familyId}:${event.id}:${capturedAtIso}`, async () => {
      const analyzeCheck = httpsCallable<{
        familyId: string;
        checkId: string;
        capturedAt: string;
        imageDataUrl: string;
        locale: Locale;
      }, VerificationEvent>(this.services.functions, 'analyzeCheck');
      return analyzeCheck({
        familyId,
        checkId: event.id,
        capturedAt: capturedAtIso,
        imageDataUrl,
        locale: this.state.locale,
      });
    });
    this.state.events = this.state.events.map((item) => item.id === result.data.id ? result.data : item);
    this.emit();
    return result.data;
  }

  async getProofImageUrl(eventId: string) {
    if (!this.state.family.id || this.state.role !== 'parent') throw new Error('permission_denied');
    const getProofImageUrl = httpsCallable<{ familyId: string; checkId: string }, { url: string }>(
      this.services.functions,
      'getProofImageUrl',
    );
    try {
      const result = await getProofImageUrl({ familyId: this.state.family.id, checkId: eventId });
      return result.data.url;
    } catch (error) {
      const event = this.state.events.find((item) => item.id === eventId);
      const candidatePaths = [
        ...(event?.proofImagePath ? [event.proofImagePath] : []),
        `families/${this.state.family.id}/checks/${eventId}/proof.jpg`,
        `families/${this.state.family.id}/checks/${eventId}/proof.png`,
        `families/${this.state.family.id}/checks/${eventId}/proof.webp`,
      ];
      for (const candidatePath of [...new Set(candidatePaths)]) {
        try {
          return await getDownloadURL(storageRef(this.services.storage, candidatePath));
        } catch {
          // Try the next known proof image extension.
        }
      }
      throw error;
    }
  }

  async reviewCheck(eventId: string, decision: 'detected' | 'not_detected') {
    if (!this.state.family.id || this.state.role !== 'parent') throw new Error('permission_denied');
    const familyId = this.state.family.id;
    const result = await coalesceInFlight(this.inFlightCallables, `reviewCheck:${familyId}:${eventId}:${decision}`, async () => {
      const reviewCheck = httpsCallable<{
        familyId: string;
        checkId: string;
        decision: 'detected' | 'not_detected';
      }, VerificationEvent>(this.services.functions, 'reviewCheck');
      return reviewCheck({ familyId, checkId: eventId, decision });
    });
    this.state.events = this.state.events.map((item) => item.id === result.data.id ? result.data : item);
    this.emit();
    return result.data;
  }

  async retryRemoteSync() {
    if (!this.state.family.id || !this.state.role) {
      await this.restoreProfile();
      return;
    }
    await this.attachFamily(this.state.family.id, this.state.role);
  }

  async reset() {
    await coalesceInFlight(this.inFlightCallables, `reset:${this.user?.uid ?? 'anonymous'}`, async () => this.resetOnce());
  }

  private async resetOnce() {
    this.remoteSubscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
    if (this.state.family.linked) {
      const deleteAccountData = httpsCallable<void, void>(this.services.functions, 'deleteAccountData');
      try {
        await deleteAccountData();
      } catch (error) {
        // Account cleanup can be refused when this user is the last owner of a
        // followed person. That safety invariant must not prevent signing out.
        console.warn('Account data could not be deleted before sign-out', error);
      }
    }
    await signOut(this.services.auth);
    this.legacyFamilyId = undefined;
    this.legacyRole = undefined;
    localStorage.removeItem(PREFERENCES_KEY);
    this.state = initialRemoteState();
    this.emit();
    await this.initialize();
  }

  private async restoreProfile() {
    if (!this.user) return;
    const profile = await getDoc(doc(this.services.db, 'users', this.user.uid));
    const data = profile.exists() ? profile.data() as UserProfile : undefined;
    try { await this.loadParticipantAccess(); }
    catch (error) { console.error('Unable to load participant relationships', error); }
    if (!data) {
      const activeId = this.state.activeParticipantId;
      const access = activeId ? activeParticipantAccess(this.state.participantAccess, activeId) : undefined;
      if (access) await this.attachParticipant(activeId!, access.membership.role);
      else this.emit();
      return;
    }
    this.state.notificationsEnabled = data.notificationsEnabled === true;
    this.state.pushHealth = {
      ...this.state.pushHealth,
      permission: 'Notification' in window ? Notification.permission : 'unsupported',
      endpointPresent: this.state.pushHealth?.endpointPresent ?? false,
    };
    this.state.family.linkingCode = data.linkingCode ?? '';
    this.state.family.parentRecoveryCode = data.parentRecoveryCode ?? '';
    const activeId = this.state.activeParticipantId;
    const access = activeId ? activeParticipantAccess(this.state.participantAccess, activeId) : undefined;
    if (access) {
      await this.attachParticipant(activeId!, access.membership.role);
    }
    else if (data.familyId && data.role) {
      this.legacyFamilyId = data.familyId;
      this.legacyRole = data.role;
      await this.attachFamily(data.familyId, data.role);
    }
    else {
      this.emit();
    }
    this.runInBackground('Unable to sync push subscription locale', () => this.syncPushSubscriptionLocale());
  }

  private async loadParticipantAccess() {
    if (!this.user) return;
    const refs = await getDocs(collection(this.services.db, 'users', this.user.uid, 'participantRefs'));
    const access = (await Promise.all(refs.docs.map(async (reference): Promise<ParticipantAccess | undefined> => {
      const referenceData = reference.data();
      if (referenceData.status !== 'active') return undefined;
      const participantId = reference.id;
      const [participant, membership] = await Promise.all([
        getDoc(doc(this.services.db, 'participants', participantId)),
        getDoc(doc(this.services.db, 'participants', participantId, 'memberships', this.user!.uid)),
      ]);
      if (!participant.exists() || !membership.exists() || membership.data().status !== 'active') return undefined;
      const participantData = participant.data() as ParticipantDocument;
      const membershipData = membership.data();
      const role = membershipData.role as MembershipRole;
      if (!['owner', 'caregiver', 'participant', 'viewer'].includes(role)) return undefined;
      return {
        participant: {
          id: participantId,
          displayName: String(participantData.displayName ?? ''),
          selfManaged: participantData.userId === this.user!.uid && membershipData.label === 'self',
        },
        membership: {
          role,
          status: 'active',
          label: membershipData.label,
        },
      };
    }))).filter((entry): entry is ParticipantAccess => Boolean(entry));
    this.state.participantAccess = access.sort((left, right) => (
      left.participant.displayName.localeCompare(right.participant.displayName, this.state.locale)
    ));
    if (!activeParticipantAccess(this.state.participantAccess, this.state.activeParticipantId ?? '')) {
      this.state.activeParticipantId = this.state.participantAccess[0]?.participant.id;
    }
  }

  private async attachParticipant(participantId: string, membershipRole: MembershipRole) {
    this.remoteSubscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
    const access = activeParticipantAccess(this.state.participantAccess, participantId);
    if (!access) throw new Error('participant_access_not_found');
    this.state.activeParticipantId = participantId;
    this.state.role = membershipRole === 'participant' ? 'child' : 'parent';
    this.state.family = {
      ...this.state.family,
      id: participantId,
      linked: true,
      childLinked: true,
      childName: access.participant.displayName,
      consented: membershipRole !== 'participant',
      linkingCode: '',
      parentRecoveryCode: '',
    };
    this.state.routineAssignments = [];
    this.state.events = [];
    this.state.routinesLoaded = false;
    this.state.routinesError = false;
    const participantRef = doc(this.services.db, 'participants', participantId);
    if (this.user) {
      this.remoteSubscriptions.push(onSnapshot(doc(participantRef, 'pushSubscriptions', this.user.uid), (snapshot) => {
        const data = snapshot.data() as PushSubscriptionDocument | undefined;
        const toIso = (value: PushSubscriptionDocument['lastSuccessfulSaveAt']) =>
          typeof value === 'string' ? value : value?.toDate?.().toISOString();
        this.state.pushHealth = {
          permission: 'Notification' in window ? Notification.permission : 'unsupported',
          endpointPresent: Boolean(data?.endpoint),
          lastSuccessfulSaveAt: toIso(data?.lastSuccessfulSaveAt),
          lastDispatchResult: data?.lastDispatchResult,
          lastDispatchAt: toIso(data?.lastDispatchAt),
          lastDispatchError: data?.lastDispatchError,
        };
        this.emit();
      }));
    }
    const assignments = query(collection(participantRef, 'routineAssignments'), orderBy('assignedAt', 'asc'));
    this.remoteSubscriptions.push(onSnapshot(assignments, (snapshot) => {
      this.state.routineAssignments = snapshot.docs.map((item) => asRoutineAssignment(item.id, item.data()));
      this.state.routinesLoaded = true;
      this.state.routinesError = false;
      this.emit();
    }, (error) => {
      console.error('Unable to load participant routine assignments', error);
      this.state.routinesLoaded = true;
      this.state.routinesError = true;
      this.emit();
    }));
    const checks = query(collection(participantRef, 'checks'), orderBy('requestedAt', 'desc'));
    this.remoteSubscriptions.push(onSnapshot(checks, (snapshot) => {
      this.state.events = snapshot.docs.map((item) => asEvent(item.id, item.data()));
      this.emit();
    }, (error) => {
      console.error('Unable to load participant checks', error);
      this.state.routinesError = true;
      this.emit();
    }));
    this.persistPreferences();
    this.emit();
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
    const membershipRole = role === 'parent' ? 'owner' : 'participant';
    const existingAccess = this.state.participantAccess?.find((entry) => entry.participant.id === familyId);
    if (!existingAccess) {
      this.state.participantAccess = [
        ...(this.state.participantAccess ?? []),
        {
          participant: { id: familyId, displayName: this.state.family.childName },
          membership: { role: membershipRole, status: 'active' },
        },
      ];
    }
    this.state.activeParticipantId = familyId;
    if (role === 'parent') {
      this.runInBackground('Unable to refresh the parent recovery code', async () => {
        const ensureRecoveryCode = httpsCallable<{ familyId: string }, { recoveryCode: string }>(
          this.services.functions,
          'ensureParentRecoveryCode',
        );
        const recovery = await ensureRecoveryCode({ familyId });
        this.state.family.parentRecoveryCode = recovery.data.recoveryCode;
        this.emit();
      });
    }
    this.runInBackground('Unable to migrate family routines', async () => {
      const migrateRoutines = httpsCallable<{ familyId: string }, void>(this.services.functions, 'migrateFamilyRoutines');
      await migrateRoutines({ familyId });
    });
    if (role === 'parent') {
      this.runInBackground('Unable to migrate family relationships and content', async () => {
        const migrateRelationships = httpsCallable<{ familyId: string }, { participantId: string }>(
          this.services.functions,
          'migrateFamilyRelationships',
        );
        const migrateContent = httpsCallable<{ familyId: string }, { participantId: string }>(
          this.services.functions,
          'migrateFamilyContent',
        );
        await migrateRelationships({ familyId });
        await migrateContent({ familyId });
        await this.loadParticipantAccess();
        this.emit();
      });
    }
    const familyRef = doc(this.services.db, 'families', familyId);
    if ((role === 'child' || role === 'parent') && this.user) {
      this.remoteSubscriptions.push(onSnapshot(doc(familyRef, 'pushSubscriptions', this.user.uid), (snapshot) => {
        const data = snapshot.data() as PushSubscriptionDocument | undefined;
        const toIso = (value: PushSubscriptionDocument['lastSuccessfulSaveAt']) =>
          typeof value === 'string' ? value : value?.toDate?.().toISOString();
        this.state.pushHealth = {
          permission: 'Notification' in window ? Notification.permission : 'unsupported',
          endpointPresent: Boolean(data?.endpoint),
          lastSuccessfulSaveAt: toIso(data?.lastSuccessfulSaveAt),
          lastDispatchResult: data?.lastDispatchResult,
          lastDispatchAt: toIso(data?.lastDispatchAt),
          lastDispatchError: data?.lastDispatchError,
        };
        this.emit();
      }, (error) => {
        console.error('Unable to load push subscription health', error);
        this.state.pushHealth = {
          ...this.state.pushHealth,
          permission: 'Notification' in window ? Notification.permission : 'unsupported',
          endpointPresent: false,
        };
        this.emit();
      }));
    }
    this.remoteSubscriptions.push(onSnapshot(familyRef, async (snapshot) => {
      if (!snapshot.exists()) return;
      const family = snapshot.data() as FamilyDocument;
      const childLinked = Object.values(family.members ?? {}).some((memberRole) => memberRole === 'child');
      this.state.family.childName = family.childName;
      const participantAccess = this.state.participantAccess?.find((entry) => entry.participant.id === familyId);
      if (participantAccess) participantAccess.participant.displayName = family.childName;
      this.state.family.childLinked = childLinked || this.state.family.childLinked;
      this.state.family.linkingCode = family.linkingCode ?? this.state.family.linkingCode;
      this.state.family.parentRecoveryCode = family.parentRecoveryCode ?? this.state.family.parentRecoveryCode;
      if (role === 'parent' && typeof family.notificationPreferences?.reminderRepeatMinutes === 'number') {
        this.state.preferences = normalizeAppPreferences({
          ...this.state.preferences,
          reminderRepeatMinutes: family.notificationPreferences.reminderRepeatMinutes,
        });
        this.persistPreferences();
      }

      this.emit();

      const familyMembers = family.members;
      if (role === 'child' && !this.state.family.parentRecoveryCode && familyMembers) {
        this.runInBackground('Unable to fetch parent recovery code from profile', async () => {
          const parentUids = Object.entries(familyMembers)
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
        });
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
      this.state.routinesError = false;
      this.emit();
    }, (error) => {
      console.error('Unable to load checks', error);
      this.state.routinesLoaded = true;
      this.state.routinesError = true;
      this.emit();
    }));
    this.persistPreferences();
    this.emit();
  }

  private persistPreferences() {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
      locale: this.state.locale,
      role: this.state.role,
      ...normalizeAppPreferences(this.state.preferences),
    }));
  }

  private async syncPushSubscriptionLocale() {
    if (!['child', 'parent'].includes(String(this.state.role)) || !this.user || !this.state.family.id || !this.state.notificationsEnabled) return;
    try {
      await updateDoc(doc(this.services.db, 'families', this.state.family.id, 'pushSubscriptions', this.user.uid), {
        locale: this.state.locale,
      });
    } catch (error) {
      console.error('Unable to update push subscription locale', error);
    }
  }

  private async syncPushSubscriptionPreferences() {
    if (this.state.role !== 'child' || !this.user || !this.state.family.id || !this.state.notificationsEnabled) return;
    try {
      await updateDoc(doc(this.services.db, 'families', this.state.family.id, 'pushSubscriptions', this.user.uid), {
        preferences: normalizeAppPreferences(this.state.preferences),
      });
    } catch (error) {
      console.error('Unable to update push subscription preferences', error);
    }
  }

  private async syncFamilyNotificationPreferences() {
    if (this.state.role !== 'parent' || !this.user || !this.state.family.id) return;
    try {
      const updateNotificationPreferences = httpsCallable<{
        familyId: string;
        reminderRepeatMinutes: number;
      }, void>(this.services.functions, 'updateNotificationPreferences');
      await updateNotificationPreferences({
        familyId: this.state.family.id,
        reminderRepeatMinutes: normalizeAppPreferences(this.state.preferences).reminderRepeatMinutes,
      });
    } catch (error) {
      console.error('Unable to update notification preferences', error);
    }
  }

  private runInBackground(label: string, task: () => Promise<void>) {
    void task().catch((error) => console.error(label, error));
  }

  private emit() { this.listeners.forEach((listener) => listener()); }
}
