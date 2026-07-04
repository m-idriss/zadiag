import { useMemo, useState } from 'react';
import { adherenceSummary } from '../domain/adherence';
import type { AppState, RoutineAssignment, VerificationEvent, VerificationStatus } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from '../components/Icon';
import { CodeBox } from '../components/CodeBox';
import { StatusPill } from '../components/StatusPill';
import { presentRoutine } from '../domain/routinePresentation';

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

const routineForEvent = (event: VerificationEvent, assignments: RoutineAssignment[]) =>
  assignments.find((assignment) => assignment.routineId === event.routineId);

export function ParentDashboard({
  state,
  regenerateCode,
  onCreateRoutine,
  t,
}: {
  state: AppState;
  regenerateCode: () => Promise<void>;
  onCreateRoutine?: () => void;
  t: (key: MessageKey) => string;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [routineFilter, setRoutineFilter] = useState<RoutineFilter>('all');
  const [regenerating, setRegenerating] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const summary = adherenceSummary(state.events);
  const locale = state.locale === 'fr' ? 'fr-FR' : 'en-US';
  const formatDateTime = (value: string) => new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
  const events = useMemo(
    () => [...state.events].sort((a, b) => eventTimestamp(b) - eventTimestamp(a)),
    [state.events],
  );
  const statuses = useMemo<VerificationStatus[]>(
    () => Array.from(new Set(events.map((event) => event.status))),
    [events],
  );
  const filtered = events.filter((event) =>
    (statusFilter === 'all' || event.status === statusFilter)
    && (routineFilter === 'all' || event.routineId === routineFilter)
  );
  const hasHistory = events.length > 0;

  const regenerate = async () => {
    if (!window.confirm(t('regenerateCodeConfirm'))) return;
    setCodeError(false);
    setRegenerating(true);
    try {
      await regenerateCode();
    } catch {
      setCodeError(true);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="content-screen parent-overview-screen">
      <header className="screen-header">
        <div><small>{t('overview')}</small><h1>{state.family.childName} · {t('routine')}</h1></div>
        <div className="avatar">{state.family.childName.charAt(0)}</div>
      </header>

      <section className="card summary-card">
        <div className="progress-ring" style={{ '--progress': `${summary.rate * 360}deg` } as React.CSSProperties}>
          <span>{Math.round(summary.rate * 100)}%</span>
        </div>
        <div><h2>{t('lastSeven')}</h2><p>{summary.successful} {t('clearChecks')} {summary.completed}</p><strong>{t('progressEncouragement')}</strong></div>
      </section>

      {!state.family.childLinked && state.family.linkingCode ? (
        <CodeBox
          label={t('childLinkCode')}
          hint={t('childLinkCodeHint')}
          value={state.family.linkingCode}
          t={t}
          action={(
            <>
              <button type="button" className="regenerate-code" disabled={regenerating} onClick={() => { void regenerate(); }}>
                {regenerating ? t('regeneratingCode') : t('regenerateCode')}
              </button>
              {codeError ? <span className="form-error">{t('regenerateCodeError')}</span> : null}
            </>
          )}
        />
      ) : null}

      {!state.routineAssignments.length && onCreateRoutine ? (
        <section className="card parent-create-routine-card">
          <div className="parent-create-routine-icon" aria-hidden="true">
            <AppIcon name="add" />
          </div>
          <div className="parent-create-routine-copy">
            <div>
              <small>{t('routineSetupEyebrow')}</small>
              <h2>{t('createFirstRoutine')}</h2>
            </div>
            <p>{t('createFirstRoutineHint')}</p>
          </div>
          <button type="button" className="request-check" onClick={onCreateRoutine}>{t('chooseRoutine')}</button>
        </section>
      ) : null}

      <div className="section-heading parent-history-heading"><h2>{t('recentHistory')}</h2></div>
      {hasHistory ? (
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

          <div className="section-heading history-results-heading"><h2>{t('historyResults')}</h2><span>{filtered.length}</span></div>
          <div className="history-list parent-history-list">
            {filtered.map((event) => {
              const assignment = routineForEvent(event, state.routineAssignments);
              const visual = assignment ? presentRoutine(assignment.routine, state.locale) : undefined;
              return (
                <section className="card history-row parent-history-row" style={visual?.style} key={event.id}>
                  <div className="history-icon routine-history-icon"><AppIcon name={routineIconName(visual?.icon)} /></div>
                  <div>
                    <strong>{visual?.name ?? t('routine')}</strong>
                    <small>{formatDateTime(event.requestedAt)}{event.reason ? ` · ${event.reason}` : ''}</small>
                  </div>
                  <StatusPill status={event.status} t={t} />
                </section>
              );
            })}
            {!filtered.length && <p className="empty-state">{t('noHistoryMatches')}</p>}
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
    </div>
  );
}
