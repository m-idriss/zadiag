import { useMemo, useState } from 'react';
import type { Locale, RoutineAssignment, VerificationEvent, VerificationStatus } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { presentRoutine } from '../domain/routinePresentation';
import { AppIcon, routineIconName } from './Icon';
import { StatusPill } from './StatusPill';
import { canRetakeCapture, stalePendingCheckReason, withResolvedEventStatuses } from '../domain/adherence';
import { EmptyState, ListRow } from './ui';

const eventTimestamp = (event: VerificationEvent) =>
  Date.parse(event.capturedAt ?? event.requestedAt);

const hiddenReasonCodes = new Set(['analysis_unavailable', 'self_validated']);

const displayReason = (reason?: string) =>
  reason && !hiddenReasonCodes.has(reason) ? reason : undefined;

const analysisTag = (event: VerificationEvent, locale: Locale) => {
  if (event.analysisSource === 'ai') return locale === 'fr' ? 'IA' : 'AI';
  if (event.analysisSource === 'self' || event.reason === 'self_validated') return 'Auto';
  return undefined;
};

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
  onRequestCheck,
  t,
}: {
  assignments: RoutineAssignment[];
  events: VerificationEvent[];
  locale: Locale;
  titleId?: string;
  retryEvents?: VerificationEvent[];
  onRetake?: (event: VerificationEvent) => void;
  onRequestCheck?: (routineId: string) => Promise<void>;
  t: (key: MessageKey) => string;
}) {
  const [statusFilters, setStatusFilters] = useState<VerificationStatus[]>([]);
  const [routineFilters, setRoutineFilters] = useState<string[]>([]);
  const [requestingEventId, setRequestingEventId] = useState<string>();
  const [hiddenRequestEventIds, setHiddenRequestEventIds] = useState<Record<string, string>>({});
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
  const latestMissedEventIds = useMemo(() => {
    const ids = new Set<string>();
    const seenRoutineIds = new Set<string>();
    sortedEvents.forEach((event) => {
      if (seenRoutineIds.has(event.routineId)) return;
      seenRoutineIds.add(event.routineId);
      if (event.status === 'missed') ids.add(event.id);
    });
    return ids;
  }, [sortedEvents]);
  const statuses = useMemo<VerificationStatus[]>(
    () => Array.from(new Set(sortedEvents.map((event) => event.status))),
    [sortedEvents],
  );
  const toggleRoutineFilter = (routineId: string) => {
    setRoutineFilters((current) =>
      current.includes(routineId)
        ? current.filter((item) => item !== routineId)
        : [...current, routineId]);
  };
  const toggleStatusFilter = (status: VerificationStatus) => {
    setStatusFilters((current) =>
      current.includes(status)
        ? current.filter((item) => item !== status)
        : [...current, status]);
  };
  const filtered = sortedEvents.filter((event) =>
    (statusFilters.length === 0 || statusFilters.includes(event.status))
    && (routineFilters.length === 0 || routineFilters.includes(event.routineId))
  );
  const presentationFor = (event: VerificationEvent) => {
    const assignment = assignments.find((item) => item.routineId === event.routineId);
    return assignment ? presentRoutine(assignment.routine, locale) : undefined;
  };
  const requestCheck = async (event: VerificationEvent) => {
    if (!onRequestCheck || requestingEventId) return;
    setRequestingEventId(event.id);
    setHiddenRequestEventIds((current) => ({ ...current, [event.routineId]: event.id }));
    try {
      await onRequestCheck(event.routineId);
    } catch (error) {
      console.error(error);
      setHiddenRequestEventIds((current) => {
        if (current[event.routineId] !== event.id) return current;
        const next = { ...current };
        delete next[event.routineId];
        return next;
      });
    } finally {
      setRequestingEventId(undefined);
    }
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
                {assignments.map((assignment) => {
                  const visual = presentRoutine(assignment.routine, locale);
                  const active = routineFilters.includes(assignment.routineId);
                  return <button type="button" key={assignment.id} aria-pressed={active} className={active ? 'active' : ''} onClick={() => toggleRoutineFilter(assignment.routineId)}>{visual.name}</button>;
                })}
              </div>
            </div>
            <div className="filter-group">
              <span>{t('filterByStatus')}</span>
              <div className="filter-chips">
                {statuses.map((status) => {
                  const active = statusFilters.includes(status);
                  return <button type="button" key={status} aria-pressed={active} className={`filter-status-${status} ${active ? 'active' : ''}`} onClick={() => toggleStatusFilter(status)}>{t(statusLabelKey(status))}</button>;
                })}
              </div>
            </div>
          </section>

          <div className="section-heading history-results-heading"><h2>{t('historyResults')}</h2><span>{filtered.length}</span></div>
          <div className="history-list parent-history-list">
            {filtered.map((event) => {
              const visual = presentationFor(event);
              const canRetake = Boolean(onRetake) && canRetakeCapture(event, retryEvents ?? events, new Date());
              const canRequestCheck = Boolean(onRequestCheck)
                && latestMissedEventIds.has(event.id)
                && hiddenRequestEventIds[event.routineId] !== event.id;
              const reason = displayReason(event.reason);
              const staleReason = stalePendingCheckReason(events.find((item) => item.id === event.id) ?? event, assignments);
              const staleHint = staleReason === 'expired'
                ? t('staleCheckExpiredHint')
                : staleReason === 'orphaned'
                  ? t('staleCheckOrphanedHint')
                  : undefined;
              const tag = analysisTag(event, locale);
              return (
                <ListRow
                  as="section"
                  className="card history-row parent-history-row"
                  variant="bare"
                  icon={<AppIcon name={routineIconName(visual?.icon)} />}
                  iconClassName="history-icon routine-history-icon"
                  title={visual?.name ?? t('routine')}
                  detail={(
                    <>
                      {formatDateTime(event.requestedAt)}
                      {tag ? <span className="history-analysis-tag">{tag}</span> : null}
                      {reason ? ` · ${reason}` : ''}
                      {staleHint ? <span className="history-stale-hint"> · {staleHint}</span> : null}
                    </>
                  )}
                  style={visual?.style}
                  trailing={(
                    <div className="history-row-actions">
                      <StatusPill status={event.status} t={t} />
                      {canRequestCheck ? (
                        <button
                          type="button"
                          className="history-reminder-button"
                          aria-label={t('requestCheckAgain')}
                          disabled={requestingEventId === event.id}
                          onClick={() => { void requestCheck(event); }}
                        >
                          <AppIcon name="send" />
                        </button>
                      ) : null}
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
