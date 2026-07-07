import { lazy, Suspense, useState } from 'react';
import type { AppState, MonitoringPlan, RoutineAssignment, RoutineValidationMode, ScheduleGroup, VerificationEvent } from '../domain/models';
import { groupsFromLegacyPlan, nextPlannedWindow, summarizeWeekdays } from '../domain/monitoringPlan';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from '../components/Icon';
import { presentRoutine } from '../domain/routinePresentation';
import { assignableRoutineTemplates, marketplaceFromTemplates, presentRoutineTemplate } from '../domain/routineMarketplace';
import { dayPeriodLabelKey, plannedWindowLabel } from '../domain/taskTimeLabel';
import { withResolvedEventStatuses } from '../domain/adherence';

const RoutineDetailScreen = lazy(() => import('./RoutineDetailScreen').then((module) => ({ default: module.RoutineDetailScreen })));

const completionRate = (assignment: RoutineAssignment, events: VerificationEvent[]) => {
  const completed = withResolvedEventStatuses(events).filter((event) => event.routineId === assignment.routineId && !['pending', 'analyzing'].includes(event.status));
  if (!completed.length) return 0;
  return completed.filter((event) => event.status === 'detected').length / completed.length;
};

type RequestStatus = 'idle' | 'sent' | 'active' | 'error';

const groupSummaryLabel = (group: ScheduleGroup, index: number, t: (key: MessageKey) => string) => {
  const label = group.label?.trim();
  const weekdaySummary = summarizeWeekdays(group.weekdays, t);
  if (!label || label === weekdaySummary) return `${t('monitoringPeriod')} ${index + 1}`;
  return label;
};

export function RoutinesScreen({
  state,
  start,
  edit,
  requestCheck,
  getProofImageUrl,
  onAssignRoutine,
  onDeleteRoutine,
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
  onSaveMonitoringPlan?: (routineId: string, plan: MonitoringPlan, validationMode?: RoutineValidationMode) => Promise<void>;
  savingRoutineId?: string;
  t: (key: MessageKey) => string;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  const [requestingRoutineId, setRequestingRoutineId] = useState<string>();
  const [requestStatuses, setRequestStatuses] = useState<Record<string, RequestStatus>>({});
  const [catalogOpen, setCatalogOpen] = useState(() => Boolean(onAssignRoutine && !state.routineAssignments.length));
  const [assigningRoutineId, setAssigningRoutineId] = useState<string>();
  const [assignError, setAssignError] = useState(false);
  const [deletingRoutineId, setDeletingRoutineId] = useState<string>();
  const [deleteErrorRoutineId, setDeleteErrorRoutineId] = useState<string>();
  const [detailInitialTab, setDetailInitialTab] = useState<'overview' | 'plan'>();
  const [expandedScheduleIds, setExpandedScheduleIds] = useState<Set<string>>(() => new Set());
  const selected = state.routineAssignments.find((assignment) => assignment.id === selectedId);
  const marketplace = marketplaceFromTemplates();
  const openDetails = (assignmentId: string, initialTab?: 'overview' | 'plan') => {
    setDetailInitialTab(initialTab);
    setSelectedId(assignmentId);
  };
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
    } catch (error) {
      setRequestStatus(routineId, String(error).includes('active_check_exists') ? 'active' : 'error');
    } finally {
      setRequestingRoutineId(undefined);
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
      <div className="routine-list">
        {state.routineAssignments.map((assignment) => {
          const now = new Date();
          const next = state.events.find((event) => event.routineId === assignment.routineId && event.status === 'pending' && Date.parse(event.expiresAt) > now.getTime());
          const rate = completionRate(assignment, state.events);
          const visual = presentRoutine(assignment.routine, state.locale);
          const locale = state.locale === 'fr' ? 'fr-FR' : 'en-US';
          const planned = next ? undefined : nextPlannedWindow(assignment.plan, now);
          const nextLabel = next
            ? `${t(dayPeriodLabelKey(next.expiresAt))} · ${t('before')} ${new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(next.expiresAt))}`
            : planned
              ? plannedWindowLabel(planned.end, now, locale, t)
            : t('noPendingTask');
          const groups = groupsFromLegacyPlan(assignment.plan);
          const planChips = groups.map((group, groupIndex) => {
            const windows = group.windows.map((window) => `${window.start}–${window.end}`).join(', ');
            return {
              id: group.id,
              label: groups.length > 1
                ? `${groupSummaryLabel(group, groupIndex, t)} · ${summarizeWeekdays(group.weekdays, t)} · ${windows}`
                : windows,
            };
          });
          const requestStatus = requestStatuses[assignment.routineId] ?? 'idle';
          const requesting = requestingRoutineId === assignment.routineId;
          const scheduleExpanded = expandedScheduleIds.has(assignment.id);
          return (
            <section className="card routine-card routine-plan-list-card" style={visual.style} key={assignment.id}>
              <div className="routine-list-card-title">
                <div className="routine-card-heading">
                  <span className="settings-row-icon routine-icon" aria-hidden="true"><AppIcon name={routineIconName(visual.icon)} /></span>
                  <div><h2>{visual.name}</h2><p><b>{assignment.plan.checksPerDay}</b> {t('checksDay')} · <b>{assignment.plan.expiryMinutes}</b> {t('minutesRespond')}</p></div>
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
                  <div className="chips routine-schedule-chips">{planChips.map((chip) => <span key={chip.id}><i aria-hidden="true">◷</i>{chip.label}</span>)}</div>
                  <div className="routine-card-actions">
                    <button type="button" className="routine-list-detail-button" onClick={() => openDetails(assignment.id)}>{t('details')}</button>
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
                      <button className="request-check routine-list-request" disabled={requesting} onClick={() => { void requestNow(assignment.routineId); }}>
                        {requesting ? t('requestingCheck') : next ? t('requestCheckAgain') : t('requestCheckNow')}
                      </button>
                      {next && <p role="status" className="request-feedback">{t('requestCheckActive')}</p>}
                      {requestStatus === 'sent' && <p role="status" aria-live="polite" className="request-feedback success">{t('requestCheckSent')}</p>}
                      {requestStatus === 'active' && !next && <p role="status" aria-live="polite" className="request-feedback">{t('requestCheckActive')}</p>}
                      {requestStatus === 'error' && <p role="status" aria-live="polite" className="request-feedback error">{t('requestCheckError')}</p>}
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
    </div>
  );
}
