import { useEffect, useMemo, useState } from 'react';
import type { Locale, RoutineAssignment, VerificationEvent, VerificationStatus } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { presentRoutine } from '../domain/routinePresentation';
import { AppIcon, routineIconName } from './Icon';
import { StatusPill, statusMessageKey } from './StatusPill';
import { canRetakeCapture, isSuccessfulVerification, stalePendingCheckReason, withResolvedEventStatuses } from '../domain/adherence';
import { coalesceActivePendingEventsByRoutine } from '../domain/dashboardChecks';
import { EmptyState, ListRow } from './ui';
import { readUiStorageJson, writeUiStorageString } from '../services/uiStorage';
import { languageTag } from '../services/locale';

const eventTimestamp = (event: VerificationEvent) =>
  Date.parse(event.submittedAt ?? event.capturedAt ?? event.requestedAt);

const hiddenReasonCodes = new Set(['analysis_unavailable', 'self_validated']);

const displayReason = (reason?: string) =>
  reason && !hiddenReasonCodes.has(reason) ? reason : undefined;

const historyFilterStorageKey = (titleId: string) => `zadiag.historyFilters.${titleId}`;

const readStoredFilters = (titleId: string) => {
  const empty = { statuses: [] as VerificationStatus[], routineIds: [] as string[] };
  return readUiStorageJson(historyFilterStorageKey(titleId), empty, (value) => {
    const parsed = value as Partial<{ statuses: VerificationStatus[]; routineIds: string[] }>;
    return {
      statuses: Array.isArray(parsed.statuses) ? parsed.statuses : [],
      routineIds: Array.isArray(parsed.routineIds) ? parsed.routineIds : [],
    };
  });
};

const analysisTag = (event: VerificationEvent, locale: Locale) => {
  if (event.analysisSource === 'ai') return locale === 'fr' ? 'IA' : 'AI';
  if (event.analysisSource === 'self' || event.reason === 'self_validated') return 'Auto';
  return undefined;
};

export const groupedVerificationStatuses = (statuses: VerificationStatus[]) => {
  const groups = new Map<VerificationStatus, VerificationStatus[]>();
  statuses.forEach((eventStatus) => {
    const status = isSuccessfulVerification({ status: eventStatus }) ? 'detected' : eventStatus;
    groups.set(status, [...(groups.get(status) ?? []), eventStatus]);
  });
  return Array.from(groups, ([status, eventStatuses]) => ({ status, eventStatuses }));
};

