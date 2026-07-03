import { IonButton } from '@ionic/react';
import type { AppState, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { Disclaimer } from '../components/Disclaimer';
import { StatusPill } from '../components/StatusPill';
import { presentRoutine } from '../domain/routinePresentation';

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
  const presentations = new Map(state.routineAssignments.map((assignment) => [assignment.routineId, presentRoutine(assignment.routine, state.locale)]));
  const presentationFor = (event: VerificationEvent) => {
    return presentations.get(event.routineId) ?? { name: t('routine'), icon: '✦', style: {} };
  };
  return (
    <div className="content-screen child-home">
      <header className="screen-header participant-header"><div><h1>{t('hi')} {state.family.childName} 👋</h1><p>{t('todayIntro')}</p></div><button type="button" className="more-button" aria-label={t('moreOptions')}>•••</button></header>
      <section className="today-section" aria-labelledby="pending-tasks-title">
        <div className="today-pending-panel">
          <div className="today-panel-heading"><div><small>{t('toDoToday')}</small><h2 id="pending-tasks-title">{pending.length} {t(pending.length === 1 ? 'checkToComplete' : 'checksToComplete')}</h2></div><span aria-hidden="true">▣</span></div>
          <div className="today-task-list">
          {pending.map((event) => (
            <article className={`today-task ${active?.id === event.id ? 'actionable' : ''}`} style={presentationFor(event).style} key={event.id}>
              <div className="today-task-copy">
                <span className="today-task-icon" aria-hidden="true">{presentationFor(event).icon}</span>
                <div><h3>{presentationFor(event).name}</h3><small>{t('thisEvening')}</small><p>{t('before')} {formatTime(event.expiresAt)}</p></div>
              </div>
              {active?.id === event.id
                ? <IonButton expand="block" onClick={start}>▣&nbsp; {t('sendProof')}</IonButton>
                : <StatusPill status={event.status} t={t} />}
            </article>
          ))}
          {!pending.length && <section className="check-card today-empty"><span className="eyebrow">{t('allDone')}</span><h2>{t('niceWork')}</h2><p>{t('nextCheckHint')}</p></section>}
          </div>
        </div>
      </section>
      <section className="today-section" aria-labelledby="completed-tasks-title">
        <div className="completed-panel-heading"><div><small id="completed-tasks-title">{t('completedToday')}</small><p>{completed.length} {t(completed.length === 1 ? 'checkCompleted' : 'checksCompleted')}</p></div></div>
        <div className="today-task-list">
          {completed.map((event) => (
            <article className="card today-task completed" style={presentationFor(event).style} key={event.id}>
              <div className="today-task-copy"><span className="today-task-icon" aria-hidden="true">{presentationFor(event).icon}</span><div><h3>{presentationFor(event).name}</h3><p>{formatTime(event.capturedAt ?? event.expiresAt)}</p></div></div>
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
