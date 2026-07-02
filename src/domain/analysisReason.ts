import type { MessageKey } from '../services/i18n';

export const formatAnalysisReason = (
  reason: string | undefined,
  t: (key: MessageKey) => string,
) => {
  if (!reason) return undefined;
  if (reason === 'analysis_unavailable') return t('analysisUnavailable');
  return reason;
};
