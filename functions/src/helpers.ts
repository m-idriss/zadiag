import { createHash, randomInt } from 'node:crypto';

const retakeWindowMs = 15 * 60_000;
const sensitiveCodeAttemptWindowMs = 15 * 60_000;

export const normalizeLinkCode = (code: string) => code.trim().toUpperCase();

export const isFirestoreDocumentId = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) return false;
  if (value === '.' || value === '..' || value.includes('/')) return false;
  return Buffer.byteLength(value, 'utf8') <= 1_500;
};

export const sensitiveCodeAttemptState = (
  value: { windowStartedAt?: unknown; attempts?: unknown } | undefined,
  now = Date.now(),
) => {
  const windowStartedAtMs = Date.parse(String(value?.windowStartedAt ?? ''));
  const inWindow = Number.isFinite(windowStartedAtMs)
    && now >= windowStartedAtMs
    && now - windowStartedAtMs < sensitiveCodeAttemptWindowMs;
  const attempts = inWindow && Number.isFinite(Number(value?.attempts))
    ? Math.max(0, Math.floor(Number(value?.attempts)))
    : 0;
  return {
    blocked: attempts >= 5,
    attempts: attempts + 1,
    windowStartedAt: inWindow ? String(value?.windowStartedAt) : new Date(now).toISOString(),
  };
};

export const hashLinkCode = (code: string) => createHash('sha256')
  .update(normalizeLinkCode(code))
  .digest('hex');

export const createLinkCode = () => `ZD-${randomInt(100000, 1000000)}`;
export const createRelationshipInvitationCode = () => `ZI-${randomInt(100000, 1000000)}`;
export const isRelationshipInvitationCode = (code: string) => /^ZI-\d{6}$/.test(normalizeLinkCode(code));
const recoveryAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const createRecoveryCode = () => {
  const token = Array.from({ length: 12 }, () => recoveryAlphabet[randomInt(0, recoveryAlphabet.length)]).join('');
  return `PR-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8)}`;
};

export const isRecoveryCode = (code: string) => /^PR-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/.test(normalizeLinkCode(code));
export const isLegacyRecoveryCode = (code: string) => /^PR-\d{6}$/.test(normalizeLinkCode(code));

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
  const isRetakeSubmission = ['not_detected', 'uncertain'].includes(String(check.status)) && Boolean(check.capturedAt);
  const firstCapturedAtMs = Date.parse(String(check.capturedAt ?? ''));
  const retakeExpiresAtMs = firstCapturedAtMs + retakeWindowMs;
  return (isNewSubmission || isLegacySubmission || isRetakeSubmission)
    && Number.isFinite(requestedAtMs)
    && Number.isFinite(expiresAtMs)
    && Number.isFinite(capturedAtMs)
    && capturedAtMs >= requestedAtMs
    && (!isRetakeSubmission || (
      Number.isFinite(firstCapturedAtMs)
      && capturedAtMs >= firstCapturedAtMs
      && now <= retakeExpiresAtMs
    ))
    && capturedAtMs <= now + 30_000
    && now <= expiresAtMs;
};
