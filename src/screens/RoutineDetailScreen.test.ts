import { describe, expect, it } from 'vitest';
import { calendarDays } from './RoutineDetailScreen';

describe('routine progress heatmap', () => {
  it('lays out each week from Monday to Sunday', () => {
    const days = calendarDays([], 'fr-FR', new Date(2026, 6, 3));

    expect(days).toHaveLength(28);
    for (let week = 0; week < 4; week += 1) {
      expect(days[week * 7].weekday).toBe(1);
      expect(days[(week * 7) + 5].weekday).toBe(6);
      expect(days[(week * 7) + 6].weekday).toBe(0);
    }
  });

  it('maps routine events to daily heatmap states and intensity levels', () => {
    const days = calendarDays([
      { id: 'done-1', routineId: 'routine', sessionId: 'one', requestedAt: '2026-07-02T08:00:00.000Z', expiresAt: '2026-07-02T09:00:00.000Z', status: 'detected' },
      { id: 'done-2', routineId: 'routine', sessionId: 'two', requestedAt: '2026-07-02T10:00:00.000Z', expiresAt: '2026-07-02T11:00:00.000Z', status: 'detected' },
      { id: 'review', routineId: 'routine', sessionId: 'three', requestedAt: '2026-07-03T08:00:00.000Z', expiresAt: '2026-07-03T09:00:00.000Z', status: 'uncertain' },
      { id: 'missed', routineId: 'routine', sessionId: 'four', requestedAt: '2026-07-04T08:00:00.000Z', expiresAt: '2026-07-04T09:00:00.000Z', status: 'missed' },
    ], 'en-US', new Date(2026, 6, 5));

    expect(days.find((day) => day.dateLabel === 'Jul 2, 2026')).toMatchObject({ status: 'completed', level: 2, successful: 2 });
    expect(days.find((day) => day.dateLabel === 'Jul 3, 2026')).toMatchObject({ status: 'attention', attention: 1 });
    expect(days.find((day) => day.dateLabel === 'Jul 4, 2026')).toMatchObject({ status: 'missed', missed: 1 });
  });
});
