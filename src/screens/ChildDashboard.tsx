import type { AppState, VerificationEvent } from '../domain/models';
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
  const now = Date.now();
  const today = state.events.filter((event) => isToday(event.requestedAt));
  const pending = today.filter((event) => ['pending', 'analyzing'].includes(event.status));
  const actionableCount = pending.filter((event) => event.status === 'analyzing' || Date.parse(event.expiresAt) > now).length;
  const completed = today.filter((event) => !['pending', 'analyzing'].includes(event.status));
  const formatTime = (value: string) => new Intl.DateTimeFormat(state.locale === 'fr' ? 'fr-FR' : 'en-US', {
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
  return (
    <div className="content-screen child-home">
      <header className="screen-header participant-header"><div><h1>{t('hi')} {state.family.childName} 👋</h1><p>{t('todayIntro')}</p></div><button type="button" className="more-button" aria-label={t('moreOptions')}>•••</button></header>
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
      <Disclaimer t={t} />
    </div>
  );
}
