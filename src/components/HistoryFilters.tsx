import { useEffect, useState } from 'react';
import type { Locale, RoutineAssignment, VerificationEvent, VerificationStatus } from '../domain/models';
import { isSuccessfulVerification, withResolvedEventStatuses } from '../domain/adherence';
import { coalesceActivePendingEventsByRoutine } from '../domain/dashboardChecks';
import { presentRoutine } from '../domain/routinePresentation';
import type { MessageKey } from '../services/i18n';
import { readUiStorageJson, writeUiStorageString } from '../services/uiStorage';
import { statusMessageKey } from './StatusPill';

const historyFilterStorageKey = (titleId: string) => `zadiag.historyFilters.${titleId}`;

const readStoredFilters = (titleId: string) => {
  const empty = { statuses: [] as VerificationStatus[], routineIds: [] as string[] };
  return readUiStorageJson(historyFilterStorageKey(titleId), empty, (value) => {
    const parsed = value as Partial<{ statuses: VerificationStatus[]; routineIds: string[] }>;
    return {
      statuses: Array.isArray(parsed.statuses) ? parsed.statuses : [],
      routineIds: Array.isArray(parsed.routineIds) ? parsed.routineIds : [],
    };
  });
};

export const groupedVerificationStatuses = (statuses: VerificationStatus[]) => {
  const groups = new Map<VerificationStatus, VerificationStatus[]>();
  statuses.forEach((eventStatus) => {
    const status = isSuccessfulVerification({ status: eventStatus }) ? 'detected' : eventStatus;
    groups.set(status, [...(groups.get(status) ?? []), eventStatus]);
  });
  return Array.from(groups, ([status, eventStatuses]) => ({ status, eventStatuses }));
};

export function useHistoryFilters(titleId: string) {
  const [excludedStatuses, setExcludedStatuses] = useState<VerificationStatus[]>(() => readStoredFilters(titleId).statuses);
  const [excludedRoutineIds, setExcludedRoutineIds] = useState<string[]>(() => readStoredFilters(titleId).routineIds);
  useEffect(() => {
    writeUiStorageString(historyFilterStorageKey(titleId), JSON.stringify({
      statuses: excludedStatuses,
      routineIds: excludedRoutineIds,
    }));
  }, [excludedRoutineIds, excludedStatuses, titleId]);
  return {
    excludedStatuses,
    excludedRoutineIds,
    toggleRoutine: (routineId: string) => setExcludedRoutineIds((current) =>
      current.includes(routineId) ? current.filter((item) => item !== routineId) : [...current, routineId]),
    toggleStatuses: (statuses: VerificationStatus[]) => setExcludedStatuses((current) => {
      const allActive = statuses.every((status) => !current.includes(status));
      return allActive
        ? Array.from(new Set([...current, ...statuses]))
        : current.filter((status) => !statuses.includes(status));
    }),
  };
}

export function HistoryFilterControls({
  assignments,
  events,
  locale,
  excludedRoutineIds,
  excludedStatuses,
  onToggleRoutine,
  onToggleStatuses,
  t,
}: {
  assignments: RoutineAssignment[];
  events: VerificationEvent[];
  locale: Locale;
  excludedRoutineIds: string[];
  excludedStatuses: VerificationStatus[];
  onToggleRoutine: (routineId: string) => void;
  onToggleStatuses: (statuses: VerificationStatus[]) => void;
  t: (key: MessageKey) => string;
}) {
  const now = Date.now();
  const statuses = groupedVerificationStatuses(Array.from(new Set(
    withResolvedEventStatuses(coalesceActivePendingEventsByRoutine(events, now), now)
      .map((event) => event.status),
  )));
  return (
    <div className="history-filter-controls">
      <div className="filter-group">
        <span>{t('filterByRoutine')}</span>
        <div className="filter-chips">
          {assignments.map((assignment) => {
            const visual = presentRoutine(assignment.routine, locale);
            const active = !excludedRoutineIds.includes(assignment.routineId);
            return <button type="button" key={assignment.id} aria-pressed={active} className={active ? 'active' : ''} onClick={() => onToggleRoutine(assignment.routineId)}>{visual.name}</button>;
          })}
        </div>
      </div>
      <div className="filter-group">
        <span>{t('filterByStatus')}</span>
        <div className="filter-chips">
          {statuses.map(({ status, eventStatuses }) => {
            const active = eventStatuses.every((eventStatus) => !excludedStatuses.includes(eventStatus));
            return <button type="button" key={status} aria-pressed={active} className={`filter-status-${status} ${active ? 'active' : ''}`} onClick={() => onToggleStatuses(eventStatuses)}>{t(statusMessageKey(status))}</button>;
          })}
        </div>
      </div>
    </div>
  );
}
