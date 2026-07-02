import type { VerificationStatus } from '../domain/models';
import type { MessageKey } from '../services/i18n';

export function StatusPill({
  status,
  t,
}: {
  status: VerificationStatus;
  t: (key: MessageKey) => string;
}) {
  const label = status === 'detected'
    ? t('elasticsVisible')
    : status === 'not_detected'
      ? t('notDetected')
    : status === 'uncertain'
      ? t('uncertain')
      : status === 'missed'
        ? t('missed')
        : status.replace('_', ' ');
  return <span className={`status-pill status-${status}`}>{label}</span>;
}
