const checkRequestCooldownMs = 10_000;

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
