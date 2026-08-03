import { useMemo, useState, type CSSProperties } from 'react';
import type { Locale, RoutineAssignment, VerificationEvent, VerificationStatus } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { presentRoutine } from '../domain/routinePresentation';
import { AppIcon, routineIconName } from './Icon';
import { StatusPill } from './StatusPill';
import { canRetakeCapture, stalePendingCheckReason, withResolvedEventStatuses } from '../domain/adherence';
import { coalesceActivePendingEventsByRoutine } from '../domain/dashboardChecks';
import { EmptyState, ListRow } from './ui';
import { languageTag } from '../services/locale';
import { UpcomingCheckActionMenu } from './UpcomingCheckActionMenu';

const eventTimestamp = (event: VerificationEvent) =>
  Date.parse(event.submittedAt ?? event.capturedAt ?? event.requestedAt);

const historyStatusPriority: Record<VerificationStatus, number> = {
  uncertain: 0,
  not_detected: 0,
  pending: 1,
  analyzing: 1,
  detected: 2,
  answered: 2,
  missed: 2,
  expired: 2,
  cancelled: 2,
  skipped: 2,
};

export const compareHistoryEvents = (left: VerificationEvent, right: VerificationEvent) =>
  historyStatusPriority[left.status] - historyStatusPriority[right.status]
  || eventTimestamp(right) - eventTimestamp(left);

const hiddenReasonCodes = new Set(['analysis_unavailable', 'self_validated']);

const displayReason = (reason?: string) =>
  reason && !hiddenReasonCodes.has(reason) ? reason : undefined;

const analysisTag = (event: VerificationEvent, locale: Locale) => {
  if (event.analysisSource === 'ai') return locale === 'fr' ? 'IA' : 'AI';
  if (event.analysisSource === 'self' || event.reason === 'self_validated') return 'Auto';
  return undefined;
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
  onCancelCheck,
  canManageCheck,
  participants,
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
  onRequestCheck?: (routineId: string, event?: VerificationEvent) => Promise<void>;
  onCancelCheck?: (eventId: string, event?: VerificationEvent) => Promise<void>;
  canManageCheck?: (event: VerificationEvent) => boolean;
  participants?: Array<{ id: string; displayName: string; profileColor: string }>;
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
    () => [...displayEvents].sort(compareHistoryEvents),
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
              const isActive = event.status === 'pending' && Date.parse(event.expiresAt) > now;
              const canManageActiveCheck = isActive && (canManageCheck?.(event) ?? true);
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
                  className={`card history-row parent-history-row${participantColor ? ' has-participant-accent' : ''}${onOpenEvent ? ' history-row-clickable' : ''}${canManageActiveCheck && (onRequestCheck || onCancelCheck) ? ' history-row-has-menu' : ''}`}
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
                      {canManageActiveCheck && (onRequestCheck || onCancelCheck) ? (
                        <UpcomingCheckActionMenu
                          actionId={`history:${event.id}`}
                          actionLabel={t('checkActions')}
                          routineId={event.routineId}
                          routineName={visual?.name ?? t('routine')}
                          plannedStart={new Date(event.requestedAt)}
                          plannedEnd={new Date(event.expiresAt)}
                          eventId={event.id}
                          onRequest={onRequestCheck ? (routineId) => onRequestCheck(routineId, event) : undefined}
                          onCancel={onCancelCheck ? (eventId) => onCancelCheck(eventId, event) : undefined}
                          t={t}
                        />
                      ) : null}
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
