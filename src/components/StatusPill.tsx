import type { VerificationStatus } from '../domain/models';
import type { MessageKey } from '../services/i18n';

export const statusMessageKey = (status: VerificationStatus): MessageKey => {
  if (status === 'detected') return 'validated';
  if (status === 'answered') return 'answered';
  if (status === 'not_detected') return 'notDetected';
  if (status === 'uncertain') return 'uncertain';
  if (status === 'missed') return 'missed';
  if (status === 'pending') return 'pending';
  if (status === 'analyzing') return 'analyzing';
  return 'expired';
};

export function StatusPill({
  status,
  t,
}: {
  status: VerificationStatus;
  t: (key: MessageKey) => string;
}) {
  const label = t(statusMessageKey(status));
  return <span className={`status-pill status-${status}`}>{label}</span>;
}
