import type { MessageKey } from '../services/i18n';

export const dayPeriodLabelKey = (value: string): MessageKey => {
  const hour = new Date(value).getHours();
  if (hour < 12) return 'thisMorning';
  if (hour < 18) return 'thisAfternoon';
  return 'thisEvening';
};
