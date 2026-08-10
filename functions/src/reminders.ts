const checkRequestCooldownMs = 10_000;

export type PushRecipientRole = 'child' | 'parent';

export const pushRecipientRoles = (subscription: { roles?: unknown; role?: unknown } | undefined): PushRecipientRole[] => {
  if (Array.isArray(subscription?.roles)) {
    return subscription.roles.filter((role): role is PushRecipientRole => role === 'child' || role === 'parent');
  }
  return [subscription?.role === 'parent' ? 'parent' : 'child'];
};

export const hasParticipantPushRecipient = (
  subscriptions: Array<{ roles?: unknown; role?: unknown }>,
) => subscriptions.some((subscription) => pushRecipientRoles(subscription).includes('child'));

export const isCheckRequestRateLimited = (
  lastCheckRequestAt: unknown,
  now = Date.now(),
  cooldownMs = checkRequestCooldownMs,
) => {
  const lastRequestAtMs = Date.parse(String(lastCheckRequestAt ?? ''));
  return Number.isFinite(lastRequestAtMs)
    && lastRequestAtMs <= now
    && now - lastRequestAtMs < cooldownMs;
};
