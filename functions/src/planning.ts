import { z } from 'zod';

export interface MonitoringPlan {
  checksPerDay: number;
  weekdays: number[];
  windows: Array<{ id: string; start: string; end: string }>;
  scheduleGroups?: Array<{
    id: string;
    label?: string;
    weekdays: number[];
    windows: Array<{ id: string; start: string; end: string }>;
  }>;
  expiryMinutes: number;
  timeZone: string;
}

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const minutesForTime = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const timeWindowSchema = z.object({
  id: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/i),
  start: z.string().regex(timePattern),
  end: z.string().regex(timePattern),
}).strict().refine((window) => minutesForTime(window.start) < minutesForTime(window.end), {
  message: 'Window end must be after its start.',
});

const weekdaySchema = z.array(z.number().int().min(1).max(7)).min(1).max(7)
  .refine((days) => new Set(days).size === days.length, { message: 'Weekdays must be unique.' });

const scheduleGroupSchema = z.object({
  id: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/i),
  label: z.string().trim().min(1).max(60).optional(),
  weekdays: weekdaySchema,
  windows: z.array(timeWindowSchema).min(1).max(12),
}).strict();

export const monitoringPlanSchema = z.object({
  checksPerDay: z.number().int().min(1).max(12),
  weekdays: weekdaySchema,
  windows: z.array(timeWindowSchema).min(1).max(12),
  scheduleGroups: z.array(scheduleGroupSchema).min(1).max(12).optional(),
  expiryMinutes: z.number().int().min(0).max(120),
  timeZone: z.string().min(1).max(100).refine((timeZone) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone }).format();
      return true;
    } catch {
      return false;
    }
  }, { message: 'Invalid time zone.' }),
}).strict().superRefine((plan, context) => {
  if (plan.checksPerDay > plan.windows.length) {
    context.addIssue({ code: 'custom', path: ['checksPerDay'], message: 'Checks per day cannot exceed the number of windows.' });
  }
  if (new Set(plan.windows.map((window) => window.id)).size !== plan.windows.length) {
    context.addIssue({ code: 'custom', path: ['windows'], message: 'Window IDs must be unique.' });
  }
  if (plan.scheduleGroups && new Set(plan.scheduleGroups.map((group) => group.id)).size !== plan.scheduleGroups.length) {
    context.addIssue({ code: 'custom', path: ['scheduleGroups'], message: 'Schedule group IDs must be unique.' });
  }
});

interface PlannedCheckRecord {
  requestedAt?: string;
  status?: string;
  dispatchKey?: string;
}

interface AutoDispatchDecision {
  shouldDispatch: boolean;
  windowId?: string;
  dispatchKey?: string;
  reason:
    | 'outside_window'
    | 'weekday_blocked'
    | 'quota_reached'
    | 'already_dispatched'
    | 'active_check'
    | 'ready';
}

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const WEEKDAY_LOOKUP: Record<string, number> = {
  Sun: 7,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const getLocalDateParts = (date: Date, timeZone: string): LocalDateParts => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '0';
  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    hour: Number(value('hour')),
    minute: Number(value('minute')),
    weekday: WEEKDAY_LOOKUP[value('weekday')] ?? 0,
  };
};

export const getLocalDateKey = (date: Date, timeZone: string) => {
  const parts = getLocalDateParts(date, timeZone);
  return `${parts.year.toString().padStart(4, '0')}-${parts.month.toString().padStart(2, '0')}-${parts.day.toString().padStart(2, '0')}`;
};

const getLocalTimeMinutes = (date: Date, timeZone: string) => {
  const parts = getLocalDateParts(date, timeZone);
  return parts.hour * 60 + parts.minute;
};

const getWindowForMinutes = (plan: MonitoringPlan, minutes: number) => {
  for (const window of plan.windows) {
    const [startHour, startMinute] = window.start.split(':').map(Number);
    const [endHour, endMinute] = window.end.split(':').map(Number);
    const start = (startHour * 60) + startMinute;
    const end = (endHour * 60) + endMinute;
    if (minutes >= start && minutes < end) return window;
  }
  return undefined;
};

const getWindowsForWeekday = (plan: MonitoringPlan, weekday: number) => {
  if (!plan.scheduleGroups?.length) return plan.weekdays.includes(weekday) ? plan.windows : [];
  return plan.scheduleGroups
    .filter((group) => group.weekdays.includes(weekday))
    .flatMap((group) => group.windows.map((window) => ({
      ...window,
      id: `${group.id}_${window.id}`,
    })));
};

