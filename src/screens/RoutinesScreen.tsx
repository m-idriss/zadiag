import { lazy, Suspense, useState } from 'react';
import type { AppState, RoutineAssignment, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from '../components/Icon';
import { presentRoutine } from '../domain/routinePresentation';

const RoutineDetailScreen = lazy(() => import('./RoutineDetailScreen').then((module) => ({ default: module.RoutineDetailScreen })));

const completionRate = (assignment: RoutineAssignment, events: VerificationEvent[]) => {
  const completed = events.filter((event) => event.routineId === assignment.routineId && !['pending', 'analyzing'].includes(event.status));
  if (!completed.length) return 0;
  return completed.filter((event) => event.status === 'detected').length / completed.length;
};

export function RoutinesScreen({ state, start, t }: { state: AppState; start?: () => void; t: (key: MessageKey) => string }) {
  const [selectedId, setSelectedId] = useState<string>();
  const selected = state.routineAssignments.find((assignment) => assignment.id === selectedId);
  if (selected) return <Suspense fallback={<div className="content-screen routines-state" role="status"><p>{t('loadingRoutineDetails')}</p></div>}><RoutineDetailScreen assignment={selected} state={state} back={() => setSelectedId(undefined)} start={start} t={t} /></Suspense>;

  if (state.routinesLoaded === false) return <div className="content-screen routines-state" role="status"><p>{t('loadingRoutines')}</p></div>;
  if (state.routinesError) return <div className="content-screen routines-state" role="alert"><p>{t('routinesLoadError')}</p></div>;

  return (
    <div className="content-screen routines-screen">
      <header className="screen-header participant-header">
        <div><h1>{t('myRoutines')}</h1><p>{t('routinesHint')}</p></div><button type="button" className="add-routine-button" aria-label={t('addRoutine')}>＋</button>
      </header>
      <div className="routine-list">
        {state.routineAssignments.map((assignment) => {
          const next = state.events.find((event) => event.routineId === assignment.routineId && event.status === 'pending');
          const rate = completionRate(assignment, state.events);
          const visual = presentRoutine(assignment.routine, state.locale);
          return (
            <section className="card routine-card" style={visual.style} key={assignment.id}>
              <button type="button" className="routine-card-link" onClick={() => setSelectedId(assignment.id)} aria-label={`${t('viewDetails')} — ${visual.name}`}>
                <div className="routine-card-heading">
                  <span className="routine-icon" aria-hidden="true"><AppIcon name={routineIconName(visual.icon)} /></span>
                  <div><h2>{visual.name}</h2><p>{assignment.plan.checksPerDay} {t('checksDay')}</p></div>
                  <b className="routine-rate">{Math.round(rate * 100)}%</b>
                </div>
                <div className="routine-progress-track"><span style={{ width: `${Math.round(rate * 100)}%` }} /></div>
                <div className="routine-card-next"><div><small>{t('nextCheck')}</small><p>{next ? `${t('thisEvening')} · ${t('before')} ${new Intl.DateTimeFormat(state.locale === 'fr' ? 'fr-FR' : 'en-US', { timeStyle: 'short' }).format(new Date(next.expiresAt))}` : t('noPendingTask')}</p></div><span aria-hidden="true">›</span></div>
              </button>
            </section>
          );
        })}
        {!state.routineAssignments.length && <p className="empty-state">{t('noRoutines')}</p>}
      </div>
    </div>
  );
}
