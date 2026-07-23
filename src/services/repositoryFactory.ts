import type { AppRepository, JourneySource, JourneyStage, StartupProgressReporter } from './contracts';
import { DemoRepository } from './demoRepository';
import { type AppPreferences, type Locale, type MembershipRole, type MonitoringPlan, type PilotParticipation, type ProfileColorKey, type Role, type RoutineAppearance, type RoutineResponseSubmission, type RoutineValidationMode } from '../domain/models';
import { firebaseEnabled } from './firebaseConfig';
import { isLocalDemoEnvironment } from './browserEnvironment';
import { initialRemoteState } from './appStateDefaults';
import type { RoutinePackageV1 } from '../domain/routineDraft';

class LazyFirebaseRepository implements AppRepository {
  private delegate?: AppRepository;
  private delegatePromise?: Promise<AppRepository>;
  private unsubscribeDelegate?: () => void;
  private readonly listeners = new Set<() => void>();
  private readonly loadingState = initialRemoteState();

  snapshot() {
    return this.delegate?.snapshot() ?? structuredClone(this.loadingState);
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async initialize(reportProgress?: StartupProgressReporter) {
    reportProgress?.('services');
    const repository = await this.load();
    await repository.initialize(reportProgress);
    this.emit();
  }

  async registerContactEmail(email: string) {
    return this.invokeOptional(
      (repository) => repository.registerContactEmail?.(email),
      'contact_email_registration_unavailable',
    );
  }

  async selectRole(role: Role) {
    return (await this.load()).selectRole(role);
  }

  async selectActiveParticipant(participantId: string) {
    return this.invokeOptional(
      (repository) => repository.selectActiveParticipant?.(participantId),
      'participant_selection_unavailable',
    );
  }

  async updateAccountProfile(displayName: string) {
    return this.invokeOptional(
      (repository) => repository.updateAccountProfile?.(displayName),
      'account_profile_update_unavailable',
    );
  }

  async renameParticipant(participantId: string, displayName: string) {
    return this.invokeOptional(
      (repository) => repository.renameParticipant?.(participantId, displayName),
      'participant_rename_unavailable',
    );
  }

  async updateParticipantColor(participantId: string, profileColor: ProfileColorKey) {
    return this.invokeOptional(
      (repository) => repository.updateParticipantColor?.(participantId, profileColor),
      'participant_color_update_unavailable',
    );
  }

  async createParticipant(displayName: string, selfManaged?: boolean) {
    return this.invokeOptional(
      (repository) => repository.createParticipant?.(displayName, selfManaged),
      'participant_creation_unavailable',
    );
  }

  async inviteParticipantMember(participantId: string, role: MembershipRole) {
    return this.invokeOptional(
      (repository) => repository.inviteParticipantMember?.(participantId, role),
      'participant_invitation_unavailable',
    );
  }

  async acceptParticipantInvitation(code: string) {
    return this.invokeOptional(
      (repository) => repository.acceptParticipantInvitation?.(code),
      'participant_invitation_unavailable',
    );
  }

  async leaveParticipant(participantId: string) {
    return this.invokeOptional(
      (repository) => repository.leaveParticipant?.(participantId),
      'participant_leave_unavailable',
    );
  }

  async removeParticipantMember(participantId: string, targetUid: string) {
    return this.invokeOptional(
      (repository) => repository.removeParticipantMember?.(participantId, targetUid),
      'participant_member_removal_unavailable',
    );
  }

  async deleteParticipant(participantId: string) {
    return this.invokeOptional(
      (repository) => repository.deleteParticipant?.(participantId),
      'participant_deletion_unavailable',
    );
  }

  async createRelationshipRecovery(participantId: string) {
    return this.invokeOptional(
      (repository) => repository.createRelationshipRecovery?.(participantId),
      'relationship_recovery_unavailable',
    );
  }

  async recoverRelationship(code: string) {
    return this.invokeOptional(
      (repository) => repository.recoverRelationship?.(code),
      'relationship_recovery_unavailable',
    );
  }

  async setLocale(locale: Locale) {
    return (await this.load()).setLocale(locale);
  }

  async setPreferences(preferences: Partial<AppPreferences>) {
    return (await this.load()).setPreferences(preferences);
  }

  async linkParent(childName: string) {
    return (await this.load()).linkParent(childName);
  }

  async recoverParent(code: string) {
    return (await this.load()).recoverParent(code);
  }

  async linkChild(code: string) {
    return (await this.load()).linkChild(code);
  }

  async regenerateLinkCode() {
    return (await this.load()).regenerateLinkCode();
  }

  async assignRoutine(routineId: string) {
    return (await this.load()).assignRoutine(routineId);
  }

  async deleteRoutine(routineId: string) {
    return (await this.load()).deleteRoutine(routineId);
  }

  async listRoutineDrafts(participantId: string) {
    return this.invokeOptional((repository) => repository.listRoutineDrafts?.(participantId), 'routine_drafts_unavailable');
  }

  async createRoutineDraft(participantId: string, routinePackage: RoutinePackageV1) {
    return this.invokeOptional((repository) => repository.createRoutineDraft?.(participantId, routinePackage), 'routine_drafts_unavailable');
  }

  async forkRoutineAssignmentDraft(participantId: string, routineId: string, locale: Locale) {
    return this.invokeOptional((repository) => repository.forkRoutineAssignmentDraft?.(participantId, routineId, locale), 'routine_drafts_unavailable');
  }

  async updateRoutineDraft(participantId: string, draftId: string, expectedRevision: number, routinePackage: RoutinePackageV1) {
    return this.invokeOptional((repository) => repository.updateRoutineDraft?.(participantId, draftId, expectedRevision, routinePackage), 'routine_drafts_unavailable');
  }

  async deleteRoutineDraft(participantId: string, draftId: string, expectedRevision: number) {
    return this.invokeOptional((repository) => repository.deleteRoutineDraft?.(participantId, draftId, expectedRevision), 'routine_drafts_unavailable');
  }

  async assignRoutineDraft(participantId: string, draftId: string, expectedRevision: number) {
    return this.invokeOptional((repository) => repository.assignRoutineDraft?.(participantId, draftId, expectedRevision), 'routine_drafts_unavailable');
  }

  async getAiAuthoringCapabilities() {
    return this.invokeOptional((repository) => repository.getAiAuthoringCapabilities?.(), 'ai_authoring_unavailable');
  }

  async proposeRoutineChallenge(input: Parameters<NonNullable<AppRepository['proposeRoutineChallenge']>>[0]) {
    return this.invokeOptional((repository) => repository.proposeRoutineChallenge?.(input), 'ai_authoring_unavailable');
  }

  async publishRoutineDraft(participantId: string, draftId: string, expectedRevision: number) {
    return this.invokeOptional((repository) => repository.publishRoutineDraft?.(participantId, draftId, expectedRevision), 'routine_publication_unavailable');
  }

  async listPublishedRoutineVersions(participantId: string) {
    return this.invokeOptional((repository) => repository.listPublishedRoutineVersions?.(participantId), 'routine_publication_unavailable');
  }

  async upgradeRoutineAssignment(participantId: string, routineId: string, targetVersion: number) {
    return this.invokeOptional((repository) => repository.upgradeRoutineAssignment?.(participantId, routineId, targetVersion), 'routine_publication_unavailable');
  }

  async createNextRoutineDraft(participantId: string, routineId: string, sourceVersion: number) {
    return this.invokeOptional((repository) => repository.createNextRoutineDraft?.(participantId, routineId, sourceVersion), 'routine_publication_unavailable');
  }

  async searchRoutineCatalog(query: string) {
    return this.invokeOptional((repository) => repository.searchRoutineCatalog?.(query), 'routine_catalog_unavailable');
  }

  async exportRoutinePackage(participantId: string, draftId: string) {
    return this.invokeOptional((repository) => repository.exportRoutinePackage?.(participantId, draftId), 'routine_package_transfer_unavailable');
  }

  async importRoutinePackage(participantId: string, content: string, mimeType: string, conflict: 'reject' | 'copy') {
    return this.invokeOptional((repository) => repository.importRoutinePackage?.(participantId, content, mimeType, conflict), 'routine_package_transfer_unavailable');
  }

  async resolveSharedRoutine(shareCode: string) {
    return this.invokeOptional((repository) => repository.resolveSharedRoutine?.(shareCode), 'routine_catalog_unavailable');
  }

  async installCatalogRoutine(participantId: string, entryId: string, shareCode?: string) {
    return this.invokeOptional((repository) => repository.installCatalogRoutine?.(participantId, entryId, shareCode), 'routine_catalog_unavailable');
  }

  async sharePublishedRoutine(participantId: string, routineId: string, version: number, visibility: 'listed' | 'unlisted') {
    return this.invokeOptional((repository) => repository.sharePublishedRoutine?.(participantId, routineId, version, visibility), 'routine_catalog_unavailable');
  }

  async revokeSharedRoutine(entryId: string) {
    return this.invokeOptional((repository) => repository.revokeSharedRoutine?.(entryId), 'routine_catalog_unavailable');
  }

  async reportRoutineCatalogEntry(entryId: string, reason: 'unsafe' | 'privacy' | 'copyright' | 'other') {
    return this.invokeOptional((repository) => repository.reportRoutineCatalogEntry?.(entryId, reason), 'routine_catalog_unavailable');
  }

  async requestCheckNow(routineId?: string) {
    return (await this.load()).requestCheckNow(routineId);
  }

  async updateRoutine(routineId: string, plan: MonitoringPlan, validationMode?: RoutineValidationMode, appearance?: RoutineAppearance) {
    return (await this.load()).updateRoutine(routineId, plan, validationMode, appearance);
  }

  async savePushSubscription(subscription: PushSubscriptionJSON) {
    return (await this.load()).savePushSubscription(subscription);
  }

  async sendTestPushNotification() {
    return (await this.load()).sendTestPushNotification();
  }

  async recordJourneyEvent(stage: JourneyStage, source: JourneySource, contextId?: string) {
    const repository = await this.load();
    if (repository.recordJourneyEvent) await repository.recordJourneyEvent(stage, source, contextId);
  }

  async updatePilotParticipation(status: PilotParticipation['status']) {
    return this.invokeOptional(
      (repository) => repository.updatePilotParticipation?.(status),
      'pilot_participation_unavailable',
    );
  }

  async savePlan(plan: MonitoringPlan, routineId?: string) {
    return (await this.load()).savePlan(plan, routineId);
  }

  activeSession(routineId?: string) {
    return this.delegate?.activeSession(routineId);
  }

  async submitCapture(sessionId: string, capturedAt: Date, imageDataUrl: string) {
    return (await this.load()).submitCapture(sessionId, capturedAt, imageDataUrl);
  }

  async submitRoutineResponse(sessionId: string, submittedAt: Date, submission: RoutineResponseSubmission) {
    return (await this.load()).submitRoutineResponse(sessionId, submittedAt, submission);
  }

  async prepareQuizChallenge(sessionId: string) {
    return (await this.load()).prepareQuizChallenge(sessionId);
  }
  async reportQuizQuestion(sessionId: string, questionId: string) { return (await this.load()).reportQuizQuestion(sessionId, questionId); }

  async getProofImageUrl(eventId: string) {
    return (await this.load()).getProofImageUrl(eventId);
  }

  async reviewCheck(eventId: string, decision: 'detected' | 'not_detected') {
    return (await this.load()).reviewCheck(eventId, decision);
  }

  async retryRemoteSync() {
    return (await this.load()).retryRemoteSync?.();
  }

  async reset() {
    return (await this.load()).reset();
  }

  private async invokeOptional<TResult>(
    invoke: (repository: AppRepository) => Promise<TResult> | undefined,
    unavailableError: string,
  ): Promise<TResult> {
    const result = invoke(await this.load());
    if (result === undefined) throw new Error(unavailableError);
    return result;
  }

  private async load() {
    if (this.delegate) return this.delegate;
    this.delegatePromise ??= import('./firebaseRepository').then(({ FirebaseRepository }) => {
      const repository = new FirebaseRepository();
      this.delegate = repository;
      this.unsubscribeDelegate?.();
      this.unsubscribeDelegate = repository.subscribe(() => this.emit());
      return repository;
    });
    return this.delegatePromise;
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }
}

export const createRepository = (): AppRepository => firebaseEnabled
  ? (isLocalDemoEnvironment() ? new DemoRepository() : new LazyFirebaseRepository())
  : new DemoRepository();
