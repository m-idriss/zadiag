import type { MessageKey } from '../services/i18n';
import type { Locale, VerificationStatus } from './models';

export const formatAnalysisReason = (
  status: VerificationStatus,
  reason: string | undefined,
  locale: Locale,
  t: (key: MessageKey) => string,
) => {
  if (!reason) return undefined;
  if (reason === 'analysis_unavailable') return t('analysisUnavailable');
  if (locale === 'fr' || locale === 'en') {
    if (status === 'detected') return t('analysisCommentDetected');
    if (status === 'not_detected') return t('analysisCommentNotDetected');
    if (status === 'uncertain') return t('analysisCommentUncertain');
  }
  return reason;
};