export function RoutineHistoryPanel({
  assignments,
  events,
  locale,
  titleId = 'routine-history-panel-title',
  retryEvents,
  onRetake,
  onOpenEvent,
  onRequestCheck,
  t,
}: {
  assignments: RoutineAssignment[];
  events: VerificationEvent[];
  locale: Locale;
  titleId?: string;
  retryEvents?: VerificationEvent[];
  onRetake?: (event: VerificationEvent) => void;
  onOpenEvent?: (event: VerificationEvent) => void;
  onRequestCheck?: (routineId: string) => Promise<void>;
  t: (key: MessageKey) => string;
}) {
  const [excludedStatuses, setExcludedStatuses] = useState<VerificationStatus[]>(() => readStoredFilters(titleId).statuses);
  const [excludedRoutineIds, setExcludedRoutineIds] = useState<string[]>(() => readStoredFilters(titleId).routineIds);
  const [requestingEventId, setRequestingEventId] = useState<string>();
  const [hiddenRequestEventIds, setHiddenRequestEventIds] = useState<Record<string, string>>({});
  const formatterLocale = languageTag(locale);
  const now = Date.now();
  const dateTimeFormatter = useMemo(() => new Intl.DateTimeFormat(formatterLocale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }), [formatterLocale]);
  const displayEvents = useMemo(() =>
    withResolvedEventStatuses(coalesceActivePendingEventsByRoutine(events, now), now),
  [events, now]);
  const formatDateTime = (value: string) => dateTimeFormatter.format(new Date(value));
  const routinePresentationsById = useMemo(() => new Map(assignments.map((assignment) => [
    assignment.routineId,
    presentRoutine(assignment.routine, locale),
  ])), [assignments, locale]);
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
  const statusFilters = useMemo(
    () => groupedVerificationStatuses(Array.from(new Set(sortedEvents.map((event) => event.status)))),
    [sortedEvents],
  );
  const excludedStatusSet = useMemo(() => new Set(excludedStatuses), [excludedStatuses]);
  const excludedRoutineIdSet = useMemo(() => new Set(excludedRoutineIds), [excludedRoutineIds]);
  useEffect(() => {
    writeUiStorageString(historyFilterStorageKey(titleId), JSON.stringify({
      statuses: excludedStatuses,
      routineIds: excludedRoutineIds,
    }));
  }, [excludedRoutineIds, excludedStatuses, titleId]);
  const toggleRoutineFilter = (routineId: string) => {
    setExcludedRoutineIds((current) =>
      current.includes(routineId)
        ? current.filter((item) => item !== routineId)
        : [...current, routineId]);
  };
  const toggleStatusFilter = (eventStatuses: VerificationStatus[]) => {
    setExcludedStatuses((current) => {
      const allActive = eventStatuses.every((status) => !current.includes(status));
      return allActive
        ? Array.from(new Set([...current, ...eventStatuses]))
        : current.filter((status) => !eventStatuses.includes(status));
    });
  };
  const filtered = useMemo(() => sortedEvents.filter((event) =>
    !excludedStatusSet.has(event.status)
    && !excludedRoutineIdSet.has(event.routineId)
  ), [excludedRoutineIdSet, excludedStatusSet, sortedEvents]);
  const presentationFor = (event: VerificationEvent) => routinePresentationsById.get(event.routineId);
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
                  const active = !excludedRoutineIds.includes(assignment.routineId);
                  return <button type="button" key={assignment.id} aria-pressed={active} className={active ? 'active' : ''} onClick={() => toggleRoutineFilter(assignment.routineId)}>{visual.name}</button>;
                })}
              </div>
            </div>
            <div className="filter-group">
              <span>{t('filterByStatus')}</span>
              <div className="filter-chips">
                {statusFilters.map(({ status, eventStatuses }) => {
                  const active = eventStatuses.every((eventStatus) => !excludedStatuses.includes(eventStatus));
                  return <button type="button" key={status} aria-pressed={active} className={`filter-status-${status} ${active ? 'active' : ''}`} onClick={() => toggleStatusFilter(eventStatuses)}>{t(statusMessageKey(status))}</button>;
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
                  className={`card history-row parent-history-row${onOpenEvent ? ' history-row-clickable' : ''}`}
                  variant="bare"
                  icon={<AppIcon name={routineIconName(visual?.icon)} />}
                  iconClassName="history-icon routine-history-icon"
                  title={visual?.name ?? t('routine')}
                  detail={(
                    <>
                      {formatDateTime(event.requestedAt)}
                      {event.quizResult ? ` · ${Math.round(event.quizResult.score * 100)}%` : ''}
                      {tag ? <span className="history-analysis-tag">{tag}</span> : null}
                      {reason ? ` · ${reason}` : ''}
                      {staleHint ? <span className="history-stale-hint"> · {staleHint}</span> : null}
                    </>
                  )}
                  style={visual?.style}
                  trailing={(
                    <>
                    {onOpenEvent ? <button type="button" className="history-row-open-button" aria-label={`${t('historyDetailTitle')} · ${visual?.name ?? t('routine')} · ${formatDateTime(event.requestedAt)}`} onClick={() => onOpenEvent(event)} /> : null}
                    <div className="history-row-actions">
                      <StatusPill status={event.status} t={t} />
                      {canRequestCheck ? (
                        <button
                          type="button"
                          className="history-reminder-button"
                          aria-label={t('requestCheckAgain')}
                          aria-busy={requestingEventId === event.id}
                          disabled={requestingEventId === event.id}
                          onClick={() => { void requestCheck(event); }}
                        >
                          {requestingEventId === event.id ? <span className="button-spinner" aria-hidden="true" /> : <AppIcon name="send" />}
                        </button>
                      ) : null}
                      {canRetake ? <button type="button" className="history-retake-button" onClick={() => onRetake?.(event)}>{t('retakeShort')}</button> : null}
                    </div>
                    </>
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
