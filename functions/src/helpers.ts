import { createHash, randomInt } from 'node:crypto';

export const normalizeLinkCode = (code: string) => code.trim().toUpperCase();

export const hashLinkCode = (code: string) => createHash('sha256')
  .update(normalizeLinkCode(code))
  .digest('hex');

export const createLinkCode = () => `ZD-${randomInt(100000, 1000000)}`;
export const createRecoveryCode = () => `PR-${randomInt(100000, 1000000)}`;

export const assertChildName = (value: unknown) => {
  if (typeof value !== 'string') throw new Error('invalid_child_name');
  const childName = value.trim();
  if (childName.length < 1 || childName.length > 40) throw new Error('invalid_child_name');
  return childName;
};

export const isFreshCheckSubmission = (
  check: { status?: unknown; requestedAt?: unknown; expiresAt?: unknown; capturedAt?: unknown },
  capturedAt: unknown,
  now = Date.now(),
) => {
  const requestedAtMs = Date.parse(String(check.requestedAt ?? ''));
  const expiresAtMs = Date.parse(String(check.expiresAt ?? ''));
  const capturedAtMs = Date.parse(String(capturedAt ?? ''));
  const isNewSubmission = check.status === 'pending' && !check.capturedAt;
  const isLegacySubmission = check.status === 'analyzing' && String(check.capturedAt) === String(capturedAt);
  return (isNewSubmission || isLegacySubmission)
    && Number.isFinite(requestedAtMs)
    && Number.isFinite(expiresAtMs)
    && Number.isFinite(capturedAtMs)
    && capturedAtMs >= requestedAtMs
    && capturedAtMs <= now + 30_000
    && now <= expiresAtMs;
};
