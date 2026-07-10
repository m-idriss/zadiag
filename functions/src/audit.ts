import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export type AuditAction =
  | 'create_family'
  | 'join_family'
  | 'regenerate_link_code'
  | 'recover_parent'
  | 'request_check'
  | 'submit_proof'
  | 'review_proof'
  | 'reset_account';

type AuditMetadataValue = string | number | boolean | null | undefined;

export interface AuditEventInput {
  action: AuditAction;
  actorUid: string;
  familyId?: string;
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
