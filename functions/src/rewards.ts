import { FieldPath, FieldValue, type DocumentData, type DocumentReference, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { createHash } from 'node:crypto';
import { expiredRewardSecretCutoff } from './cleanup.js';

const finalSuccessStatuses = new Set(['answered', 'detected']);
const maxRewardCodesPerPolicy = 100;
const defaultClaimLifetimeHours = 24;
const maxRewardCodeLength = 240;

export type RewardOutcomeStatus = 'claimed' | 'exhausted' | 'expired' | 'revoked';

export interface RewardOutcome {
  status: RewardOutcomeStatus;
  resolvedAt: string;
  claimId?: string;
  expiresAt?: string;
}

export interface RewardPoolInput {
  codes: string[];
  claimLifetimeHours: number;
}

export const rewardClaimForReveal = (
  checkData: DocumentData | undefined,
  claimData: DocumentData | undefined,
  now = new Date(),
): { status: RewardOutcomeStatus | 'unavailable'; value?: string; expiresAt?: string } => {
  if (!checkData || !finalSuccessStatuses.has(String(checkData.status ?? ''))) return { status: 'unavailable' };
  const outcome = existingRewardOutcome(checkData.reward);
  if (!claimData) {
    if (outcome?.status === 'claimed') {
      return outcome.expiresAt && Date.parse(outcome.expiresAt) <= now.getTime()
        ? { status: 'expired' }
        : { status: 'unavailable' };
    }
    return { status: outcome?.status ?? 'unavailable' };
  }
  const expiresAt = typeof claimData.expiresAt === 'string' ? claimData.expiresAt : '';
  if (!expiresAt || Date.parse(expiresAt) <= now.getTime()) return { status: 'expired' };
  if (typeof claimData.value !== 'string' || !claimData.value) return { status: 'unavailable' };
  return { status: 'claimed', value: claimData.value, expiresAt };
};

export const rewardPoolInput = (input: unknown): RewardPoolInput | undefined => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const candidate = input as Record<string, unknown>;
  if (!Array.isArray(candidate.codes) || candidate.codes.length < 1 || candidate.codes.length > maxRewardCodesPerPolicy) return undefined;
  const codes = candidate.codes.map((code) => typeof code === 'string' ? code.trim() : '');
  if (codes.some((code) => !code || code.length > maxRewardCodeLength) || new Set(codes).size !== codes.length) return undefined;
  const claimLifetimeHours = Number(candidate.claimLifetimeHours ?? defaultClaimLifetimeHours);
  if (!Number.isSafeInteger(claimLifetimeHours) || claimLifetimeHours < 1 || claimLifetimeHours > 168) return undefined;
  return { codes, claimLifetimeHours };
};

export const rewardCodeDocumentId = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const existingRewardOutcome = (input: unknown): RewardOutcome | undefined => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const candidate = input as Record<string, unknown>;
  if (!['claimed', 'exhausted', 'expired', 'revoked'].includes(String(candidate.status ?? ''))
    || typeof candidate.resolvedAt !== 'string') return undefined;
  return {
    status: candidate.status as RewardOutcomeStatus,
    resolvedAt: candidate.resolvedAt,
    ...(typeof candidate.claimId === 'string' ? { claimId: candidate.claimId } : {}),
    ...(typeof candidate.expiresAt === 'string' ? { expiresAt: candidate.expiresAt } : {}),
  };
};

interface RewardPolicy {
  status: 'active' | 'revoked';
  expiresAt?: string;
  claimLifetimeHours: number;
}

export const rewardPolicy = (input: unknown): RewardPolicy | undefined => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
  const candidate = input as Record<string, unknown>;
  if (!['active', 'revoked'].includes(String(candidate.status ?? ''))) return undefined;
  const claimLifetimeHours = candidate.claimLifetimeHours === undefined
    ? defaultClaimLifetimeHours
    : Number(candidate.claimLifetimeHours);
  if (!Number.isSafeInteger(claimLifetimeHours) || claimLifetimeHours < 1 || claimLifetimeHours > 168) return undefined;
  if (candidate.expiresAt !== undefined
    && (typeof candidate.expiresAt !== 'string' || !Number.isFinite(Date.parse(candidate.expiresAt)))) return undefined;
  const expiresAt = candidate.expiresAt as string | undefined;
  return {
    status: candidate.status as RewardPolicy['status'],
    claimLifetimeHours,
    ...(expiresAt ? { expiresAt } : {}),
  };
};

const availableRewardCode = (
  documents: FirebaseFirestore.QueryDocumentSnapshot[],
  now: Date,
): { document: FirebaseFirestore.QueryDocumentSnapshot; value: string } | { hasExpiredCode: boolean } => {
  let hasExpiredCode = false;
  for (const document of documents) {
    const data = document.data();
    const value = typeof data.value === 'string' ? data.value.trim() : '';
    const expiresAt = typeof data.expiresAt === 'string' && Number.isFinite(Date.parse(data.expiresAt))
      ? data.expiresAt
      : undefined;
    if (expiresAt && Date.parse(expiresAt) <= now.getTime()) {
      hasExpiredCode = true;
      continue;
    }
    if (value && value.length <= maxRewardCodeLength) return { document, value };
  }
  return { hasExpiredCode };
};

