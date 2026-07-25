import { useEffect, useMemo, useState, type CSSProperties } from 'react';
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

export function useHistoryFilters(titleId: string) {
  const [excludedStatuses, setExcludedStatuses] = useState<VerificationStatus[]>(() => readStoredFilters(titleId).statuses);
  const [excludedRoutineIds, setExcludedRoutineIds] = useState<string[]>(() => readStoredFilters(titleId).routineIds);
  useEffect(() => {
    writeUiStorageString(historyFilterStorageKey(titleId), JSON.stringify({
      statuses: excludedStatuses,
      routineIds: excludedRoutineIds,
    }));
  }, [excludedRoutineIds, excludedStatuses, titleId]);
  return {
    excludedStatuses,
    excludedRoutineIds,
    toggleRoutine: (routineId: string) => setExcludedRoutineIds((current) =>
      current.includes(routineId) ? current.filter((item) => item !== routineId) : [...current, routineId]),
    toggleStatuses: (statuses: VerificationStatus[]) => setExcludedStatuses((current) => {
      const allActive = statuses.every((status) => !current.includes(status));
      return allActive
        ? Array.from(new Set([...current, ...statuses]))
        : current.filter((status) => !statuses.includes(status));
    }),
  };
}

export function HistoryFilterControls({
  assignments,
  events,
  locale,
  excludedRoutineIds,
  excludedStatuses,
  onToggleRoutine,
  onToggleStatuses,
  t,
}: {
  assignments: RoutineAssignment[];
  events: VerificationEvent[];
  locale: Locale;
  excludedRoutineIds: string[];
  excludedStatuses: VerificationStatus[];
  onToggleRoutine: (routineId: string) => void;
  onToggleStatuses: (statuses: VerificationStatus[]) => void;
  t: (key: MessageKey) => string;
}) {
  const statuses = groupedVerificationStatuses(Array.from(new Set(
    withResolvedEventStatuses(coalesceActivePendingEventsByRoutine(events, Date.now()), Date.now())
      .map((event) => event.status),
  )));
  return (
    <div className="history-filter-controls">
      <div className="filter-group">
        <span>{t('filterByRoutine')}</span>
        <div className="filter-chips">
          {assignments.map((assignment) => {
            const visual = presentRoutine(assignment.routine, locale);
            const active = !excludedRoutineIds.includes(assignment.routineId);
            return <button type="button" key={assignment.id} aria-pressed={active} className={active ? 'active' : ''} onClick={() => onToggleRoutine(assignment.routineId)}>{visual.name}</button>;
          })}
        </div>
      </div>
      <div className="filter-group">
        <span>{t('filterByStatus')}</span>
        <div className="filter-chips">
          {statuses.map(({ status, eventStatuses }) => {
            const active = eventStatuses.every((eventStatus) => !excludedStatuses.includes(eventStatus));
            return <button type="button" key={status} aria-pressed={active} className={`filter-status-${status} ${active ? 'active' : ''}`} onClick={() => onToggleStatuses(eventStatuses)}>{t(statusMessageKey(status))}</button>;
          })}
        </div>
      </div>
    </div>
  );
}

export function RoutineHistoryPanel({
  assignments,
  events,
  locale,
  titleId = 'routine-history-panel-title',
  retryEvents,
  onRetake,
  onOpenEvent,
  onRequestCheck,
  participants,
  participantForEvent,
  colorForEvent,
  excludedParticipantIds = [],
  excludedRoutineIds,
  excludedStatuses,
  onToggleParticipant,
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
  participants?: Array<{ id: string; displayName: string; profileColor: string }>;
  participantForEvent?: (event: VerificationEvent) => { id: string; displayName: string; profileColor: string } | undefined;
  colorForEvent?: (event: VerificationEvent) => string | undefined;
  excludedParticipantIds?: string[];
  excludedRoutineIds: string[];
  excludedStatuses: VerificationStatus[];
  onToggleParticipant?: (participantId: string) => void;
  t: (key: MessageKey) => string;
}) {
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
  const excludedStatusSet = useMemo(() => new Set(excludedStatuses), [excludedStatuses]);
  const excludedRoutineIdSet = useMemo(() => new Set(excludedRoutineIds), [excludedRoutineIds]);
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

  if (!sortedEvents.length && !participants?.length) {
    return (
      <section className="routine-history-panel" aria-label={t('recentHistory')}>
        <EmptyState icon="time" title={t('noHistoryYet')} detail={t('noHistoryYetHint')} />
      </section>
    );
  }

  return (
    <section className="routine-history-panel" aria-label={t('recentHistory')}>
      {participants?.length && onToggleParticipant ? <section className="card history-filter-card participant-history-filter-card" aria-label={t('filterByParticipant')}>
        <div className="filter-group">
          <span>{t('filterByParticipant')}</span>
          <div className="filter-chips">
            {participants.map((participant) => {
              const active = !excludedParticipantIds.includes(participant.id);
              return <button type="button" key={participant.id} aria-pressed={active} className={`participant-filter-chip${active ? ' active' : ''}`} style={{ '--profile-color': participant.profileColor } as CSSProperties} onClick={() => onToggleParticipant(participant.id)}>{participant.displayName}</button>;
            })}
          </div>
        </div>
      </section> : null}

      <div className="section-heading history-results-heading"><h2>{t('historyResults')}</h2><span>{filtered.length}</span></div>
      <div className="history-list parent-history-list">
            {filtered.map((event) => {
              const visual = presentationFor(event);
              const participantColor = colorForEvent?.(event);
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
                  className={`card history-row parent-history-row${participantColor ? ' has-participant-accent' : ''}${onOpenEvent ? ' history-row-clickable' : ''}`}
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
                  style={{ ...visual?.style, ...(participantColor ? { '--history-participant-color': participantColor } : {}) } as CSSProperties}
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
    </section>
  );
}
