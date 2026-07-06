import { useMemo } from 'react';
import type { AppState, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { presentRoutine } from '../domain/routinePresentation';
import { AppIcon, type AppIconName } from './Icon';

const eventTime = (event: VerificationEvent) =>
  Date.parse(event.capturedAt ?? event.reviewedAt ?? event.requestedAt);

const statusMessageKey = (event: VerificationEvent, now: number): MessageKey => {
  if (event.status === 'pending' && Date.parse(event.expiresAt) > now) return 'activityProofRequested';
  if (event.status === 'pending') return 'activityProofExpired';
  if (event.status === 'analyzing') return 'activityProofAnalyzing';
  if (event.status === 'uncertain' && !['approved', 'rejected'].includes(event.reviewStatus ?? '')) return 'activityProofReviewNeeded';
  if (event.status === 'detected') return event.reviewStatus === 'approved' ? 'activityProofApproved' : 'activityProofValidated';
  if (event.status === 'not_detected') return event.reviewStatus === 'rejected' ? 'activityProofRejected' : 'activityProofMissing';
  if (event.status === 'missed' || event.status === 'expired') return 'activityProofExpired';
  return 'activityProofUpdated';
};

const statusIcon = (event: VerificationEvent, now: number): AppIconName => {
  if (event.status === 'pending' && Date.parse(event.expiresAt) > now) return 'notifications';
  if (event.status === 'uncertain') return 'time';
  if (event.status === 'detected') return 'check';
  if (event.status === 'not_detected') return 'close';
  return 'calendar';
};

export function ActivityLog({
  state,
  limit = 4,
  t,
}: {
  state: AppState;
  limit?: number;
  t: (key: MessageKey) => string;
}) {
  const now = Date.now();
  const formatterLocale = state.locale === 'fr' ? 'fr-FR' : 'en-US';
  const formatTime = (value: string) => new Intl.DateTimeFormat(formatterLocale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
  const entries = useMemo(() => [...state.events]
    .sort((a, b) => eventTime(b) - eventTime(a))
    .slice(0, limit)
    .map((event) => {
      const assignment = state.routineAssignments.find((item) => item.routineId === event.routineId);
      const routine = assignment ? presentRoutine(assignment.routine, state.locale).name : t('routine');
      return {
        event,
        routine,
        icon: statusIcon(event, now),
        message: t(statusMessageKey(event, now)).replace('{routine}', routine),
      };
    }), [limit, now, state.events, state.locale, state.routineAssignments, t]);

  return (
    <section className="activity-log" aria-labelledby="activity-log-title">
      <div className="section-heading activity-log-heading">
        <h2 id="activity-log-title">{t('activityLogTitle')}</h2>
      </div>
      {entries.length ? (
        <div className="card settings-list activity-log-list">
          {entries.map(({ event, icon, message }) => (
            <article className="settings-row activity-log-row" key={event.id}>
              <span className="settings-row-icon activity-log-icon" aria-hidden="true"><AppIcon name={icon} /></span>
              <div className="settings-row-copy">
                <strong>{message}</strong>
                <small>{formatTime(event.capturedAt ?? event.requestedAt)}</small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="card activity-log-empty">
          <AppIcon name="time" />
          <div className="settings-row-copy">
            <h2>{t('activityLogEmptyTitle')}</h2>
            <p>{t('activityLogEmptyHint')}</p>
          </div>
        </section>
      )}
    </section>
  );
}
