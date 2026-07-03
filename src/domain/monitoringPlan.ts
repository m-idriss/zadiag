import type { TimeWindow } from './models';

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
