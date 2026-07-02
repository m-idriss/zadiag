import { lazy, Suspense, useState } from 'react';
import type { AppState, RoutineAssignment, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';

const RoutineDetailScreen = lazy(() => import('./RoutineDetailScreen').then((module) => ({ default: module.RoutineDetailScreen })));

const completionRate = (assignment: RoutineAssignment, events: VerificationEvent[]) => {
  const completed = events.filter((event) => event.routineId === assignment.routineId && !['pending', 'analyzing'].includes(event.status));
  if (!completed.length) return 0;
  return completed.filter((event) => event.status === 'detected').length / completed.length;
};

export function RoutinesScreen({ state, t }: { state: AppState; t: (key: MessageKey) => string }) {
  const [selectedId, setSelectedId] = useState<string>();
  const selected = state.routineAssignments.find((assignment) => assignment.id === selectedId);
  if (selected) return <Suspense fallback={<div className="content-screen routines-state" role="status"><p>{t('loadingRoutineDetails')}</p></div>}><RoutineDetailScreen assignment={selected} state={state} back={() => setSelectedId(undefined)} t={t} /></Suspense>;

  if (state.routinesLoaded === false) return <div className="content-screen routines-state" role="status"><p>{t('loadingRoutines')}</p></div>;
  if (state.routinesError) return <div className="content-screen routines-state" role="alert"><p>{t('routinesLoadError')}</p></div>;

  return (
    <div className="content-screen routines-screen">
      <header className="screen-header">
        <div><small>{t('routines')}</small><h1>{t('myRoutines')}</h1><p>{t('routinesHint')}</p></div>
      </header>
      <div className="routine-list">
        {state.routineAssignments.map((assignment) => {
          const next = state.events.find((event) => event.routineId === assignment.routineId && event.status === 'pending');
          const rate = completionRate(assignment, state.events);
          return (
            <section className="card routine-card" key={assignment.id}>
              <div className="routine-card-heading">
                <div><h2>{assignment.routine.name}</h2><p>{assignment.routine.description}</p></div>
                <span className={`routine-status ${assignment.status}`}>{t(assignment.status === 'active' ? 'routineActive' : assignment.status === 'paused' ? 'routinePaused' : 'routineCompleted')}</span>
              </div>
              <div className="routine-metrics">
                <span><b>{assignment.plan.checksPerDay}</b> {t('checksDay')}</span>
                <span><b>{Math.round(rate * 100)}%</b> {t('completion')}</span>
              </div>
              <p className="routine-next">{next ? `${t('nextTask')} ${new Intl.DateTimeFormat(state.locale === 'fr' ? 'fr-FR' : 'en-US', { timeStyle: 'short' }).format(new Date(next.expiresAt))}` : t('noPendingTask')}</p>
              <button type="button" className="routine-details-button" onClick={() => setSelectedId(assignment.id)}>{t('viewDetails')} →</button>
            </section>
          );
        })}
        {!state.routineAssignments.length && <p className="empty-state">{t('noRoutines')}</p>}
      </div>
    </div>
  );
}
