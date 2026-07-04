import { lazy, Suspense, useState } from 'react';
import type { AppState, RoutineAssignment, VerificationEvent } from '../domain/models';
import { summarizeWeekdays } from '../domain/monitoringPlan';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from '../components/Icon';
import { presentRoutine } from '../domain/routinePresentation';
import { availableRoutines, presentCatalogRoutine } from '../domain/routineCatalog';
import { dayPeriodLabelKey } from '../domain/taskTimeLabel';

const RoutineDetailScreen = lazy(() => import('./RoutineDetailScreen').then((module) => ({ default: module.RoutineDetailScreen })));

const completionRate = (assignment: RoutineAssignment, events: VerificationEvent[]) => {
  const completed = events.filter((event) => event.routineId === assignment.routineId && !['pending', 'analyzing'].includes(event.status));
  if (!completed.length) return 0;
  return completed.filter((event) => event.status === 'detected').length / completed.length;
};

type RequestStatus = 'idle' | 'sent' | 'active' | 'error';

export function RoutinesScreen({
  state,
  start,
  edit,
  requestCheck,
  onAssignRoutine,
  onDeleteRoutine,
  onEditMonitoringPlan,
  t,
}: {
  state: AppState;
  start?: () => void;
  edit?: boolean;
  requestCheck?: (routineId: string) => Promise<void>;
  onAssignRoutine?: (routineId: string) => Promise<void>;
  onDeleteRoutine?: (routineId: string) => Promise<void>;
  onEditMonitoringPlan?: (routineId: string) => void;
  t: (key: MessageKey) => string;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [requestingRoutineId, setRequestingRoutineId] = useState<string>();
  const [requestStatuses, setRequestStatuses] = useState<Record<string, RequestStatus>>({});
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [assigningRoutineId, setAssigningRoutineId] = useState<string>();
  const [assignError, setAssignError] = useState(false);
  const [deletingRoutineId, setDeletingRoutineId] = useState<string>();
  const [deleteErrorRoutineId, setDeleteErrorRoutineId] = useState<string>();
  const selected = state.routineAssignments.find((assignment) => assignment.id === selectedId);
  if (selected) return <Suspense fallback={<div className="content-screen routines-state" role="status"><p>{t('loadingRoutineDetails')}</p></div>}><RoutineDetailScreen assignment={selected} state={state} back={() => setSelectedId(undefined)} start={start} edit={edit} onEditMonitoringPlan={() => onEditMonitoringPlan?.(selected.routineId)} t={t} /></Suspense>;

  const setRequestStatus = (routineId: string, status: RequestStatus) => {
    setRequestStatuses((current) => ({ ...current, [routineId]: status }));
  };

  const requestNow = async (routineId: string) => {
    if (!requestCheck) return;
    setRequestingRoutineId(routineId);
    setRequestStatus(routineId, 'idle');
    try {
      await requestCheck(routineId);
      setRequestStatus(routineId, 'sent');
    } catch (error) {
      setRequestStatus(routineId, String(error).includes('active_check_exists') ? 'active' : 'error');
    } finally {
      setRequestingRoutineId(undefined);
    }
  };

  const assignedRoutineIds = new Set(state.routineAssignments.map((assignment) => assignment.routineId));
  const assignRoutine = async (routineId: string) => {
    if (!onAssignRoutine || assignedRoutineIds.has(routineId)) return;
    setAssigningRoutineId(routineId);
    setAssignError(false);
    try {
      await onAssignRoutine(routineId);
      setCatalogOpen(false);
    } catch (error) {
      console.error(error);
      setAssignError(true);
    } finally {
      setAssigningRoutineId(undefined);
    }
  };
  const deleteRoutine = async (assignment: RoutineAssignment, routineName: string) => {
    if (!onDeleteRoutine || deletingRoutineId) return;
    if (!window.confirm(t('confirmDeleteRoutine').replace('{routine}', routineName))) return;
    setDeletingRoutineId(assignment.routineId);
    setDeleteErrorRoutineId(undefined);
    try {
      await onDeleteRoutine(assignment.routineId);
    } catch (error) {
      console.error(error);
      setDeleteErrorRoutineId(assignment.routineId);
    } finally {
      setDeletingRoutineId(undefined);
    }
  };

  if (state.routinesLoaded === false) return <div className="content-screen routines-state" role="status"><p>{t('loadingRoutines')}</p></div>;
  if (state.routinesError) return <div className="content-screen routines-state" role="alert"><p>{t('routinesLoadError')}</p></div>;

  return (
    <div className="content-screen routines-screen">
      <header className="screen-header participant-header">
        <div><h1>{t('myRoutines')}</h1><p>{t('routinesHint')}</p></div>
        {onAssignRoutine && <button type="button" className="add-routine-button" aria-label={t('addRoutine')} aria-expanded={catalogOpen} onClick={() => setCatalogOpen((open) => !open)}>＋</button>}
      </header>
      {catalogOpen && (
        <section className="card routine-catalog-card" aria-labelledby="routine-catalog-title">
          <div className="routine-catalog-heading">
            <div>
              <small>{t('routineCatalogEyebrow')}</small>
              <h2 id="routine-catalog-title">{t('chooseRoutine')}</h2>
            </div>
            <button type="button" className="routine-catalog-close" onClick={() => setCatalogOpen(false)} aria-label={t('close')}>×</button>
          </div>
          <div className="routine-catalog-list">
            {availableRoutines.map((routine) => {
              const visual = presentCatalogRoutine(routine, state.locale);
              const assigned = assignedRoutineIds.has(routine.id);
              const assigning = assigningRoutineId === routine.id;
              return (
                <article className="routine-catalog-item" style={visual.style} key={routine.id}>
                  <span className="routine-icon" aria-hidden="true"><AppIcon name={routineIconName(visual.icon)} /></span>
                  <div>
                    <h3>{visual.name}</h3>
                    <p>{visual.description}</p>
                  </div>
                  <button type="button" className="routine-catalog-add" disabled={assigned || assigning} onClick={() => { void assignRoutine(routine.id); }}>
                    {assigned ? t('routineAlreadyAdded') : assigning ? t('addingRoutine') : t('add')}
                  </button>
                </article>
              );
            })}
          </div>
          {assignError && <p role="alert" className="request-feedback error">{t('routineAddError')}</p>}
        </section>
      )}
      <div className="routine-list">
        {state.routineAssignments.map((assignment) => {
          const next = state.events.find((event) => event.routineId === assignment.routineId && event.status === 'pending' && Date.parse(event.expiresAt) > Date.now());
          const rate = completionRate(assignment, state.events);
          const visual = presentRoutine(assignment.routine, state.locale);
          const locale = state.locale === 'fr' ? 'fr-FR' : 'en-US';
          const nextLabel = next
            ? `${t(dayPeriodLabelKey(next.expiresAt))} · ${t('before')} ${new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(next.expiresAt))}`
            : t('noPendingTask');
          const planChips = assignment.plan.scheduleGroups?.length
            ? assignment.plan.scheduleGroups.flatMap((group, groupIndex) =>
                group.windows.map((window) => ({
                  id: `${group.id}-${window.id}`,
                  label: assignment.plan.scheduleGroups!.length > 1
                    ? `${group.label?.trim() || `${t('monitoringPeriod')} ${groupIndex + 1}`} · ${summarizeWeekdays(group.weekdays, t)} · ${window.start}–${window.end}`
                    : `${window.start}–${window.end}`,
                })),
              )
            : assignment.plan.windows.map((window) => ({ id: window.id, label: `${window.start}–${window.end}` }));
          const requestStatus = requestStatuses[assignment.routineId] ?? 'idle';
          const requesting = requestingRoutineId === assignment.routineId;
          return (
            <section className="card routine-card routine-plan-list-card" style={visual.style} key={assignment.id}>
              <div className="routine-list-card-title">
                <button type="button" className="routine-card-heading" onClick={() => setSelectedId(assignment.id)} aria-label={`${t('viewDetails')} — ${visual.name}`}>
                  <span className="routine-icon" aria-hidden="true"><AppIcon name={routineIconName(visual.icon)} /></span>
                  <div><h2>{visual.name}</h2><p><b>{assignment.plan.checksPerDay}</b> {t('checksDay')} · <b>{assignment.plan.expiryMinutes}</b> {t('minutesRespond')}</p></div>
                </button>
                <button type="button" className="routine-list-detail-button" onClick={() => setSelectedId(assignment.id)}>{t('details')}</button>
                {edit && <button type="button" className="routine-list-edit-button" onClick={() => onEditMonitoringPlan?.(assignment.routineId)}>{t('edit')}</button>}
                {edit && onDeleteRoutine && (
                  <button
                    type="button"
                    className="routine-list-delete-button"
                    aria-label={t('deleteRoutine').replace('{routine}', visual.name)}
                    disabled={deletingRoutineId === assignment.routineId}
                    onClick={() => { void deleteRoutine(assignment, visual.name); }}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                )}
              </div>
              <div className="routine-progress-row">
                <div className="routine-progress-track"><span style={{ width: `${Math.round(rate * 100)}%` }} /></div>
                <b className="routine-rate">{Math.round(rate * 100)}%</b>
              </div>
              <div className="routine-plan-stats">
                <div><small>{t('nextCheck')}</small><strong>{nextLabel}</strong></div>
              </div>
              <div className="chips">{planChips.map((chip) => <span key={chip.id}><i aria-hidden="true">◷</i>{chip.label}</span>)}</div>
              {edit && requestCheck && (
                <>
                  <button className="request-check routine-list-request" disabled={requesting} onClick={() => { void requestNow(assignment.routineId); }}>
                    {requesting ? t('requestingCheck') : next ? t('requestCheckAgain') : t('requestCheckNow')}
                  </button>
                  {next && <p role="status" className="request-feedback">{t('requestCheckActive')}</p>}
                  {requestStatus === 'sent' && <p role="status" aria-live="polite" className="request-feedback success">{t('requestCheckSent')}</p>}
                  {requestStatus === 'active' && !next && <p role="status" aria-live="polite" className="request-feedback">{t('requestCheckActive')}</p>}
                  {requestStatus === 'error' && <p role="status" aria-live="polite" className="request-feedback error">{t('requestCheckError')}</p>}
                </>
              )}
              {deleteErrorRoutineId === assignment.routineId && <p role="alert" className="request-feedback error">{t('routineDeleteError')}</p>}
            </section>
          );
        })}
        {!state.routineAssignments.length && <p className="empty-state">{t('noRoutines')}</p>}
      </div>
    </div>
  );
}
