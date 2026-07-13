type TaskTimeLabelKey = 'thisMorning' | 'thisAfternoon' | 'thisEvening' | 'tomorrow';

export const dayPeriodLabelKey = (value: string): TaskTimeLabelKey => {
  const hour = new Date(value).getHours();
  if (hour < 12) return 'thisMorning';
  if (hour < 18) return 'thisAfternoon';
  return 'thisEvening';
};

const isSameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

const nextDay = (date: Date) => {
  const next = new Date(date);
  next.setDate(date.getDate() + 1);
  return next;
};

export const plannedWindowLabel = (
  windowStart: Date,
  windowEnd: Date,
  now: Date,
  locale: string,
  t: (key: TaskTimeLabelKey) => string,
) => {
  const dayLabel = isSameLocalDay(windowStart, now)
    ? t(dayPeriodLabelKey(windowStart.toISOString()))
    : isSameLocalDay(windowStart, nextDay(now))
      ? t('tomorrow')
      : new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(windowStart);
  const formatter = new Intl.DateTimeFormat(locale, { timeStyle: 'short' });
  return `${dayLabel} · ${formatter.format(windowStart)}-${formatter.format(windowEnd)}`;
};

export const eventWindowLabel = (
  windowStart: string,
  windowEnd: string,
  now: Date,
  locale: string,
  t: (key: TaskTimeLabelKey) => string,
) => plannedWindowLabel(new Date(windowStart), new Date(windowEnd), now, locale, t);