const getWindowForMinutesAndWeekday = (plan: MonitoringPlan, minutes: number, weekday: number) => {
  for (const window of getWindowsForWeekday(plan, weekday)) {
    const [startHour, startMinute] = window.start.split(':').map(Number);
    const [endHour, endMinute] = window.end.split(':').map(Number);
    const start = (startHour * 60) + startMinute;
    const end = (endHour * 60) + endMinute;
    if (minutes >= start && minutes < end) return window;
  }
  return undefined;
};

export const getWindowForDate = (plan: MonitoringPlan, date: Date, timeZone: string) => {
  const parts = getLocalDateParts(date, timeZone);
  return plan.scheduleGroups?.length
    ? getWindowForMinutesAndWeekday(plan, (parts.hour * 60) + parts.minute, parts.weekday)
    : getWindowForMinutes(plan, (parts.hour * 60) + parts.minute);
};

const weekdayAfterOffset = (weekday: number, offset: number) => ((weekday + offset - 1) % 7) + 1;

const nextWindowEndDelayMinutes = (plan: MonitoringPlan, now: Date) => {
  const localParts = getLocalDateParts(now, plan.timeZone);
  const localMinutes = (localParts.hour * 60) + localParts.minute;

  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    const weekday = weekdayAfterOffset(localParts.weekday, dayOffset);
    const windows = getWindowsForWeekday(plan, weekday)
      .slice()
      .sort((a, b) => minutesForTime(a.start) - minutesForTime(b.start));

    for (const window of windows) {
      const windowEnd = minutesForTime(window.end);
      if (dayOffset === 0 && localMinutes >= windowEnd) continue;
      return (dayOffset * 24 * 60) + windowEnd - localMinutes;
    }
  }

  return undefined;
};

export const checkExpiresAt = (plan: MonitoringPlan, now: Date, fallbackMinutes = 20) => {
  const localMinutes = getLocalTimeMinutes(now, plan.timeZone);
  const window = getWindowForDate(plan, now, plan.timeZone);
  const windowEnd = window
    ? new Date(now.getTime() + Math.max(1, minutesForTime(window.end) - localMinutes) * 60 * 1000)
    : undefined;

  if (plan.expiryMinutes > 0) {
    const fixedDelayEnd = new Date(now.getTime() + plan.expiryMinutes * 60 * 1000);
    return windowEnd && windowEnd.getTime() < fixedDelayEnd.getTime() ? windowEnd : fixedDelayEnd;
  }

  const fullWindowDelayMinutes = nextWindowEndDelayMinutes(plan, now);
  return new Date(now.getTime() + (fullWindowDelayMinutes ?? fallbackMinutes) * 60 * 1000);
};

export const shouldAutoDispatchCheck = (
  plan: MonitoringPlan,
  recentChecks: PlannedCheckRecord[],
  now: Date,
  timeZone: string,
  hasActivePendingCheck: boolean,
): AutoDispatchDecision => {
  if (hasActivePendingCheck) {
    return { shouldDispatch: false, reason: 'active_check' };
  }

  const localParts = getLocalDateParts(now, timeZone);
  const windowsForToday = getWindowsForWeekday(plan, localParts.weekday);
  if (!windowsForToday.length) {
    return { shouldDispatch: false, reason: 'weekday_blocked' };
  }

  const window = getWindowForDate(plan, now, timeZone);
  if (!window) {
    return { shouldDispatch: false, reason: 'outside_window' };
  }

  const localDateKey = getLocalDateKey(now, timeZone);
  const todaysChecks = recentChecks.filter((check) => {
    if (!check.requestedAt) return false;
    return getLocalDateKey(new Date(check.requestedAt), timeZone) === localDateKey;
  });

  if (todaysChecks.length >= plan.checksPerDay) {
    return { shouldDispatch: false, reason: 'quota_reached' };
  }

  const alreadyDispatchedThisWindow = todaysChecks.some((check) => {
    if (check.dispatchKey) return check.dispatchKey === `${localDateKey}_${window.id}`;
    if (!check.requestedAt) return false;
    const pastWindow = getWindowForDate(plan, new Date(check.requestedAt), timeZone);
    return pastWindow?.id === window.id;
  });

  if (alreadyDispatchedThisWindow) {
    return { shouldDispatch: false, reason: 'already_dispatched' };
  }

  return {
    shouldDispatch: true,
    reason: 'ready',
    windowId: window.id,
    dispatchKey: `${localDateKey}_${window.id}`,
  };
};
