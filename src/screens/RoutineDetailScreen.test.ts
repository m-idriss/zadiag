import { describe, expect, it } from 'vitest';
import { calendarDays } from './RoutineDetailScreen';

describe('routine progress calendar', () => {
  it('lays out each week from Monday to Sunday', () => {
    const days = calendarDays([], 'fr-FR', new Date(2026, 6, 3));

    expect(days).toHaveLength(28);
    for (let week = 0; week < 4; week += 1) {
      expect(days[week * 7].weekday).toBe(1);
      expect(days[(week * 7) + 5].weekday).toBe(6);
      expect(days[(week * 7) + 6].weekday).toBe(0);
    }
  });
});
