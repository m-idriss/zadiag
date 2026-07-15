import type { Role, VerificationEvent } from './models';

export type AppNotificationKind = 'check_ready' | 'retry' | 'missed' | 'review';

export interface AppNotification {
  id: string;
  kind: AppNotificationKind;
  event: VerificationEvent;
  timestamp: string;
}

const eventTimestamp = (event: VerificationEvent) => event.capturedAt ?? event.requestedAt;

export const notificationsForEvents = (
  role: Role,
  events: VerificationEvent[],
  now = Date.now(),
): AppNotification[] => {
  const oldestTimestamp = now - 30 * 86_400_000;
  return events.flatMap((event): AppNotification[] => {
    const timestamp = eventTimestamp(event);
    const eventTime = Date.parse(timestamp);
    if (!Number.isFinite(eventTime) || eventTime < oldestTimestamp) return [];
    let kind: AppNotificationKind | undefined;
    if (role === 'parent') {
      if (event.status === 'uncertain' && !['approved', 'rejected'].includes(event.reviewStatus ?? '')) kind = 'review';
      else if (event.status === 'missed' || event.status === 'expired') kind = 'missed';
    } else if (event.status === 'pending' && Date.parse(event.expiresAt) > now) {
      kind = 'check_ready';
    } else if (event.status === 'not_detected' || event.status === 'uncertain') {
      kind = 'retry';
    } else if (event.status === 'missed' || event.status === 'expired') {
      kind = 'missed';
    }
    return kind ? [{ id: `${kind}:${event.id}`, kind, event, timestamp }] : [];
  }).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 50);
};
