import { IonIcon } from '@ionic/react';
import { addOutline } from 'ionicons/icons';
import { lazy, Suspense, useEffect, useState } from 'react';
import type { AppState, MonitoringPlan, RoutineAssignment, RoutineValidationMode, ScheduleGroup, VerificationEvent } from '../domain/models';
import { groupsFromLegacyPlan, nextPlannedWindow, summarizeWeekdaysShort } from '../domain/monitoringPlan';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from '../components/Icon';
import { presentRoutine } from '../domain/routinePresentation';
import { assignableRoutineTemplates, marketplaceFromTemplates, presentRoutineTemplate } from '../domain/routineMarketplace';
import { withResolvedEventStatuses } from '../domain/adherence';

const RoutineDetailScreen = lazy(() => import('./RoutineDetailScreen').then((module) => ({ default: module.RoutineDetailScreen })));

const completionRate = (assignment: RoutineAssignment, events: VerificationEvent[]) => {
  const completed = withResolvedEventStatuses(events).filter((event) => event.routineId === assignment.routineId && !['pending', 'analyzing'].includes(event.status));
  if (!completed.length) return 0;
  return completed.filter((event) => event.status === 'detected').length / completed.length;
};

type RequestStatus = 'idle' | 'sent' | 'active' | 'error';
interface RequestRetryState {
  attempts: number;
  retryAt: number;
}

const responseWindowSummary = (expiryMinutes: number, t: (key: MessageKey) => string) =>
  expiryMinutes > 0
    ? <><b>{expiryMinutes}</b> {t('minutesRespond')}</>
    : <>{t('fullWindowRespond')}</>;

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

const nextLocalDay = (date: Date) => {
  const next = new Date(date);
  next.setDate(date.getDate() + 1);
  return next;
};

const formatRoutineTime = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(date);

const routineWindowLabel = (
  start: Date,
  end: Date,
  now: Date,
  locale: string,
  t: (key: MessageKey) => string,
) => {
  const windowLabel = `${formatRoutineTime(start, locale)}–${formatRoutineTime(end, locale)}`;
  if (sameLocalDay(start, now)) return windowLabel;
  if (sameLocalDay(start, nextLocalDay(now))) return `${t('tomorrow')} · ${windowLabel}`;
  return `${new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(start)} · ${windowLabel}`;
};

