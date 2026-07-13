import type { AnalysisResult, AppPreferences, AppState, Locale, MembershipRole, MonitoringPlan, ParticipantMember, ProfileColorKey, Role, RoutineValidationMode, VerificationEvent } from '../domain/models';

export interface AppRepository {
  initialize(): Promise<void>;
  snapshot(): AppState;
  subscribe(listener: () => void): () => void;
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
  requestCheckNow(routineId?: string): Promise<void>;
  updateRoutine(routineId: string, plan: MonitoringPlan, validationMode?: RoutineValidationMode): Promise<void>;
  savePushSubscription(subscription: PushSubscriptionJSON): Promise<void>;
  sendTestPushNotification(): Promise<void>;
  savePlan(plan: MonitoringPlan, routineId?: string): Promise<void>;
  activeSession(routineId?: string): VerificationEvent | undefined;
  submitCapture(sessionId: string, capturedAt: Date, imageDataUrl: string): Promise<VerificationEvent>;
  getProofImageUrl(eventId: string): Promise<string>;
  reviewCheck(eventId: string, decision: 'detected' | 'not_detected'): Promise<VerificationEvent>;
  retryRemoteSync?(): Promise<void>;
  reset(): Promise<void>;
}

export interface VerificationGateway {
  createUpload(sessionId: string): Promise<{ uploadUrl: string; nonce: string }>;
  submit(input: {
    sessionId: string;
    nonce: string;
    capturedAt: string;
    digest: string;
  }): Promise<AnalysisResult>;
}

export interface PushGateway {
  permission(): Promise<NotificationPermission>;
  subscribe(): Promise<PushSubscription>;
}
