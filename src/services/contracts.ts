import type { AppPreferences, AppState, Locale, MembershipRole, MonitoringPlan, ParticipantMember, PilotParticipation, ProfileColorKey, Role, RoutineValidationMode, VerificationEvent } from '../domain/models';
import type { PublishedRoutineVersion, RoutineCatalogEntry, RoutineDraft, RoutinePackageV1 } from '../domain/routineDraft';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'failed';
export type StartupStage = 'services' | 'account' | 'profile' | 'relationships' | 'workspace';
export type StartupProgressReporter = (stage: StartupStage) => void;
export type JourneyStage = 'app_ready' | 'notifications_enabled' | 'notification_opened' | 'check_opened';
export type JourneySource = 'startup' | 'settings' | 'push' | 'notification_center' | 'dashboard' | 'history';

export interface AppRepository {
  initialize(reportProgress?: StartupProgressReporter): Promise<void>;
  snapshot(): AppState;
  subscribe(listener: () => void): () => void;
  registerContactEmail?(email: string): Promise<string>;
  selectRole(role: Role): Promise<void>;
  selectActiveParticipant?(participantId: string): Promise<void>;
  updateAccountProfile?(displayName: string): Promise<string>;
  updateParticipantColor?(participantId: string, profileColor: ProfileColorKey): Promise<ProfileColorKey>;
  createParticipant?(displayName: string, selfManaged?: boolean): Promise<string>;
  inviteParticipantMember?(participantId: string, role: MembershipRole): Promise<{ code: string; expiresAt: string }>;
  acceptParticipantInvitation?(code: string): Promise<string>;
  leaveParticipant?(participantId: string): Promise<void>;
  removeParticipantMember?(participantId: string, targetUid: string): Promise<ParticipantMember[]>;
  deleteParticipant?(participantId: string): Promise<void>;
  createRelationshipRecovery?(participantId: string): Promise<{ recoveryCode: string; expiresAt: string }>;
  recoverRelationship?(code: string): Promise<{ participantId: string; recoveryCode?: string; expiresAt?: string }>;
  setLocale(locale: Locale): Promise<void>;
  setPreferences(preferences: Partial<AppPreferences>): Promise<void>;
  linkParent(childName: string): Promise<void>;
  recoverParent(code: string): Promise<void>;
  linkChild(code: string): Promise<void>;
  regenerateLinkCode(): Promise<void>;
  assignRoutine(routineId: string): Promise<void>;
  deleteRoutine(routineId: string): Promise<void>;
  listRoutineDrafts?(participantId: string): Promise<RoutineDraft[]>;
  createRoutineDraft?(participantId: string, routinePackage: RoutinePackageV1): Promise<RoutineDraft>;
  forkRoutineAssignmentDraft?(participantId: string, routineId: string, locale: Locale): Promise<RoutineDraft>;
  updateRoutineDraft?(participantId: string, draftId: string, expectedRevision: number, routinePackage: RoutinePackageV1): Promise<RoutineDraft>;
  deleteRoutineDraft?(participantId: string, draftId: string, expectedRevision: number): Promise<void>;
  assignRoutineDraft?(participantId: string, draftId: string, expectedRevision: number): Promise<void>;
  publishRoutineDraft?(participantId: string, draftId: string, expectedRevision: number): Promise<PublishedRoutineVersion>;
  listPublishedRoutineVersions?(participantId: string): Promise<Array<PublishedRoutineVersion & { routineId: string }>>;
  upgradeRoutineAssignment?(participantId: string, routineId: string, targetVersion: number): Promise<void>;
  createNextRoutineDraft?(participantId: string, routineId: string, sourceVersion: number): Promise<RoutineDraft>;
  exportRoutinePackage?(participantId: string, draftId: string): Promise<{ content: string; mimeType: string; fileName: string }>;
  importRoutinePackage?(participantId: string, content: string, mimeType: string, conflict: 'reject' | 'copy'): Promise<RoutineDraft>;
  searchRoutineCatalog?(query: string): Promise<RoutineCatalogEntry[]>;
  resolveSharedRoutine?(shareCode: string): Promise<RoutineCatalogEntry>;
  installCatalogRoutine?(participantId: string, entryId: string, shareCode?: string): Promise<void>;
  sharePublishedRoutine?(participantId: string, routineId: string, version: number, visibility: 'listed' | 'unlisted'): Promise<{ entryId: string; shareCode: string }>;
  revokeSharedRoutine?(entryId: string): Promise<void>;
  reportRoutineCatalogEntry?(entryId: string, reason: 'unsafe' | 'privacy' | 'copyright' | 'other'): Promise<void>;
  requestCheckNow(routineId?: string): Promise<void>;
  updateRoutine(routineId: string, plan: MonitoringPlan, validationMode?: RoutineValidationMode): Promise<void>;
  savePushSubscription(subscription: PushSubscriptionJSON): Promise<void>;
  sendTestPushNotification(): Promise<void>;
  recordJourneyEvent?(stage: JourneyStage, source: JourneySource, contextId?: string): Promise<void>;
  updatePilotParticipation?(status: PilotParticipation['status']): Promise<PilotParticipation>;
  savePlan(plan: MonitoringPlan, routineId?: string): Promise<void>;
  activeSession(routineId?: string): VerificationEvent | undefined;
  submitCapture(sessionId: string, capturedAt: Date, imageDataUrl: string): Promise<VerificationEvent>;
  getProofImageUrl(eventId: string): Promise<string>;
  reviewCheck(eventId: string, decision: 'detected' | 'not_detected'): Promise<VerificationEvent>;
  retryRemoteSync?(): Promise<void>;
  reset(): Promise<void>;
}

export interface PushGateway {
  permission(): Promise<NotificationPermission>;
  subscribe(options?: { forceRenewal?: boolean }): Promise<PushSubscription>;
}
