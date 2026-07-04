import { useMemo, useState } from 'react';
import type { AppState, RoutineAssignment, VerificationEvent, VerificationStatus } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from '../components/Icon';
import { StatusPill } from '../components/StatusPill';
import { presentRoutine } from '../domain/routinePresentation';

type StatusFilter = VerificationStatus | 'all';
type RoutineFilter = string | 'all';

const eventTimestamp = (event: VerificationEvent) =>
  Date.parse(event.capturedAt ?? event.requestedAt);

const statusLabelKey = (status: VerificationStatus): MessageKey => {
  if (status === 'detected') return 'elasticsVisible';
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
  t,
}: {
  state: AppState;
  t: (key: MessageKey) => string;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [routineFilter, setRoutineFilter] = useState<RoutineFilter>('all');
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

  return (
    <div className="content-screen parent-history-screen">
      <header className="screen-header">
        <div><small>{t('overview')}</small><h1>{t('responsibleHistoryTitle')}</h1><p>{t('responsibleHistoryHint')}</p></div>
        <div className="avatar">{state.family.childName.charAt(0)}</div>
      </header>

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
            {statuses.map((status) => <button type="button" key={status} className={statusFilter === status ? 'active' : ''} onClick={() => setStatusFilter(status)}>{t(statusLabelKey(status))}</button>)}
          </div>
        </div>
      </section>

      <div className="section-heading"><h2>{t('recentHistory')}</h2><span>{filtered.length}</span></div>
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
    </div>
  );
}
