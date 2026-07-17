import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';

type AuditAction =
  | 'create_family'
  | 'join_family'
  | 'regenerate_link_code'
  | 'recover_parent'
  | 'request_check'
  | 'submit_proof'
  | 'review_proof'
  | 'reset_account'
  | 'create_participant'
  | 'update_account_profile'
  | 'update_participant_color'
  | 'create_relationship_invitation'
  | 'accept_relationship_invitation'
  | 'migrate_family_relationships'
  | 'migrate_family_content'
  | 'remove_participant_membership'
  | 'delete_participant_profile'
  | 'create_relationship_recovery'
  | 'recover_relationship'
  | 'assign_routine'
  | 'assign_routine_draft'
  | 'publish_routine_version'
  | 'upgrade_routine_assignment'
  | 'delete_routine'
  | 'create_routine_draft'
  | 'update_routine_draft'
  | 'delete_routine_draft'
  | 'register_contact_email'
  | 'suspend_user_access'
  | 'app_ready'
  | 'notifications_enabled'
  | 'notification_opened'
  | 'check_opened'
  | 'accept_pilot_participation'
  | 'decline_pilot_participation'
  | 'withdraw_pilot_participation';

type AuditMetadataValue = string | number | boolean | null | undefined;

interface AuditEventInput {
  action: AuditAction;
  actorUid: string;
  familyId?: string;
  participantId?: string;
  role?: 'parent' | 'child';
  metadata?: Record<string, AuditMetadataValue>;
}

export const auditEventDocument = (input: AuditEventInput) => {
  const metadata = Object.fromEntries(
    Object.entries(input.metadata ?? {})
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value) || value === null),
  );
  return {
    action: input.action,
    actorUid: input.actorUid,
    ...(input.familyId ? { familyId: input.familyId } : {}),
    ...(input.participantId ? { participantId: input.participantId } : {}),
    ...(input.role ? { role: input.role } : {}),
    ...(Object.keys(metadata).length ? { metadata } : {}),
    occurredAt: new Date().toISOString(),
    createdAt: FieldValue.serverTimestamp(),
  };
};

export const recordAuditEvent = async (db: Firestore, input: AuditEventInput) => {
  try {
    await db.collection('auditEvents').add(auditEventDocument(input));
  } catch (error) {
    console.error('Unable to record audit event', { action: input.action, familyId: input.familyId, error });
  }
};

export type JourneyStage = Extract<AuditAction, 'app_ready' | 'notifications_enabled' | 'notification_opened' | 'check_opened'>;

export const journeyEventId = (actorUid: string, stage: JourneyStage, contextId: string | undefined, day: string) =>
  createHash('sha256').update(`${actorUid}:${stage}:${contextId ?? day}`).digest('hex');

export const recordJourneyEvent = async (db: Firestore, input: Omit<AuditEventInput, 'action'> & {
  stage: JourneyStage;
  contextId?: string;
}) => {
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.collection('auditEvents').doc(journeyEventId(input.actorUid, input.stage, input.contextId, day));
  try {
    await ref.create(auditEventDocument({
      action: input.stage,
      actorUid: input.actorUid,
      familyId: input.familyId,
      participantId: input.participantId,
      role: input.role,
      metadata: input.metadata,
    }));
  } catch (error) {
    if ((error as { code?: number | string }).code === 6 || (error as { code?: number | string }).code === 'already-exists') return;
    throw error;
  }
};
