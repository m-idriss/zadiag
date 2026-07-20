import type { AppRepository, JourneySource, JourneyStage, StartupProgressReporter } from './contracts';
import { DemoRepository } from './demoRepository';
import { type AppPreferences, type Locale, type MembershipRole, type MonitoringPlan, type PilotParticipation, type ProfileColorKey, type Role, type RoutineValidationMode } from '../domain/models';
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
    const repository = await this.load();
    if (!repository.registerContactEmail) throw new Error('contact_email_registration_unavailable');
    return repository.registerContactEmail(email);
  }

  async selectRole(role: Role) {
    return (await this.load()).selectRole(role);
  }

  async selectActiveParticipant(participantId: string) {
    const repository = await this.load();
    if (!repository.selectActiveParticipant) throw new Error('participant_selection_unavailable');
    return repository.selectActiveParticipant(participantId);
  }

  async updateAccountProfile(displayName: string) {
    const repository = await this.load();
    if (!repository.updateAccountProfile) throw new Error('account_profile_update_unavailable');
    return repository.updateAccountProfile(displayName);
  }

  async updateParticipantColor(participantId: string, profileColor: ProfileColorKey) {
    const repository = await this.load();
    if (!repository.updateParticipantColor) throw new Error('participant_color_update_unavailable');
    return repository.updateParticipantColor(participantId, profileColor);
  }

  async createParticipant(displayName: string, selfManaged?: boolean) {
    const repository = await this.load();
    if (!repository.createParticipant) throw new Error('participant_creation_unavailable');
    return repository.createParticipant(displayName, selfManaged);
  }

  async inviteParticipantMember(participantId: string, role: MembershipRole) {
    const repository = await this.load();
    if (!repository.inviteParticipantMember) throw new Error('participant_invitation_unavailable');
    return repository.inviteParticipantMember(participantId, role);
  }

  async acceptParticipantInvitation(code: string) {
    const repository = await this.load();
    if (!repository.acceptParticipantInvitation) throw new Error('participant_invitation_unavailable');
    return repository.acceptParticipantInvitation(code);
  }

  async leaveParticipant(participantId: string) {
    const repository = await this.load();
    if (!repository.leaveParticipant) throw new Error('participant_leave_unavailable');
    return repository.leaveParticipant(participantId);
  }

  async removeParticipantMember(participantId: string, targetUid: string) {
    const repository = await this.load();
    if (!repository.removeParticipantMember) throw new Error('participant_member_removal_unavailable');
    return repository.removeParticipantMember(participantId, targetUid);
  }

  async deleteParticipant(participantId: string) {
    const repository = await this.load();
    if (!repository.deleteParticipant) throw new Error('participant_deletion_unavailable');
    return repository.deleteParticipant(participantId);
  }

  async createRelationshipRecovery(participantId: string) {
    const repository = await this.load();
    if (!repository.createRelationshipRecovery) throw new Error('relationship_recovery_unavailable');
    return repository.createRelationshipRecovery(participantId);
  }

  async recoverRelationship(code: string) {
    const repository = await this.load();
    if (!repository.recoverRelationship) throw new Error('relationship_recovery_unavailable');
    return repository.recoverRelationship(code);
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

  async listRoutineDrafts(participantId: string) { const repository = await this.load(); if (!repository.listRoutineDrafts) throw new Error('routine_drafts_unavailable'); return repository.listRoutineDrafts(participantId); }
  async createRoutineDraft(participantId: string, routinePackage: RoutinePackageV1) { const repository = await this.load(); if (!repository.createRoutineDraft) throw new Error('routine_drafts_unavailable'); return repository.createRoutineDraft(participantId, routinePackage); }
  async forkRoutineAssignmentDraft(participantId: string, routineId: string, locale: Locale) { const repository = await this.load(); if (!repository.forkRoutineAssignmentDraft) throw new Error('routine_drafts_unavailable'); return repository.forkRoutineAssignmentDraft(participantId, routineId, locale); }
  async updateRoutineDraft(participantId: string, draftId: string, expectedRevision: number, routinePackage: RoutinePackageV1) { const repository = await this.load(); if (!repository.updateRoutineDraft) throw new Error('routine_drafts_unavailable'); return repository.updateRoutineDraft(participantId, draftId, expectedRevision, routinePackage); }
  async deleteRoutineDraft(participantId: string, draftId: string, expectedRevision: number) { const repository = await this.load(); if (!repository.deleteRoutineDraft) throw new Error('routine_drafts_unavailable'); return repository.deleteRoutineDraft(participantId, draftId, expectedRevision); }
  async assignRoutineDraft(participantId: string, draftId: string, expectedRevision: number) { const repository = await this.load(); if (!repository.assignRoutineDraft) throw new Error('routine_drafts_unavailable'); return repository.assignRoutineDraft(participantId, draftId, expectedRevision); }
  async publishRoutineDraft(participantId: string, draftId: string, expectedRevision: number) { const repository = await this.load(); if (!repository.publishRoutineDraft) throw new Error('routine_publication_unavailable'); return repository.publishRoutineDraft(participantId, draftId, expectedRevision); }
  async listPublishedRoutineVersions(participantId: string) { const repository = await this.load(); if (!repository.listPublishedRoutineVersions) throw new Error('routine_publication_unavailable'); return repository.listPublishedRoutineVersions(participantId); }
  async upgradeRoutineAssignment(participantId: string, routineId: string, targetVersion: number) { const repository = await this.load(); if (!repository.upgradeRoutineAssignment) throw new Error('routine_publication_unavailable'); return repository.upgradeRoutineAssignment(participantId, routineId, targetVersion); }
  async createNextRoutineDraft(participantId: string, routineId: string, sourceVersion: number) { const repository = await this.load(); if (!repository.createNextRoutineDraft) throw new Error('routine_publication_unavailable'); return repository.createNextRoutineDraft(participantId, routineId, sourceVersion); }
  async searchRoutineCatalog(query: string) { const repository = await this.load(); if (!repository.searchRoutineCatalog) throw new Error('routine_catalog_unavailable'); return repository.searchRoutineCatalog(query); }
  async exportRoutinePackage(participantId: string, draftId: string) { const repository = await this.load(); if (!repository.exportRoutinePackage) throw new Error('routine_package_transfer_unavailable'); return repository.exportRoutinePackage(participantId, draftId); }
  async importRoutinePackage(participantId: string, content: string, mimeType: string, conflict: 'reject' | 'copy') { const repository = await this.load(); if (!repository.importRoutinePackage) throw new Error('routine_package_transfer_unavailable'); return repository.importRoutinePackage(participantId, content, mimeType, conflict); }
  async resolveSharedRoutine(shareCode: string) { const repository = await this.load(); if (!repository.resolveSharedRoutine) throw new Error('routine_catalog_unavailable'); return repository.resolveSharedRoutine(shareCode); }
  async installCatalogRoutine(participantId: string, entryId: string, shareCode?: string) { const repository = await this.load(); if (!repository.installCatalogRoutine) throw new Error('routine_catalog_unavailable'); return repository.installCatalogRoutine(participantId, entryId, shareCode); }
  async sharePublishedRoutine(participantId: string, routineId: string, version: number, visibility: 'listed' | 'unlisted') { const repository = await this.load(); if (!repository.sharePublishedRoutine) throw new Error('routine_catalog_unavailable'); return repository.sharePublishedRoutine(participantId, routineId, version, visibility); }
  async revokeSharedRoutine(entryId: string) { const repository = await this.load(); if (!repository.revokeSharedRoutine) throw new Error('routine_catalog_unavailable'); return repository.revokeSharedRoutine(entryId); }
  async reportRoutineCatalogEntry(entryId: string, reason: 'unsafe' | 'privacy' | 'copyright' | 'other') { const repository = await this.load(); if (!repository.reportRoutineCatalogEntry) throw new Error('routine_catalog_unavailable'); return repository.reportRoutineCatalogEntry(entryId, reason); }

  async requestCheckNow(routineId?: string) {
    return (await this.load()).requestCheckNow(routineId);
  }

  async updateRoutine(routineId: string, plan: MonitoringPlan, validationMode?: RoutineValidationMode) {
    return (await this.load()).updateRoutine(routineId, plan, validationMode);
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
    const repository = await this.load();
    if (!repository.updatePilotParticipation) throw new Error('pilot_participation_unavailable');
    return repository.updatePilotParticipation(status);
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
