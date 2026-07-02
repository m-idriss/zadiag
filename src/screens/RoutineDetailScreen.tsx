import { adherenceSummary } from '../domain/adherence';
import type { AppState, RoutineAssignment } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { StatusPill } from '../components/StatusPill';

const sameLocalDay = (value: string, day = new Date()) => {
  const date = new Date(value);
  return date.getFullYear() === day.getFullYear()
    && date.getMonth() === day.getMonth()
    && date.getDate() === day.getDate();
};

export function RoutineDetailScreen({
  assignment,
  state,
  back,
  t,
}: {
  assignment: RoutineAssignment;
  state: AppState;
  back: () => void;
  t: (key: MessageKey) => string;
}) {
  const events = state.events.filter((event) => event.routineId === assignment.routineId);
  const summary = adherenceSummary(events);
  const today = events.filter((event) => sameLocalDay(event.requestedAt));
  const locale = state.locale === 'fr' ? 'fr-FR' : 'en-US';
  const formatDateTime = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

  return (
    <div className="content-screen routine-detail-screen">
      <button type="button" className="back-button" onClick={back} aria-label={t('backToRoutines')}>‹</button>
      <header className="screen-header routine-detail-header">
        <div><small>{t('routineOverview')}</small><h1>{assignment.routine.name}</h1><p>{assignment.routine.description}</p></div>
        <span className={`routine-status ${assignment.status}`}>{t(assignment.status === 'active' ? 'routineActive' : assignment.status === 'paused' ? 'routinePaused' : 'routineCompleted')}</span>
      </header>

      <section className="card routine-detail-progress">
        <div className="progress-ring" style={{ '--progress': `${summary.rate * 360}deg` } as React.CSSProperties}><span>{Math.round(summary.rate * 100)}%</span></div>
        <div><small>{t('routineProgress')}</small><h2>{summary.successful} / {summary.completed}</h2><p>{t('successfulChecks')}</p></div>
      </section>

      <section className="card routine-detail-section">
        <h2>{t('schedule')}</h2>
        <p>{assignment.plan.checksPerDay} {t('checksDay')} · {assignment.plan.expiryMinutes} {t('minutesRespond')}</p>
        <div className="chips">{assignment.plan.windows.map((window) => <span key={window.id}>◷ {window.start}–{window.end}</span>)}</div>
      </section>

      <section className="routine-detail-section">
        <div className="section-heading"><h2>{t('todayStatus')}</h2><span>{today.length}</span></div>
        {today.length ? today.map((event) => (
          <article className="card history-row" key={event.id}>
            <div className="history-icon">◎</div><div><strong>{formatDateTime(event.requestedAt)}</strong><small>{event.reason ?? t('noAnalysisYet')}</small></div><StatusPill status={event.status} t={t} />
          </article>
        )) : <p className="empty-state compact">{t('noTaskToday')}</p>}
      </section>

      <section className="routine-detail-section">
        <div className="section-heading"><h2>{t('routineHistory')}</h2><span>{events.length}</span></div>
        {events.map((event) => (
          <article className="card history-row" key={event.id}>
            <div className="history-icon">◎</div><div><strong>{formatDateTime(event.requestedAt)}</strong><small>{event.reason ?? t('noAnalysisYet')}</small></div><StatusPill status={event.status} t={t} />
          </article>
        ))}
        {!events.length && <p className="empty-state compact">{t('noRoutineHistory')}</p>}
      </section>
    </div>
  );
}
