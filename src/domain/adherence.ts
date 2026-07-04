import type { VerificationEvent } from './models';

const finalStatuses = new Set([
  'detected',
  'not_detected',
  'uncertain',
  'missed',
  'expired',
]);

export function adherenceSummary(events: VerificationEvent[]) {
  const completed = events.filter((event) => finalStatuses.has(event.status));
  const successful = completed.filter((event) => event.status === 'detected');
  const attention = completed.filter((event) => event.status !== 'detected');
  const statusCounts = completed.reduce<Record<string, number>>((counts, event) => ({
    ...counts,
    [event.status]: (counts[event.status] ?? 0) + 1,
  }), {});
  return {
    completed: completed.length,
    successful: successful.length,
    attention: attention.length,
    statusCounts,
    rate: completed.length === 0 ? 0 : successful.length / completed.length,
  };
}

export function isFreshCapture(
  event: VerificationEvent,
  capturedAt: Date,
  now = new Date(),
) {
  const requestedAt = new Date(event.requestedAt);
  const expiresAt = new Date(event.expiresAt);
  const isNewSubmission = event.status === 'pending' && !event.capturedAt;
  const isRetake = ['not_detected', 'uncertain'].includes(event.status) && Boolean(event.capturedAt);
  return (
    capturedAt >= requestedAt &&
    capturedAt <= now &&
    now <= expiresAt &&
    (isNewSubmission || isRetake)
  );
}

export function canRetakeCapture(
  event: VerificationEvent,
  events: VerificationEvent[] = [],
  now = new Date(),
) {
  if (!['not_detected', 'uncertain'].includes(event.status) || !event.capturedAt) return false;
  const requestedAt = Date.parse(event.requestedAt);
  const expiresAt = Date.parse(event.expiresAt);
  const nowTime = now.getTime();
  const nextRoutineCheck = events
    .filter((candidate) => candidate.routineId === event.routineId && Date.parse(candidate.requestedAt) > requestedAt)
    .sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt))[0];
  const nextCheckAt = nextRoutineCheck ? Date.parse(nextRoutineCheck.requestedAt) : undefined;
  const retryUntil = nextCheckAt ? Math.min(expiresAt, nextCheckAt) : expiresAt;
  if (!Number.isFinite(retryUntil)) return false;
  return nextCheckAt && nextCheckAt <= expiresAt ? nowTime < retryUntil : nowTime <= retryUntil;
}
