const oneHourMs = 60 * 60 * 1000;
const oneDayMs = 24 * oneHourMs;

interface StaleCleanupCutoffs {
  expiredBefore: string;
  consumedBefore: string;
  recoveryAttemptBefore: string;
  pendingCheckExpiredBefore: string;
}

export const staleCleanupCutoffs = (now = new Date()): StaleCleanupCutoffs => ({
  expiredBefore: now.toISOString(),
  consumedBefore: new Date(now.getTime() - oneDayMs).toISOString(),
  recoveryAttemptBefore: new Date(now.getTime() - oneDayMs).toISOString(),
  pendingCheckExpiredBefore: new Date(now.getTime() - oneHourMs).toISOString(),
});

export const expiredPendingCheckCleanupUpdate = (now = new Date()) => ({
  status: 'missed',
  missedReason: 'expired_pending_cleanup',
  updatedAt: now.toISOString(),
});

export const shouldDeleteProofAfterReview = (decision: string) =>
  decision === 'detected' || decision === 'not_detected';
