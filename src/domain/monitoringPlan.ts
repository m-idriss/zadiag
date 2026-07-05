import type { MonitoringPlan, ScheduleGroup, TimeWindow } from './models';

const weekdayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
type MonitoringPlanMessageKey =
  | typeof weekdayKeys[number]
  | 'everyDay'
  | 'weekdaysOnly'
  | 'addTimeWindowError'
  | 'selectDayError'
  | 'invalidInput'
  | 'maxScheduleGroupsError'
  | 'maxTimeWindowsError';

export const MAX_SCHEDULE_GROUPS = 12;
export const MAX_TIME_WINDOWS = 12;
const DEFAULT_EXPIRY_MINUTES = 20;
const FALLBACK_TIME_ZONE = 'Europe/Paris';

const validTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const minutesForTime = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const isValidWindow = (window: TimeWindow) =>
  validTimePattern.test(window.start)
  && validTimePattern.test(window.end)
  && minutesForTime(window.start) < minutesForTime(window.end);

const currentTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
};

const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
};

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

export type PlannedWindow = {
  start: Date;
  end: Date;
};

const planWeekdayForDate = (date: Date) => {
  const day = date.getDay();
  return day === 0 ? 7 : day;
};

const dateWithTime = (date: Date, value: string) => {
  const next = new Date(date);
  const [hours, minutes] = value.split(':').map(Number);
  next.setHours(hours, minutes, 0, 0);
  return next;
};

export const nextPlannedWindow = (
  plan: Pick<MonitoringPlan, 'weekdays' | 'windows' | 'scheduleGroups'>,
  now = new Date(),
): PlannedWindow | undefined => {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const candidates: PlannedWindow[] = [];
  const groups = groupsFromLegacyPlan(plan);

  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date(dayStart);
    date.setDate(dayStart.getDate() + offset);
    const weekday = planWeekdayForDate(date);

    groups.forEach((group) => {
      if (!normalizeWeekdays(group.weekdays).includes(weekday)) return;
      group.windows.filter(isValidWindow).forEach((window) => {
        const start = dateWithTime(date, window.start);
        const end = dateWithTime(date, window.end);
        if (start.getTime() > now.getTime()) candidates.push({ start, end });
      });
    });
  }

  return candidates.sort((a, b) => a.start.getTime() - b.start.getTime())[0];
};

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
  if (groups.some((group) => group.windows.some((window) => !isValidWindow(window)))) return 'invalidInput';
  if (groups.length > MAX_SCHEDULE_GROUPS) return 'maxScheduleGroupsError';
  if (flattenScheduleGroups(groups).windows.length > MAX_TIME_WINDOWS) return 'maxTimeWindowsError';
  return undefined;
};

export const buildMonitoringPlanFromGroups = (plan: Partial<MonitoringPlan>, groups: ScheduleGroup[]): MonitoringPlan => {
  const flattened = flattenScheduleGroups(groups);
  const normalizedGroups = groups.map((group) => {
    const label = group.label?.trim();
    return {
      id: group.id,
      ...(label ? { label } : {}),
      weekdays: normalizeWeekdays(group.weekdays),
      windows: group.windows.map((window) => ({
        id: window.id,
        start: window.start,
        end: window.end,
      })),
    };
  });

  return {
    checksPerDay: maxChecksPerActiveDay(groups),
    weekdays: flattened.weekdays,
    windows: flattened.windows,
    scheduleGroups: normalizedGroups,
    expiryMinutes: Number.isInteger(plan.expiryMinutes) && Number(plan.expiryMinutes) >= 1 && Number(plan.expiryMinutes) <= 120
      ? Number(plan.expiryMinutes)
      : DEFAULT_EXPIRY_MINUTES,
    timeZone: typeof plan.timeZone === 'string' && plan.timeZone && isValidTimeZone(plan.timeZone)
      ? plan.timeZone
      : currentTimeZone(),
  };
};
