import { useMemo, useState } from 'react';
import type { Locale, RoutineAssignment, VerificationEvent, VerificationStatus } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { presentRoutine } from '../domain/routinePresentation';
import { AppIcon, routineIconName } from './Icon';
import { StatusPill } from './StatusPill';
import { canRetakeCapture, withResolvedEventStatuses } from '../domain/adherence';
import { EmptyState, ListRow } from './ui';

type StatusFilter = VerificationStatus | 'all';
type RoutineFilter = string | 'all';

const eventTimestamp = (event: VerificationEvent) =>
  Date.parse(event.capturedAt ?? event.requestedAt);

const statusLabelKey = (status: VerificationStatus): MessageKey => {
  if (status === 'detected') return 'validated';
  if (status === 'not_detected') return 'notDetected';
  if (status === 'uncertain') return 'uncertain';
  if (status === 'missed') return 'missed';
  if (status === 'pending') return 'pending';
  if (status === 'analyzing') return 'analyzing';
  return 'expired';
};

export function RoutineHistoryPanel({
  assignments,
  events,
  locale,
  titleId = 'routine-history-panel-title',
  retryEvents,
  onRetake,
  t,
}: {
  assignments: RoutineAssignment[];
  events: VerificationEvent[];
  locale: Locale;
  titleId?: string;
  retryEvents?: VerificationEvent[];
  onRetake?: (event: VerificationEvent) => void;
  t: (key: MessageKey) => string;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [routineFilter, setRoutineFilter] = useState<RoutineFilter>('all');
  const formatterLocale = locale === 'fr' ? 'fr-FR' : 'en-US';
  const displayEvents = useMemo(() => withResolvedEventStatuses(events), [events]);
  const formatDateTime = (value: string) => new Intl.DateTimeFormat(formatterLocale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
  const sortedEvents = useMemo(
    () => [...displayEvents].sort((a, b) => eventTimestamp(b) - eventTimestamp(a)),
    [displayEvents],
  );
  const statuses = useMemo<VerificationStatus[]>(
    () => Array.from(new Set(sortedEvents.map((event) => event.status))),
    [sortedEvents],
  );
  const filtered = sortedEvents.filter((event) =>
    (statusFilter === 'all' || event.status === statusFilter)
    && (routineFilter === 'all' || event.routineId === routineFilter)
  );
  const presentationFor = (event: VerificationEvent) => {
    const assignment = assignments.find((item) => item.routineId === event.routineId);
    return assignment ? presentRoutine(assignment.routine, locale) : undefined;
  };

  return (
    <section className="routine-history-panel" aria-labelledby={titleId}>
      <div className="section-heading parent-history-heading"><h2 id={titleId}>{t('recentHistory')}</h2></div>
      {sortedEvents.length ? (
        <>
          <section className="card history-filter-card" aria-label={t('historyFilters')}>
            <div className="filter-group">
              <span>{t('filterByRoutine')}</span>
              <div className="filter-chips">
                <button type="button" className={routineFilter === 'all' ? 'active' : ''} onClick={() => setRoutineFilter('all')}>{t('allRoutines')}</button>
                {assignments.map((assignment) => {
                  const visual = presentRoutine(assignment.routine, locale);
                  return <button type="button" key={assignment.id} className={routineFilter === assignment.routineId ? 'active' : ''} onClick={() => setRoutineFilter(assignment.routineId)}>{visual.name}</button>;
                })}
              </div>
            </div>
            <div className="filter-group">
              <span>{t('filterByStatus')}</span>
              <div className="filter-chips">
                <button type="button" className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>{t('allStatuses')}</button>
                {statuses.map((status) => <button type="button" key={status} className={`filter-status-${status} ${statusFilter === status ? 'active' : ''}`} onClick={() => setStatusFilter(status)}>{t(statusLabelKey(status))}</button>)}
              </div>
            </div>
          </section>

          <div className="section-heading history-results-heading"><h2>{t('historyResults')}</h2><span>{filtered.length}</span></div>
          <div className="history-list parent-history-list">
            {filtered.map((event) => {
              const visual = presentationFor(event);
              const canRetake = Boolean(onRetake) && canRetakeCapture(event, retryEvents ?? events, new Date());
              return (
                <ListRow
                  as="section"
                  className="card history-row parent-history-row"
                  variant="bare"
                  icon={<AppIcon name={routineIconName(visual?.icon)} />}
                  iconClassName="history-icon routine-history-icon"
                  title={visual?.name ?? t('routine')}
                  detail={`${formatDateTime(event.requestedAt)}${event.reason ? ` · ${event.reason}` : ''}`}
                  style={visual?.style}
                  trailing={(
                    <div className="history-row-actions">
                      <StatusPill status={event.status} t={t} />
                      {canRetake ? <button type="button" className="history-retake-button" onClick={() => onRetake?.(event)}>{t('retakeShort')}</button> : null}
                    </div>
                  )}
                  key={event.id}
                />
              );
            })}
            {!filtered.length && <p className="empty-state">{t('noHistoryMatches')}</p>}
          </div>
        </>
      ) : (
        <EmptyState icon="time" title={t('noHistoryYet')} detail={t('noHistoryYetHint')} />
      )}
    </section>
  );
}
