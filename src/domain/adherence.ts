import type { RoutineAssignment, VerificationEvent } from './models';

const finalStatuses = new Set([
  'detected',
  'not_detected',
  'uncertain',
  'missed',
  'expired',
]);
const retakeWindowMs = 15 * 60_000;

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

export function resolvedEventStatus(event: VerificationEvent, now = Date.now()) {
  return event.status === 'pending' && Date.parse(event.expiresAt) <= now ? 'missed' : event.status;
}

export function withResolvedEventStatuses(events: VerificationEvent[], now = Date.now()) {
  return events.map((event) => {
    const status = resolvedEventStatus(event, now);
    return status === event.status ? event : { ...event, status };
  });
}

type StalePendingCheckReason = 'expired' | 'orphaned';

export function stalePendingCheckReason(
  event: VerificationEvent,
  assignments: Pick<RoutineAssignment, 'routineId'>[] = [],
  now = Date.now(),
): StalePendingCheckReason | undefined {
  if (event.status !== 'pending') return undefined;
  if (!assignments.some((assignment) => assignment.routineId === event.routineId)) return 'orphaned';
  return Date.parse(event.expiresAt) <= now ? 'expired' : undefined;
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
  const firstCapturedAt = event.capturedAt ? new Date(event.capturedAt) : undefined;
  const retakeExpiresAt = firstCapturedAt ? new Date(firstCapturedAt.getTime() + retakeWindowMs) : undefined;
  return (
    capturedAt >= requestedAt &&
    (!isRetake || (firstCapturedAt !== undefined && retakeExpiresAt !== undefined && capturedAt >= firstCapturedAt && now <= retakeExpiresAt)) &&
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
  const firstCapturedAt = Date.parse(event.capturedAt);
  const nowTime = now.getTime();
  if (!Number.isFinite(firstCapturedAt)) return false;
  if (nowTime < firstCapturedAt) return false;
  const nextRoutineCheck = events
    .filter((candidate) => candidate.routineId === event.routineId && Date.parse(candidate.requestedAt) > requestedAt)
    .sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt))[0];
  const nextCheckAt = nextRoutineCheck ? Date.parse(nextRoutineCheck.requestedAt) : undefined;
  const retakeExpiresAt = firstCapturedAt + retakeWindowMs;
  const retryUntil = nextCheckAt ? Math.min(expiresAt, nextCheckAt, retakeExpiresAt) : Math.min(expiresAt, retakeExpiresAt);
  if (!Number.isFinite(retryUntil)) return false;
  return nextCheckAt && nextCheckAt <= expiresAt ? nowTime < retryUntil : nowTime <= retryUntil;
}
