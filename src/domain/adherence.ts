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
  return {
    completed: completed.length,
    successful: successful.length,
    attention: attention.length,
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
  return (
    capturedAt >= requestedAt &&
    capturedAt <= now &&
    now <= expiresAt &&
    event.status === 'pending' &&
    !event.capturedAt
  );
}
