import { describe, expect, it } from 'vitest';
import { translate } from '../services/i18n';
import { dayPeriodLabelKey, eventWindowLabel, plannedWindowLabel } from './taskTimeLabel';

describe('task time labels', () => {
  it('labels checks from their expiry time', () => {
    expect(dayPeriodLabelKey('2026-07-04T04:58:00.000Z')).toBe('thisMorning');
    expect(dayPeriodLabelKey('2026-07-04T14:00:00.000Z')).toBe('thisAfternoon');
    expect(dayPeriodLabelKey('2026-07-04T20:00:00.000Z')).toBe('thisEvening');
  });

  it('shows the day period with the start and end of the window', () => {
    const t = (key: Parameters<typeof translate>[1]) => translate('en', key);
    expect(plannedWindowLabel(
      new Date('2026-07-04T18:00:00'),
      new Date('2026-07-04T20:00:00'),
      new Date('2026-07-04T12:00:00'),
      'en-US',
      t,
    )).toBe('This evening · 6:00 PM-8:00 PM');
    expect(eventWindowLabel(
      '2026-07-04T12:00:00',
      '2026-07-04T14:00:00',
      new Date('2026-07-04T10:00:00'),
      'fr-FR',
      (key) => translate('fr', key),
    )).toBe('Cet après-midi · 12:00-14:00');
  });
});
