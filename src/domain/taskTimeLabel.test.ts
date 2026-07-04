import { describe, expect, it } from 'vitest';
import { dayPeriodLabelKey } from './taskTimeLabel';

describe('task time labels', () => {
  it('labels checks from their expiry time', () => {
    expect(dayPeriodLabelKey('2026-07-04T04:58:00.000Z')).toBe('thisMorning');
    expect(dayPeriodLabelKey('2026-07-04T14:00:00.000Z')).toBe('thisAfternoon');
    expect(dayPeriodLabelKey('2026-07-04T20:00:00.000Z')).toBe('thisEvening');
  });
});
