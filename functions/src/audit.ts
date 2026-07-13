import { FieldValue, type Firestore } from 'firebase-admin/firestore';

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
  | 'delete_routine';

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
