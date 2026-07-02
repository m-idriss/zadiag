import { IonButton } from '@ionic/react';
import type { AppState, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { Disclaimer } from '../components/Disclaimer';
import { StatusPill } from '../components/StatusPill';

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
  t,
}: {
  state: AppState;
  active?: VerificationEvent;
  start: () => void;
  t: (key: MessageKey) => string;
}) {
  const today = state.events.filter((event) => isToday(event.requestedAt));
  const pending = today.filter((event) => ['pending', 'analyzing'].includes(event.status));
  const completed = today.filter((event) => !['pending', 'analyzing'].includes(event.status));
  const formatTime = (value: string) => new Intl.DateTimeFormat(state.locale === 'fr' ? 'fr-FR' : 'en-US', {
    timeStyle: 'short',
  }).format(new Date(value));
  const routineName = (event: VerificationEvent) => state.routineAssignments
    .find((assignment) => assignment.routineId === event.routineId)?.routine.name ?? t('routine');
  return (
    <div className="content-screen child-home">
      <header className="screen-header"><div><h1>{t('hi')} {state.family.childName} 👋</h1><p>{t('smallCheck')}</p></div></header>
      <section className="today-section" aria-labelledby="pending-tasks-title">
        <div className="section-heading"><h2 id="pending-tasks-title">{t('todayTasks')}</h2><span>{pending.length}</span></div>
        <div className="today-task-list">
          {pending.map((event) => (
            <article className={`card today-task ${active?.id === event.id ? 'actionable' : ''}`} key={event.id}>
              <div className="today-task-copy">
                <span className="today-task-icon" aria-hidden="true">{event.status === 'analyzing' ? '◌' : '□'}</span>
                <div><h3>{routineName(event)}</h3><p>{t('submitBefore')} {formatTime(event.expiresAt)}</p></div>
              </div>
              {active?.id === event.id
                ? <IonButton onClick={start}>◉&nbsp; {t('completeTask')}</IonButton>
                : <StatusPill status={event.status} t={t} />}
            </article>
          ))}
          {!pending.length && <section className="check-card today-empty"><span className="eyebrow">{t('allDone')}</span><h2>{t('niceWork')}</h2><p>{t('nextCheckHint')}</p></section>}
        </div>
      </section>
      <section className="today-section" aria-labelledby="completed-tasks-title">
        <div className="section-heading"><h2 id="completed-tasks-title">{t('completedToday')}</h2><span>{completed.length}</span></div>
        <div className="today-task-list">
          {completed.map((event) => (
            <article className="card today-task completed" key={event.id}>
              <div className="today-task-copy"><span className="today-task-icon" aria-hidden="true">✓</span><div><h3>{routineName(event)}</h3><p>{t('completedAt')} {formatTime(event.capturedAt ?? event.expiresAt)}</p></div></div>
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
