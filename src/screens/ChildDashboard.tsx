import { useMemo, useState } from 'react';
import type { AppState, VerificationEvent } from '../domain/models';
import { formatMessage, type MessageKey } from '../services/i18n';
import { languageTag } from '../services/locale';
import { Disclaimer } from '../components/Disclaimer';
import { StatusPill } from '../components/StatusPill';
import { AppIcon, routineIconName } from '../components/Icon';
import { RoutineHistoryPanel } from '../components/RoutineHistoryPanel';
import { AdherenceSummaryCard, filterEventsBySummaryRange, type SummaryRange } from '../components/AdherenceSummaryCard';
import { presentRoutine } from '../domain/routinePresentation';
import { eventWindowLabel, plannedWindowLabel } from '../domain/taskTimeLabel';
import { canRetakeCapture, resolvedEventStatus, withResolvedEventStatuses } from '../domain/adherence';
import { upcomingRoutineChecks } from '../domain/dashboardChecks';
import { ProfileContextCard } from '../components/ProfileContextCard';
import { profileColorFor } from '../domain/profileColor';

const isToday = (value: string, now = new Date()) => {
  const date = new Date(value);
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
};

export function ChildDashboard({
  state,
  active,
  start,
  retake,
  summaryRange: controlledSummaryRange,
  onSummaryRangeChange,
  onOpenHistoryEvent,
  t,
}: {
  state: AppState;
  active?: VerificationEvent;
  start: (event: VerificationEvent) => void;
  retake?: (event: VerificationEvent) => void;
  summaryRange?: SummaryRange;
  onSummaryRangeChange?: (range: SummaryRange) => void;
  onOpenHistoryEvent?: (event: VerificationEvent) => void;
  t: (key: MessageKey) => string;
}) {
  const [localSummaryRange, setLocalSummaryRange] = useState<SummaryRange>('day');
  const summaryRange = controlledSummaryRange ?? localSummaryRange;
  const setSummaryRange = onSummaryRangeChange ?? setLocalSummaryRange;
  const now = Date.now();
  const nowDate = useMemo(() => new Date(now), [now]);
  const activeParticipantAccess = state.participantAccess?.find((entry) => entry.participant.id === state.activeParticipantId)
    ?? state.participantAccess?.find((entry) => entry.membership.status === 'active');
  const today = state.events.filter((event) => isToday(event.requestedAt));
  const pending = today.filter((event) => (
    event.status === 'analyzing'
    || (event.status === 'pending' && Date.parse(event.expiresAt) > now)
  ));
  const actionableCount = pending.length;
  const completed = state.events.filter((event) => (
    event.capturedAt !== undefined
    && isToday(event.capturedAt)
    && !['pending', 'analyzing'].includes(event.status)
  ));
  const attentionCompleted = completed
    .map((event) => ({
      event,
      canRetake: Boolean(retake) && canRetakeCapture(event, state.events, nowDate),
    }))
    .filter((entry) => entry.canRetake);
  const historyEvents = useMemo(
    () => withResolvedEventStatuses(state.events, now)
      .filter((event) => !['pending', 'analyzing'].includes(event.status)),
    [now, state.events],
  );
  const rangedHistoryEvents = useMemo(
    () => filterEventsBySummaryRange(historyEvents, summaryRange, now),
    [historyEvents, now, summaryRange],
  );
  const formatTime = (value: string) => new Intl.DateTimeFormat(languageTag(state.locale), {
    timeStyle: 'short',
  }).format(new Date(value));
  const locale = languageTag(state.locale);
  const presentations = new Map(state.routineAssignments.map((assignment) => [assignment.routineId, presentRoutine(assignment.routine, state.locale)]));
  const presentationFor = (event: VerificationEvent) => {
    return presentations.get(event.routineId) ?? { name: t('routine'), icon: undefined, style: {} };
  };
  const pendingGroups = Array.from(pending.reduce((groups, event) => {
    const group = groups.get(event.routineId) ?? [];
    group.push(event);
    groups.set(event.routineId, group);
    return groups;
  }, new Map<string, VerificationEvent[]>()).entries())
    .map(([routineId, events]) => ({
      routineId,
      events: events.sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt)),
    }))
    .sort((a, b) => {
      const aActive = a.events.some((event) => event.id === active?.id);
      const bActive = b.events.some((event) => event.id === active?.id);
      if (aActive !== bActive) return aActive ? -1 : 1;
      return Date.parse(a.events[0]?.expiresAt ?? '') - Date.parse(b.events[0]?.expiresAt ?? '');
    });
  const settledToday = withResolvedEventStatuses(today, now)
    .filter((event) => !['pending', 'analyzing'].includes(event.status));
  const missedTodayCount = settledToday.filter((event) => ['missed', 'expired'].includes(event.status)).length;
  const hasAttentionToday = settledToday.some((event) => event.status !== 'detected');
  const emptyTodayTitle = hasAttentionToday ? t('keepGoing') : t('niceWork');
  const emptyTodayHint = hasAttentionToday ? t('missedTodayHint') : t('nextCheckHint');
  const missedTodayLabel = missedTodayCount > 0
    ? formatMessage(t(missedTodayCount === 1 ? 'missedTodayCountOne' : 'missedTodayCountMany'), { count: missedTodayCount })
    : undefined;
  const upcomingChecks = useMemo(() => upcomingRoutineChecks(state.routineAssignments, nowDate)
    .map((item) => ({
      ...item,
      presentation: presentRoutine(item.assignment.routine, state.locale),
    })),
  [nowDate, state.locale, state.routineAssignments]);
  const pendingSection = (
    <section className="today-section" aria-labelledby="pending-tasks-title">
      <div className="today-pending-panel">
        <div className="section-heading today-panel-heading"><h2 id="pending-tasks-title">{actionableCount} {t(actionableCount === 1 ? 'checkToComplete' : 'checksToComplete')}</h2></div>
        <div className="today-task-list">
        {pendingGroups.map((group) => {
          const main = group.events.find((event) => event.id === active?.id) ?? group.events[0];
          const stacked = group.events.filter((event) => event.id !== main.id);
          const presentation = presentationFor(main);
          const actionable = main.status === 'pending' && Date.parse(main.expiresAt) > now;
          return (
            <article className={`today-task today-routine-card ${actionable ? 'actionable' : 'expired-only'}`} style={presentation.style} key={group.routineId}>
              <div className="today-routine-main">
                <div className="today-routine-primary">
                  <div className="today-task-copy">
                    <span className="settings-row-icon today-task-icon" aria-hidden="true"><AppIcon name={routineIconName(presentation.icon)} /></span>
                    <div>
                      <h3>{presentation.name}</h3>
                      <p className="today-task-time">{eventWindowLabel(main.requestedAt, main.expiresAt, nowDate, locale, t)}</p>
                    </div>
                  </div>
                  {actionable
                    ? <button type="button" className="primary-action-button today-proof-button" onClick={() => start(main)}><AppIcon name="camera" />{t('sendProofShort')}</button>
                    : <StatusPill status={resolvedEventStatus(main, now)} t={t} />}
                </div>
                {stacked.length > 0 && (
                  <div className="today-task-stack">
                    {stacked.map((event) => (
                      <div className="today-task-stack-row" key={event.id}>
                        <span>{eventWindowLabel(event.requestedAt, event.expiresAt, nowDate, locale, t)}</span>
                        <StatusPill status={resolvedEventStatus(event, now)} t={t} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
        {!pending.length && (
          <section className={`check-card today-empty${hasAttentionToday ? ' has-attention' : ''}`}>
            <div className="today-empty-status-row">
              <span className="eyebrow">{t('allDone')}</span>
              {missedTodayLabel ? <strong className="missed-today-badge">{missedTodayLabel}</strong> : null}
            </div>
            <h2>{emptyTodayTitle}</h2>
            <p>{emptyTodayHint}</p>
          </section>
        )}
        </div>
      </div>
    </section>
  );
  const attentionSection = attentionCompleted.length > 0 && (
    <section className="settings-section parent-review-section participant-review-section" aria-labelledby="participant-review-title">
      <div className="section-heading parent-review-heading">
        <h2 id="participant-review-title">{t('participantReviewTitle')}</h2>
        <span>{attentionCompleted.length}</span>
      </div>
      <div className="parent-review-list participant-review-list">
        {attentionCompleted.map(({ event }) => {
          const presentation = presentationFor(event);
          const statusLabel = event.status === 'not_detected' ? t('notDetected') : t('uncertain');
          return (
            <article className="card parent-review-card participant-review-card" style={presentation.style} key={event.id}>
              <div className="parent-review-main participant-review-main">
                <div className="parent-review-image participant-review-image" aria-hidden="true">
                  <span className="settings-row-icon today-task-icon"><AppIcon name={routineIconName(presentation.icon)} /></span>
                </div>
                <div className="parent-review-copy participant-review-copy">
                  <div className="parent-review-title-row">
                    <strong>{presentation.name}</strong>
                    <small>{formatTime(event.capturedAt ?? event.expiresAt)}</small>
                  </div>
                  <div className="parent-review-analysis">
                    <span>{t('analysisVerdict')}: {statusLabel}</span>
                  </div>
                  <p>{t('participantReviewHint')}</p>
                </div>
                <div className="parent-review-actions participant-review-actions">
                  <button type="button" className="primary-action-button participant-retake-button today-retake-button" onClick={() => retake?.(event)}>
                    <AppIcon name="camera" />
                    {t('retakeShort')}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
  const upcomingSection = upcomingChecks.length > 0 && (
    <section className="today-section upcoming-checks-section" aria-labelledby="upcoming-checks-title">
      <div className="section-heading upcoming-checks-heading">
        <h2 id="upcoming-checks-title">{t('upcomingChecks')}</h2>
      </div>
      <div className="upcoming-checks-list">
        {upcomingChecks.map((item) => (
          <article className="upcoming-check-card" style={item.presentation.style} key={item.id}>
            <span className="settings-row-icon today-task-icon" aria-hidden="true"><AppIcon name={routineIconName(item.presentation.icon)} /></span>
            <div>
              <h3>{item.presentation.name}</h3>
              <p>{plannedWindowLabel(item.planned.start, item.planned.end, nowDate, locale, t)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
  const historySection = (
    <section className="today-section participant-history-section dashboard-summary-section" aria-labelledby="participant-summary-title">
      <h2 id="participant-summary-title">{t('overview')}</h2>
      <AdherenceSummaryCard events={historyEvents} range={summaryRange} onRangeChange={setSummaryRange} t={t} />
      <RoutineHistoryPanel assignments={state.routineAssignments} events={rangedHistoryEvents} retryEvents={state.events} locale={state.locale} titleId="participant-history-title" onRetake={retake} onOpenEvent={onOpenHistoryEvent} t={t} />
    </section>
  );
  return (
    <div className="content-screen child-home">
      <div className="page-context-top participant-context-top">
        <header className="screen-header page-context-heading"><div><h1>{t('activity')}</h1></div></header>
        <div className="card relationship-manager-card participant-switcher-static">
          <ProfileContextCard
            as="div"
            title={activeParticipantAccess?.participant.displayName ?? state.family.childName}
            profileColor={activeParticipantAccess ? profileColorFor(activeParticipantAccess.participant) : undefined}
          />
        </div>
      </div>
      {pendingSection}
      {upcomingSection}
      {attentionSection}
      {historySection}
      <Disclaimer t={t} />
    </div>
  );
}
