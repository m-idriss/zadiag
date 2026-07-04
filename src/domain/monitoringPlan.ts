import type { ScheduleGroup, TimeWindow } from './models';

const weekdayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type MonitoringPlanMessageKey =
  | typeof weekdayKeys[number]
  | 'everyDay'
  | 'weekdaysOnly'
  | 'addTimeWindowError'
  | 'selectDayError';

export const normalizeWeekdays = (weekdays: number[]) =>
  [...new Set(weekdays)].filter((day) => day >= 1 && day <= 7).sort((a, b) => a - b);

export const nextWindowId = (windows: Pick<TimeWindow, 'id'>[]) => {
  const existing = new Set(windows.map((window) => window.id));
  let index = windows.length + 1;
  while (existing.has(`w${index}`)) index += 1;
  return `w${index}`;
};

export const nextScheduleGroupId = (groups: Pick<ScheduleGroup, 'id'>[]) => {
  const existing = new Set(groups.map((group) => group.id));
  let index = groups.length + 1;
  while (existing.has(`g${index}`)) index += 1;
  return `g${index}`;
};

export const summarizeWeekdays = (weekdays: number[], t: (key: MonitoringPlanMessageKey) => string) => {
  const normalized = normalizeWeekdays(weekdays);
  if (normalized.length === 0) return '-';
  if (normalized.length === 7) return t('everyDay');
  if (normalized.length === 5 && normalized.every((day) => day <= 5)) return t('weekdaysOnly');
  return normalized.map((day) => t(weekdayKeys[day - 1])).join(', ');
};

export const validateMonitoringPlanDraft = (windows: TimeWindow[], weekdays: number[]): MonitoringPlanMessageKey | undefined => {
  if (windows.length === 0) return 'addTimeWindowError';
  if (normalizeWeekdays(weekdays).length === 0) return 'selectDayError';
  return undefined;
};

export const groupsFromLegacyPlan = (plan: { weekdays: number[]; windows: TimeWindow[]; scheduleGroups?: ScheduleGroup[] }) =>
  plan.scheduleGroups?.length
    ? plan.scheduleGroups.map((group) => ({
        ...group,
        weekdays: normalizeWeekdays(group.weekdays),
        windows: group.windows,
      }))
    : [{
        id: 'g1',
        label: undefined,
        weekdays: normalizeWeekdays(plan.weekdays),
        windows: plan.windows,
      }];

export const flattenScheduleGroups = (groups: ScheduleGroup[]) => {
  const windows = groups.flatMap((group) => group.windows.map((window) => ({
    ...window,
    id: `${group.id}_${window.id}`,
  })));
  const weekdays = normalizeWeekdays(groups.flatMap((group) => group.weekdays));
  return { windows, weekdays };
};

export const maxChecksPerActiveDay = (groups: ScheduleGroup[]) => {
  const counts = new Map<number, number>();
  groups.forEach((group) => {
    normalizeWeekdays(group.weekdays).forEach((day) => {
      counts.set(day, (counts.get(day) ?? 0) + group.windows.length);
    });
  });
  return Math.max(1, ...counts.values());
};

export const validateScheduleGroupsDraft = (groups: ScheduleGroup[]): MonitoringPlanMessageKey | undefined => {
  if (groups.every((group) => group.windows.length === 0)) return 'addTimeWindowError';
  if (groups.some((group) => normalizeWeekdays(group.weekdays).length === 0)) return 'selectDayError';
  return undefined;
};
