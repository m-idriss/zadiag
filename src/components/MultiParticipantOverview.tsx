import type { CSSProperties } from 'react';
import { adherenceSummary, isReviewableVerification, withResolvedEventStatuses } from '../domain/adherence';
import type { Locale, ParticipantNotificationSource, VerificationEvent } from '../domain/models';
import { eventsInSummaryRange } from '../domain/reporting';
import { profileColorFor } from '../domain/profileColor';
import type { MessageKey } from '../services/i18n';
import { languageTag } from '../services/locale';
import { AppIcon } from './Icon';
import { statusMessageKey } from './StatusPill';

const eventTime = (event: VerificationEvent) =>
  Date.parse(event.submittedAt ?? event.capturedAt ?? event.requestedAt);

export function MultiParticipantOverview({ sources, locale, now, onSelectParticipant, t }: {
  sources: ParticipantNotificationSource[];
  locale: Locale;
  now: number;
  onSelectParticipant: (participantId: string) => void;
  t: (key: MessageKey) => string;
}) {
  const summaries = sources.map((source) => {
    const events = withResolvedEventStatuses(source.events, now);
    const today = adherenceSummary(eventsInSummaryRange(events, 'day', now));
    const active = events.filter((event) => event.status === 'pending' && Date.parse(event.expiresAt) > now).length;
    const review = events.filter(isReviewableVerification).length;
    return { source, today, active, review };
  }).sort((left, right) => (
    (right.review + right.active) - (left.review + left.active)
    || left.source.participant.displayName.localeCompare(right.source.participant.displayName, languageTag(locale))
  ));
  const recent = sources.flatMap((source) => withResolvedEventStatuses(source.events, now).map((event) => ({ source, event })))
    .sort((left, right) => eventTime(right.event) - eventTime(left.event))
    .slice(0, 5);
  const dateFormatter = new Intl.DateTimeFormat(languageTag(locale), { dateStyle: 'short', timeStyle: 'short' });

  return (
    <section className="multi-participant-overview" aria-labelledby="multi-participant-title">
      <div className="section-heading"><h2 id="multi-participant-title">{t('allParticipantsOverview')}</h2></div>
      <div className="multi-participant-grid">
        {summaries.map(({ source, today, active, review }) => {
          const attention = active + review;
          return (
            <button
              type="button"
              className="card multi-participant-card"
              style={{ '--profile-color': profileColorFor(source.participant) } as CSSProperties}
              key={source.participant.id}
              onClick={() => onSelectParticipant(source.participant.id)}
            >
              <span className="multi-participant-avatar" aria-hidden="true">{source.participant.displayName.trim().charAt(0).toUpperCase() || '?'}</span>
              <span className="multi-participant-copy">
                <strong>{source.participant.displayName}</strong>
                <small>{today.completed ? `${today.successful}/${today.completed} ${t('multiParticipantSuccessfulToday')}` : t('multiParticipantNoChecksToday')}</small>
                <span className={attention ? 'attention' : 'clear'}>
                  {review ? `${review} ${t('dashboardReview').toLocaleLowerCase(languageTag(locale))}` : active ? `${active} ${t('dashboardActive').toLocaleLowerCase(languageTag(locale))}` : t('multiParticipantUpToDate')}
                </span>
              </span>
              <span className="multi-participant-rate">{today.completed ? `${Math.round(today.rate * 100)}%` : '—'}</span>
              <AppIcon name="chevron-forward" />
            </button>
          );
        })}
      </div>
      <div className="section-heading multi-participant-activity-heading"><h2>{t('multiParticipantRecentActivity')}</h2></div>
      {recent.length ? (
        <div className="card multi-participant-activity">
          {recent.map(({ source, event }) => (
            <button type="button" key={`${source.participant.id}:${event.id}`} onClick={() => onSelectParticipant(source.participant.id)}>
              <span className="multi-participant-activity-avatar" style={{ '--profile-color': profileColorFor(source.participant) } as CSSProperties} aria-hidden="true">{source.participant.displayName.trim().charAt(0).toUpperCase() || '?'}</span>
              <span><strong>{source.participant.displayName}</strong><small>{t(statusMessageKey(event.status))} · {dateFormatter.format(new Date(eventTime(event)))}</small></span>
              <AppIcon name="chevron-forward" />
            </button>
          ))}
        </div>
      ) : <p className="card multi-participant-empty">{t('multiParticipantNoActivity')}</p>}
    </section>
  );
}