export const claimRewardForSuccessfulTransition = async ({
  transaction,
  aggregateRef,
  checkRef,
  checkData,
  nextStatus,
  now = new Date(),
}: {
  transaction: Transaction;
  aggregateRef: DocumentReference;
  checkRef: DocumentReference;
  checkData: DocumentData;
  nextStatus: string;
  now?: Date;
}): Promise<RewardOutcome | undefined> => {
  if (!finalSuccessStatuses.has(nextStatus) || !checkData.routineId) return undefined;
  const existingOutcome = existingRewardOutcome(checkData.reward);
  if (existingOutcome) return existingOutcome;
  const routineId = String(checkData.routineId);
  const policyRef = aggregateRef.collection('rewardPolicies').doc(routineId);
  const claimRef = aggregateRef.collection('rewardClaims').doc(checkRef.id);
  const [policySnapshot, existingClaim] = await Promise.all([
    transaction.get(policyRef),
    transaction.get(claimRef),
  ]);
  if (existingClaim.exists) {
    const data = existingClaim.data() ?? {};
    return {
      status: 'claimed',
      resolvedAt: String(data.claimedAt ?? now.toISOString()),
      claimId: claimRef.id,
      ...(typeof data.expiresAt === 'string' ? { expiresAt: data.expiresAt } : {}),
    };
  }
  if (!policySnapshot.exists) return undefined;
  const policy = rewardPolicy(policySnapshot.data());
  const resolvedAt = now.toISOString();
  if (!policy || policy.status === 'revoked') return { status: 'revoked', resolvedAt };
  if (policy.expiresAt && Date.parse(policy.expiresAt) <= now.getTime()) return { status: 'expired', resolvedAt };

  const availableCodes = await transaction.get(policyRef.collection('rewardCodes')
    .where('status', '==', 'available')
    .orderBy(FieldPath.documentId())
    .limit(maxRewardCodesPerPolicy));
  const selected = availableRewardCode(availableCodes.docs, now);
  if ('hasExpiredCode' in selected) {
    return { status: selected.hasExpiredCode ? 'expired' : 'exhausted', resolvedAt };
  }

  const expiresAt = new Date(now.getTime() + policy.claimLifetimeHours * 3_600_000).toISOString();
  transaction.create(claimRef, {
    checkId: checkRef.id,
    routineId,
    codeId: selected.document.id,
    value: selected.value,
    claimedAt: resolvedAt,
    expiresAt,
  });
  transaction.update(selected.document.ref, {
    status: 'claimed',
    claimedByCheckId: checkRef.id,
    claimedAt: resolvedAt,
    value: FieldValue.delete(),
  });
  return { status: 'claimed', resolvedAt, claimId: claimRef.id, expiresAt };
};

export const finalizeCheckWithReward = async (
  db: Firestore,
  aggregatePath: string,
  checkId: string,
  nextStatus: string,
  now = new Date(),
) => db.runTransaction(async (transaction) => {
  const aggregateRef = db.doc(aggregatePath);
  const checkRef = aggregateRef.collection('checks').doc(checkId);
  const check = await transaction.get(checkRef);
  if (!check.exists) throw new Error('check_not_found');
  const outcome = await claimRewardForSuccessfulTransition({
    transaction,
    aggregateRef,
    checkRef,
    checkData: check.data() ?? {},
    nextStatus,
    now,
  });
  transaction.update(checkRef, {
    status: nextStatus,
    ...(outcome ? { reward: outcome } : {}),
  });
  return outcome;
});

export const cleanupExpiredRewardSecrets = async (
  db: Firestore,
  now = new Date(),
  limit = 200,
) => {
  const cutoff = expiredRewardSecretCutoff(now);
  const [claims, codes] = await Promise.all([
    db.collectionGroup('rewardClaims').where('expiresAt', '<', cutoff).limit(limit).get(),
    db.collectionGroup('rewardCodes').where('expiresAt', '<', cutoff).limit(limit).get(),
  ]);
  const expired = [...claims.docs, ...codes.docs];
  if (!expired.length) return 0;
  const batch = db.batch();
  expired.forEach((document) => batch.delete(document.ref));
  await batch.commit();
  return expired.length;
};

export const deleteRoutineRewardSecrets = async (
  db: Firestore,
  aggregatePath: string,
  routineId: string,
) => {
  const aggregateRef = db.doc(aggregatePath);
  const policyRef = aggregateRef.collection('rewardPolicies').doc(routineId);
  const claims = await aggregateRef.collection('rewardClaims').where('routineId', '==', routineId).get();
  await Promise.all([
    db.recursiveDelete(policyRef),
    ...claims.docs.map((claim) => claim.ref.delete()),
  ]);
  return claims.size;
};
