export interface MonitoringPlan {
  checksPerDay: number;
  weekdays: number[];
  windows: Array<{ id: string; start: string; end: string }>;
  expiryMinutes: number;
  timeZone: string;
}

export interface PlannedCheckRecord {
  requestedAt?: string;
  status?: string;
  dispatchKey?: string;
}

export interface AutoDispatchDecision {
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

export const getLocalDateParts = (date: Date, timeZone: string): LocalDateParts => {
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

export const getLocalTimeMinutes = (date: Date, timeZone: string) => {
  const parts = getLocalDateParts(date, timeZone);
  return parts.hour * 60 + parts.minute;
};

export const getWindowForMinutes = (plan: MonitoringPlan, minutes: number) => {
  for (const window of plan.windows) {
    const [startHour, startMinute] = window.start.split(':').map(Number);
    const [endHour, endMinute] = window.end.split(':').map(Number);
    const start = (startHour * 60) + startMinute;
    const end = (endHour * 60) + endMinute;
    if (minutes >= start && minutes < end) return window;
  }
  return undefined;
};

export const getWindowForDate = (plan: MonitoringPlan, date: Date, timeZone: string) => {
  const minutes = getLocalTimeMinutes(date, timeZone);
  return getWindowForMinutes(plan, minutes);
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
  if (!plan.weekdays.includes(localParts.weekday)) {
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
