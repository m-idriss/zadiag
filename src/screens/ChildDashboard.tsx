import { useMemo, useState } from 'react';
import { adherenceSummary } from '../domain/adherence';
import type { AppState, VerificationEvent, VerificationStatus } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { Disclaimer } from '../components/Disclaimer';
import { StatusPill } from '../components/StatusPill';
import { AppIcon, routineIconName } from '../components/Icon';
import { presentRoutine } from '../domain/routinePresentation';
import { dayPeriodLabelKey } from '../domain/taskTimeLabel';

const isToday = (value: string, now = new Date()) => {
  const date = new Date(value);
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
};

const displayStatusFor = (event: VerificationEvent, now: number): VerificationEvent['status'] =>
  event.status === 'pending' && Date.parse(event.expiresAt) <= now ? 'expired' : event.status;

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

export function ChildDashboard({
  state,
  active,
  start,
  t,
}: {
  state: AppState;
  active?: VerificationEvent;
  start: () => void;
  t: (key: MessageKey) => string;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [routineFilter, setRoutineFilter] = useState<RoutineFilter>('all');
  const now = Date.now();
  const today = state.events.filter((event) => isToday(event.requestedAt));
  const pending = today.filter((event) => (
    event.status === 'analyzing'
    || (event.status === 'pending' && Date.parse(event.expiresAt) > now)
  ));
  const actionableCount = pending.length;
  const completed = today.filter((event) => !['pending', 'analyzing'].includes(event.status));
  const historyEvents = useMemo(
    () => [...state.events]
      .map((event) => ({ ...event, status: displayStatusFor(event, now) }))
      .filter((event) => !['pending', 'analyzing'].includes(event.status))
      .sort((a, b) => eventTimestamp(b) - eventTimestamp(a)),
    [now, state.events],
  );
  const summary = adherenceSummary(historyEvents);
  const statuses = useMemo<VerificationStatus[]>(
    () => Array.from(new Set(historyEvents.map((event) => event.status))),
    [historyEvents],
  );
  const filteredHistory = historyEvents.filter((event) =>
    (statusFilter === 'all' || event.status === statusFilter)
    && (routineFilter === 'all' || event.routineId === routineFilter)
  );
  const formatTime = (value: string) => new Intl.DateTimeFormat(state.locale === 'fr' ? 'fr-FR' : 'en-US', {
    timeStyle: 'short',
  }).format(new Date(value));
  const formatDateTime = (value: string) => new Intl.DateTimeFormat(state.locale === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
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
  const pendingSection = (
    <section className="today-section" aria-labelledby="pending-tasks-title">
      <div className="today-pending-panel">
        <div className="today-panel-heading"><div><small>{t('toDoToday')}</small><h2 id="pending-tasks-title">{actionableCount} {t(actionableCount === 1 ? 'checkToComplete' : 'checksToComplete')}</h2></div></div>
        <div className="today-task-list">
        {pendingGroups.map((group) => {
          const main = group.events.find((event) => event.id === active?.id) ?? group.events[0];
          const stacked = group.events.filter((event) => event.id !== main.id);
          const presentation = presentationFor(main);
          const actionable = active?.id === main.id;
          return (
            <article className={`today-task today-routine-card ${actionable ? 'actionable' : 'expired-only'}`} style={presentation.style} key={group.routineId}>
              <div className="today-routine-main">
                <div className="today-routine-primary">
                  <div className="today-task-copy">
                    <span className="today-task-icon" aria-hidden="true"><AppIcon name={routineIconName(presentation.icon)} /></span>
                    <div>
                      <h3>{presentation.name}</h3>
                      <small>{t(dayPeriodLabelKey(main.expiresAt))}</small>
                      <p>{t('before')} {formatTime(main.expiresAt)}</p>
                    </div>
                  </div>
                  {actionable
                    ? <button type="button" className="primary-action-button" onClick={start}><AppIcon name="camera" />{t('sendProof')}</button>
                    : <StatusPill status={displayStatusFor(main, now)} t={t} />}
                </div>
                {stacked.length > 0 && (
                  <div className="today-task-stack">
                    {stacked.map((event) => (
                      <div className="today-task-stack-row" key={event.id}>
                        <span>{t(dayPeriodLabelKey(event.expiresAt))} · {t('before')} {formatTime(event.expiresAt)}</span>
                        <StatusPill status={displayStatusFor(event, now)} t={t} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
        {!pending.length && <section className="check-card today-empty"><span className="eyebrow">{t('allDone')}</span><h2>{t('niceWork')}</h2><p>{t('nextCheckHint')}</p></section>}
        </div>
      </div>
    </section>
  );
  const completedSection = (
    <section className="today-section" aria-labelledby="completed-tasks-title">
      <div className="completed-panel-heading"><div><small id="completed-tasks-title">{t('completedToday')}</small><p>{completed.length} {t(completed.length === 1 ? 'checkCompleted' : 'checksCompleted')}</p></div></div>
      <div className="today-task-list">
        {completed.map((event) => (
          <article className="card today-task completed" style={presentationFor(event).style} key={event.id}>
            <div className="today-task-copy"><span className="today-task-icon" aria-hidden="true"><AppIcon name={routineIconName(presentationFor(event).icon)} /></span><div><h3>{presentationFor(event).name}</h3><p>{formatTime(event.capturedAt ?? event.expiresAt)}</p></div></div>
            <StatusPill status={event.status} t={t} />
          </article>
        ))}
        {!completed.length && <p className="today-empty-copy">{t('nothingCompletedYet')}</p>}
      </div>
    </section>
  );
  const historySection = (
    <section className="today-section participant-history-section" aria-labelledby="participant-history-title">
      <section className="card summary-card">
        <div className="progress-ring" style={{ '--progress': `${summary.rate * 360}deg` } as React.CSSProperties}>
          <span>{Math.round(summary.rate * 100)}%</span>
        </div>
        <div><h2>{t('lastSeven')}</h2><p>{summary.successful} {t('clearChecks')} {summary.completed}</p><strong>{t('progressEncouragement')}</strong></div>
      </section>

      <div className="section-heading parent-history-heading"><h2 id="participant-history-title">{t('recentHistory')}</h2></div>
      {historyEvents.length ? (
        <>
          <section className="card history-filter-card" aria-label={t('historyFilters')}>
            <div className="filter-group">
              <span>{t('filterByRoutine')}</span>
              <div className="filter-chips">
                <button type="button" className={routineFilter === 'all' ? 'active' : ''} onClick={() => setRoutineFilter('all')}>{t('allRoutines')}</button>
                {state.routineAssignments.map((assignment) => {
                  const visual = presentRoutine(assignment.routine, state.locale);
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

          <div className="section-heading history-results-heading"><h2>{t('historyResults')}</h2><span>{filteredHistory.length}</span></div>
          <div className="history-list parent-history-list">
            {filteredHistory.map((event) => {
              const visual = presentationFor(event);
              return (
                <section className="card history-row parent-history-row" style={visual.style} key={event.id}>
                  <div className="history-icon routine-history-icon"><AppIcon name={routineIconName(visual.icon)} /></div>
                  <div>
                    <strong>{visual.name}</strong>
                    <small>{formatDateTime(event.requestedAt)}{event.reason ? ` · ${event.reason}` : ''}</small>
                  </div>
                  <StatusPill status={event.status} t={t} />
                </section>
              );
            })}
            {!filteredHistory.length && <p className="empty-state">{t('noHistoryMatches')}</p>}
          </div>
        </>
      ) : (
        <section className="card parent-empty-history-card">
          <AppIcon name="time" />
          <div>
            <h2>{t('noHistoryYet')}</h2>
            <p>{t('noHistoryYetHint')}</p>
          </div>
        </section>
      )}
    </section>
  );
  return (
    <div className="content-screen child-home">
      <header className="screen-header participant-header"><div><h1>{t('hi')} {state.family.childName} 👋</h1><p>{t('todayIntro')}</p></div><button type="button" className="more-button" aria-label={t('moreOptions')}>•••</button></header>
      {pendingSection}
      {completedSection}
      {historySection}
      <Disclaimer t={t} />
    </div>
  );
}
