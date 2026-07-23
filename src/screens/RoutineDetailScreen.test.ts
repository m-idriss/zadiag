import { describe, expect, it } from 'vitest';
import { calendarDays, calendarMonthSections } from './RoutineDetailScreen';

describe('routine progress heatmap', () => {
  it('lays out each week from Monday to Sunday', () => {
    const days = calendarDays([], 'fr-FR', new Date(2026, 6, 3));

    expect(days).toHaveLength(63);
    expect(days[0]).toMatchObject({ weekday: 1, dayOfMonth: 1 });
    expect(days.at(-1)).toMatchObject({ weekday: 0, dayOfMonth: 2 });
    for (let week = 0; week < days.length / 7; week += 1) {
      expect(days[week * 7].weekday).toBe(1);
      expect(days[(week * 7) + 5].weekday).toBe(6);
      expect(days[(week * 7) + 6].weekday).toBe(0);
    }
  });

  it('marks the reference day as today for the visible calendar', () => {
    const days = calendarDays([], 'fr-FR', new Date(2026, 6, 3));

    expect(days.filter((day) => day.isToday)).toHaveLength(1);
    expect(days.find((day) => day.isToday)).toMatchObject({ dayOfMonth: 3 });
    expect(days.find((day) => day.dayOfMonth === 4 && day.monthKey === '2026-6')).toMatchObject({ isFuture: true });
  });

  it('groups the heatmap into previous and current month sections', () => {
    const days = calendarDays([], 'fr-FR', new Date(2026, 6, 3));
    const sections = calendarMonthSections(days, 'fr-FR', new Date(2026, 6, 3));

    expect(sections.map((section) => section.label)).toEqual(['Juin', 'Juillet']);
    expect(sections).toHaveLength(2);
    expect(sections.every((section) => section.weeks.every((week) => week.length === 7))).toBe(true);
    expect(sections[1].weeks.flat().some((day) => day.isOutsideMonth)).toBe(true);
  });

  it('maps routine events to daily heatmap states and intensity levels', () => {
    const days = calendarDays([
      { id: 'done-1', routineId: 'routine', sessionId: 'one', requestedAt: '2026-07-02T08:00:00.000Z', expiresAt: '2026-07-02T09:00:00.000Z', status: 'detected' },
      { id: 'done-2', routineId: 'routine', sessionId: 'two', requestedAt: '2026-07-02T10:00:00.000Z', expiresAt: '2026-07-02T11:00:00.000Z', status: 'answered' },
      { id: 'review', routineId: 'routine', sessionId: 'three', requestedAt: '2026-07-03T08:00:00.000Z', expiresAt: '2026-07-03T09:00:00.000Z', status: 'uncertain' },
      { id: 'missed', routineId: 'routine', sessionId: 'four', requestedAt: '2026-07-04T08:00:00.000Z', expiresAt: '2026-07-04T09:00:00.000Z', status: 'missed' },
    ], 'en-US', new Date(2026, 6, 5));

    expect(days.find((day) => day.dateLabel === 'Jul 2, 2026')).toMatchObject({ status: 'completed', level: 2, successful: 2 });
    expect(days.find((day) => day.dateLabel === 'Jul 3, 2026')).toMatchObject({ status: 'attention', attention: 1 });
    expect(days.find((day) => day.dateLabel === 'Jul 4, 2026')).toMatchObject({ status: 'missed', missed: 1 });
  });

  it('exposes daily status proportions for mixed-status days', () => {
    const days = calendarDays([
      { id: 'done', routineId: 'routine', sessionId: 'one', requestedAt: '2026-07-02T08:00:00.000Z', expiresAt: '2026-07-02T09:00:00.000Z', status: 'detected' },
      { id: 'review', routineId: 'routine', sessionId: 'two', requestedAt: '2026-07-02T10:00:00.000Z', expiresAt: '2026-07-02T11:00:00.000Z', status: 'uncertain' },
      { id: 'missed', routineId: 'routine', sessionId: 'three', requestedAt: '2026-07-02T12:00:00.000Z', expiresAt: '2026-07-02T13:00:00.000Z', status: 'missed' },
    ], 'en-US', new Date(2026, 6, 5));

    expect(days.find((day) => day.dateLabel === 'Jul 2, 2026')).toMatchObject({
      total: 3,
      successfulShare: 33,
      attentionShare: 33,
      missedShare: 33,
    });
  });
});