export function RoutinesScreen({
  state,
  start,
  edit,
  requestCheck,
  getProofImageUrl,
  onAssignRoutine,
  onDeleteRoutine,
  onRetryRoutines,
  onSaveMonitoringPlan,
  savingRoutineId,
  t,
}: {
  state: AppState;
  start?: () => void;
  edit?: boolean;
  requestCheck?: (routineId: string) => Promise<void>;
  getProofImageUrl?: (eventId: string) => Promise<string>;
  onAssignRoutine?: (routineId: string) => Promise<void>;
  onDeleteRoutine?: (routineId: string) => Promise<void>;
  onRetryRoutines?: () => Promise<void>;
  onSaveMonitoringPlan?: (routineId: string, plan: MonitoringPlan, validationMode?: RoutineValidationMode) => Promise<void>;
  savingRoutineId?: string;
  t: (key: MessageKey) => string;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [requestingRoutineId, setRequestingRoutineId] = useState<string>();
  const [requestStatuses, setRequestStatuses] = useState<Record<string, RequestStatus>>({});
  const [requestRetries, setRequestRetries] = useState<Record<string, RequestRetryState>>({});
  const [retryTick, setRetryTick] = useState(Date.now());
  const [retryingRoutines, setRetryingRoutines] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(() => Boolean(onAssignRoutine && !state.routineAssignments.length));
  const [assigningRoutineId, setAssigningRoutineId] = useState<string>();
  const [assignError, setAssignError] = useState(false);
  const [deletingRoutineId, setDeletingRoutineId] = useState<string>();
  const [deleteErrorRoutineId, setDeleteErrorRoutineId] = useState<string>();
  const [detailInitialTab, setDetailInitialTab] = useState<'overview' | 'plan'>();
  const [expandedScheduleIds, setExpandedScheduleIds] = useState<Set<string>>(() => new Set());
  const selected = state.routineAssignments.find((assignment) => assignment.id === selectedId);
  const marketplace = marketplaceFromTemplates();
  const retryDelayForAttempt = (attempt: number) => Math.min(30_000, 2 ** Math.max(0, attempt - 1) * 2_000);
  const openDetails = (assignmentId: string, initialTab?: 'overview' | 'plan') => {
    setDetailInitialTab(initialTab);
    setSelectedId(assignmentId);
  };

  useEffect(() => {
    if (!Object.keys(requestRetries).length) return undefined;
    const timer = window.setInterval(() => setRetryTick(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [requestRetries]);

  if (selected) return <Suspense fallback={<div className="content-screen routines-state" role="status"><p>{t('loadingRoutineDetails')}</p></div>}><RoutineDetailScreen key={`${selected.id}-${detailInitialTab ?? 'default'}`} assignment={selected} state={state} back={() => setSelectedId(undefined)} start={start} edit={edit} initialTab={detailInitialTab} getProofImageUrl={getProofImageUrl} onSaveMonitoringPlan={onSaveMonitoringPlan ? (plan, validationMode) => onSaveMonitoringPlan(selected.routineId, plan, validationMode) : undefined} routinePlanBusy={savingRoutineId === selected.routineId} t={t} /></Suspense>;

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
      setRequestRetries((current) => {
        const next = { ...current };
        delete next[routineId];
        return next;
      });
    } catch (error) {
      setRequestStatus(routineId, String(error).includes('active_check_exists') ? 'active' : 'error');
      if (!String(error).includes('active_check_exists')) {
        setRequestRetries((current) => {
          const attempts = (current[routineId]?.attempts ?? 0) + 1;
          return { ...current, [routineId]: { attempts, retryAt: Date.now() + retryDelayForAttempt(attempts) } };
        });
      }
    } finally {
      setRequestingRoutineId(undefined);
    }
  };
  const retryRoutines = async () => {
    if (!onRetryRoutines) return;
    setRetryingRoutines(true);
    try {
      await onRetryRoutines();
    } catch (error) {
      console.error(error);
    } finally {
      setRetryingRoutines(false);
    }
  };

  const assignedRoutineIds = new Set(state.routineAssignments.map((assignment) => assignment.routineId));
  const assignableTemplates = assignableRoutineTemplates(marketplace, [...assignedRoutineIds]);
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
  const toggleSchedule = (assignmentId: string) => {
    setExpandedScheduleIds((current) => {
      const next = new Set(current);
      if (next.has(assignmentId)) next.delete(assignmentId);
      else next.add(assignmentId);
      return next;
    });
  };

  if (state.routinesLoaded === false) return <div className="content-screen routines-state" role="status"><p>{t('loadingRoutines')}</p></div>;
  if (state.routinesError) return (
    <div className="content-screen routines-state" role="alert">
      <p>{t('routinesLoadError')}</p>
      {onRetryRoutines ? (
        <button type="button" className="primary-action-button routines-retry-button" disabled={retryingRoutines} onClick={() => { void retryRoutines(); }}>
          {retryingRoutines ? t('retrying') : t('retryNow')}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="content-screen routines-screen">
      <header className="screen-header participant-header">
        <div><h1>{t('myRoutines')}</h1><p>{t('routinesHint')}</p></div>
        {onAssignRoutine && (
          <button type="button" className="add-routine-button" aria-label={t('addRoutine')} aria-expanded={catalogOpen} onClick={() => setCatalogOpen((open) => !open)}>
            <IonIcon icon={addOutline} aria-hidden="true" />
          </button>
        )}
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
            {marketplace.templates.map((template) => {
              const visual = presentRoutineTemplate(template, state.locale);
              const routineId = template.routine.id;
              const assigned = assignedRoutineIds.has(routineId);
              const assigning = assigningRoutineId === routineId;
              return (
                <article className="routine-catalog-item" style={visual.style} key={template.id}>
                  <span className="settings-row-icon routine-icon" aria-hidden="true"><AppIcon name={routineIconName(visual.icon)} /></span>
                  <div>
                    <h3>{visual.name}</h3>
                    <p>{visual.description}</p>
                  </div>
                  <button type="button" className="routine-catalog-add" disabled={assigned || assigning} onClick={() => { void assignRoutine(routineId); }}>
                    {assigned ? t('routineAlreadyAdded') : assigning ? t('addingRoutine') : t('add')}
                  </button>
                </article>
              );
            })}
          </div>
          {!assignableTemplates.length && <p className="request-feedback">{t('allMarketplaceRoutinesAdded')}</p>}
          {assignError && <p role="alert" className="request-feedback error">{t('routineAddError')}</p>}
        </section>
      )}
      <section className="settings-section routines-list-section" aria-labelledby="routines-list-title">
        <h2 id="routines-list-title">{t('routines')}</h2>
        <div className="routine-list">
          {state.routineAssignments.map((assignment) => {
            const now = new Date();
            const next = state.events.find((event) => event.routineId === assignment.routineId && event.status === 'pending' && Date.parse(event.expiresAt) > now.getTime());
            const rate = completionRate(assignment, state.events);
            const visual = presentRoutine(assignment.routine, state.locale);
            const locale = state.locale === 'fr' ? 'fr-FR' : 'en-US';
            const planned = next ? undefined : nextPlannedWindow(assignment.plan, now);
            const nextLabel = next
              ? `${t('before')} ${formatRoutineTime(new Date(next.expiresAt), locale)}`
              : planned
                ? routineWindowLabel(planned.start, planned.end, now, locale, t)
                : t('noPendingTask');
            const groups = groupsFromLegacyPlan(assignment.plan);
            const planScheduleGroups = groups.map((group, groupIndex) => ({
              id: group.id,
              label: `${groups.length > 1 ? `${groupIndex + 1} · ` : ''}${summarizeWeekdaysShort(group.weekdays, t)}`,
              windows: group.windows.map((window) => ({
                id: `${group.id}_${window.id}`,
                label: `${window.start}–${window.end}`,
              })),
            }));
            const requestStatus = requestStatuses[assignment.routineId] ?? 'idle';
            const retryState = requestRetries[assignment.routineId];
            const retryInSeconds = retryState ? Math.max(0, Math.ceil((retryState.retryAt - retryTick) / 1000)) : 0;
            const retryBlocked = Boolean(retryState && retryInSeconds > 0);
            const requesting = requestingRoutineId === assignment.routineId;
            const scheduleExpanded = expandedScheduleIds.has(assignment.id);
            return (
              <section className="card routine-card routine-plan-list-card" style={visual.style} key={assignment.id}>
                <div className="routine-list-card-title">
                  <div className="routine-card-heading">
                    <span className="settings-row-icon routine-icon" aria-hidden="true"><AppIcon name={routineIconName(visual.icon)} /></span>
                    <div><h2>{visual.name}</h2><p><b>{assignment.plan.checksPerDay}</b> {t('checksDay')} · {responseWindowSummary(assignment.plan.expiryMinutes, t)}</p></div>
                  </div>
                  <b className="routine-rate">{Math.round(rate * 100)}%</b>
                  <button
                    type="button"
                    className="routine-schedule-toggle"
                    aria-label={t(scheduleExpanded ? 'hideSchedule' : 'showSchedule')}
                    aria-expanded={scheduleExpanded}
                    onClick={() => toggleSchedule(assignment.id)}
                  >
                    <AppIcon name="chevron-down" className={scheduleExpanded ? 'expanded' : undefined} />
                  </button>
                </div>
                <div className="routine-progress-row">
                  <div className="routine-progress-track"><span style={{ width: `${Math.round(rate * 100)}%` }} /></div>
                </div>
                <p className="routine-next-inline"><span>{t('nextCheck')}</span><strong>{nextLabel}</strong></p>
                {scheduleExpanded && (
                  <div className="routine-expanded-panel">
                    <p className="routine-instructions">{visual.instructions}</p>
                    <div className="routine-schedule-groups">
                      {planScheduleGroups.map((group) => (
                        <div className="chips routine-schedule-chips" key={group.id}>
                          {group.label && <span className="routine-schedule-period-chip">{group.label}</span>}
                          {group.windows.map((chip) => <span key={chip.id}><i aria-hidden="true">◷</i>{chip.label}</span>)}
                        </div>
                      ))}
                    </div>
                    <div className="routine-card-actions">
                      {edit && requestCheck && (
                        <button className="request-check routine-list-request" disabled={requesting || retryBlocked} onClick={() => { void requestNow(assignment.routineId); }}>
                          {requesting ? t('requestingCheck') : next ? t('requestCheckAgain') : t('requestCheckNow')}
                        </button>
                      )}
                      <button
                        type="button"
                        className="routine-list-detail-button"
                        aria-label={t('details')}
                        onClick={() => openDetails(assignment.id)}
                      >
                        <AppIcon name="settings" />
                      </button>
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
                    {edit && requestCheck && (
                      <>
                        {next && <p role="status" className="request-feedback">{t('requestCheckActive')}</p>}
                        {requestStatus === 'sent' && <p role="status" aria-live="polite" className="request-feedback success">{t('requestCheckSent')}</p>}
                        {requestStatus === 'active' && !next && <p role="status" aria-live="polite" className="request-feedback">{t('requestCheckActive')}</p>}
                        {requestStatus === 'error' && (
                          <p role="status" aria-live="polite" className="request-feedback error">
                            {retryBlocked
                              ? `${t('requestCheckError')} ${t('retryInSeconds').replace('{seconds}', String(retryInSeconds))}`
                              : t('requestCheckError')}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
                {deleteErrorRoutineId === assignment.routineId && <p role="alert" className="request-feedback error">{t('routineDeleteError')}</p>}
              </section>
            );
          })}
          {!state.routineAssignments.length && !catalogOpen && (
            <section className="card routines-empty-card">
              <h2>{t('noRoutines')}</h2>
              <p>{onAssignRoutine ? t('noRoutinesAddHint') : t('noRoutinesWaitHint')}</p>
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
