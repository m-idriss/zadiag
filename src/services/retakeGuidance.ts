import type { VerificationEvent } from '../domain/models';
import type { MessageKey } from './i18n';

const normalizedReason = (reason?: string) => reason
  ?.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase() ?? '';

export const retakeGuidanceMessageKey = (
  event: VerificationEvent,
  now = Date.now(),
): MessageKey => {
  if (['expired', 'missed'].includes(event.status) || Date.parse(event.expiresAt) <= now) {
    return 'retakeGuidanceExpired';
  }

  const reason = normalizedReason(event.reason);
  if (/(dark|sombre|lumi|eclair|glare|reflet)/.test(reason)) return 'retakeGuidanceLight';
  if (/(blur|flou|stable|stabil|nettet)/.test(reason)) return 'retakeGuidanceStability';
  if (/(crop|cadr|mouth|bouche|face|visage|context)/.test(reason)) return 'retakeGuidanceFraming';
  if (/(not visible|missing|absent|pas visible|non visible|introuvable)/.test(reason)) return 'retakeGuidanceMissing';
  if (event.status === 'not_detected') return 'retakeGuidanceMissing';
  return 'retakeGuidanceGeneric';
};
