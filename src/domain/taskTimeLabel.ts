import type { MessageKey } from '../services/i18n';

export const dayPeriodLabelKey = (value: string): MessageKey => {
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
  windowEnd: Date,
  now: Date,
  locale: string,
  t: (key: MessageKey) => string,
) => {
  const dayLabel = isSameLocalDay(windowEnd, now)
    ? t(dayPeriodLabelKey(windowEnd.toISOString()))
    : isSameLocalDay(windowEnd, nextDay(now))
      ? t('tomorrow')
      : new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(windowEnd);
  return `${dayLabel} · ${t('before')} ${new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(windowEnd)}`;
};
