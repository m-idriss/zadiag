export interface ReminderDecisionInput {
  requestedAt?: string;
  expiresAt?: string;
  lastReminderAt?: string;
  repeatMinutes: number;
  now: Date;
}

const allowedReminderRepeatMinutes = new Set([0, 20, 30]);

export const normalizeReminderRepeatMinutes = (value: unknown, fallback = 20) => {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return fallback;
  if (allowedReminderRepeatMinutes.has(minutes)) return minutes;
  return fallback;
};

export const shouldSendCheckReminder = ({
  requestedAt,
  expiresAt,
  lastReminderAt,
  repeatMinutes,
  now,
}: ReminderDecisionInput) => {
  if (repeatMinutes <= 0) return false;
  const requestedAtMs = Date.parse(String(requestedAt ?? ''));
  const expiresAtMs = Date.parse(String(expiresAt ?? ''));
  if (!Number.isFinite(requestedAtMs) || !Number.isFinite(expiresAtMs)) return false;
  if (now.getTime() >= expiresAtMs) return false;

  const lastReminderAtMs = Date.parse(String(lastReminderAt ?? ''));
  const baseline = Number.isFinite(lastReminderAtMs) ? lastReminderAtMs : requestedAtMs;
  return now.getTime() - baseline >= repeatMinutes * 60 * 1000;
};
