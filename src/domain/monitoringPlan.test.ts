import { describe, expect, it } from 'vitest';
import { translate } from '../services/i18n';
import {
  buildMonitoringPlanFromGroups,
  flattenScheduleGroups,
  groupsFromLegacyPlan,
  maxChecksPerActiveDay,
  nextPlannedWindow,
  nextWindowId,
  normalizeWeekdays,
  responseWindowExpiresAt,
  summarizeWeekdays,
  summarizeWeekdaysShort,
  validateMonitoringPlanDraft,
  validateScheduleGroupsDraft,
} from './monitoringPlan';

describe('monitoring plan helpers', () => {
  it('normalizes weekdays and summarizes common schedules', () => {
    expect(normalizeWeekdays([7, 1, 1, 9, 0, 3])).toEqual([1, 3, 7]);
    expect(summarizeWeekdays([1, 2, 3, 4, 5, 6, 7], (key) => translate('en', key))).toBe('Every day');
    expect(summarizeWeekdays([1, 2, 3, 4, 5], (key) => translate('fr', key))).toBe('Du lundi au vendredi');
    expect(summarizeWeekdaysShort([6, 7], (key) => translate('fr', key))).toBe('Sam, Dim');
  });

  it('creates stable unique ids when windows have been removed', () => {
    expect(nextWindowId([{ id: 'w1' }, { id: 'w3' }])).toBe('w4');
    expect(nextWindowId([{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }])).toBe('w4');
  });

  it('returns localized validation keys for incomplete drafts', () => {
    expect(validateMonitoringPlanDraft([], [1])).toBe('addTimeWindowError');
    expect(validateMonitoringPlanDraft([{ id: 'w1', start: '09:00', end: '17:00' }], [])).toBe('selectDayError');
    expect(validateMonitoringPlanDraft([{ id: 'w1', start: '09:00', end: '17:00' }], [1])).toBeUndefined();
  });

  it('builds grouped schedules while preserving legacy plans', () => {
    const groups = groupsFromLegacyPlan({
      weekdays: [1, 2, 3],
      windows: [{ id: 'morning', start: '07:30', end: '09:30' }],
    });
    expect(groups).toEqual([{ id: 'g1', label: undefined, weekdays: [1, 2, 3], windows: [{ id: 'morning', start: '07:30', end: '09:30' }] }]);
    expect(flattenScheduleGroups(groups).windows[0].id).toBe('g1_morning');
  });

  it('validates and counts grouped schedules per active day', () => {
    const groups = [
      { id: 'week', weekdays: [1, 2, 3, 4, 5], windows: [{ id: 'morning', start: '07:30', end: '09:30' }, { id: 'evening', start: '17:00', end: '20:00' }] },
      { id: 'weekend', weekdays: [6, 7], windows: [{ id: 'late', start: '10:00', end: '12:00' }] },
    ];
    expect(validateScheduleGroupsDraft(groups)).toBeUndefined();
    expect(maxChecksPerActiveDay(groups)).toBe(2);
  });

  it('rejects drafts that exceed the server schedule limits', () => {
    const groups = [{
      id: 'g1',
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      windows: Array.from({ length: 13 }, (_, index) => ({
        id: `w${index + 1}`,
        start: '09:00',
        end: '17:00',
      })),
    }];

    expect(validateScheduleGroupsDraft(groups)).toBe('maxTimeWindowsError');
  });

  it('normalizes legacy plans before saving grouped schedules', () => {
    const groups = [{
      id: 'g1',
      label: '',
      weekdays: [7, 1, 1],
      windows: [{ id: 'morning', start: '07:30', end: '09:30' }],
    }];

    const plan = buildMonitoringPlanFromGroups({ weekdays: [1], windows: [] }, groups);

    expect(plan).toMatchObject({
      checksPerDay: 1,
      weekdays: [1, 7],
      windows: [{ id: 'g1_morning', start: '07:30', end: '09:30' }],
      expiryMinutes: 0,
    });
    expect(plan.timeZone).toBeTruthy();
    expect(plan.scheduleGroups?.[0]).toEqual({
      id: 'g1',
      weekdays: [1, 7],
      windows: [{ id: 'morning', start: '07:30', end: '09:30' }],
    });
  });

  it('keeps zero response delay as the full active window', () => {
    const groups = [{
      id: 'g1',
      weekdays: [2],
      windows: [{ id: 'morning', start: '07:30', end: '09:30' }],
    }];

    const plan = buildMonitoringPlanFromGroups({ expiryMinutes: 0 }, groups);
    const expiresAt = responseWindowExpiresAt(plan, new Date(2026, 6, 7, 8, 15));

    expect(plan.expiryMinutes).toBe(0);
    expect(expiresAt.getHours()).toBe(9);
    expect(expiresAt.getMinutes()).toBe(30);
  });

  it('caps fixed response delay at the active window end', () => {
    const groups = [{
      id: 'g1',
      weekdays: [2],
      windows: [{ id: 'morning', start: '07:30', end: '09:30' }],
    }];

    const plan = buildMonitoringPlanFromGroups({ expiryMinutes: 60 }, groups);
    const expiresAt = responseWindowExpiresAt(plan, new Date(2026, 6, 7, 9, 0));

    expect(expiresAt.getHours()).toBe(9);
    expect(expiresAt.getMinutes()).toBe(30);
  });

  it('finds the next planned window when no check is currently pending', () => {
    const plan = buildMonitoringPlanFromGroups({}, [{
      id: 'g1',
      weekdays: [1, 2, 3, 4, 5],
      windows: [
        { id: 'morning', start: '07:30', end: '09:30' },
        { id: 'lunch', start: '12:00', end: '14:00' },
      ],
    }]);

    const nextToday = nextPlannedWindow(plan, new Date(2026, 6, 6, 10, 0));
    expect(nextToday?.start.getHours()).toBe(12);
    expect(nextToday?.end.getHours()).toBe(14);

    const nextTomorrow = nextPlannedWindow(plan, new Date(2026, 6, 6, 21, 0));
    expect(nextTomorrow?.start.getDate()).toBe(7);
    expect(nextTomorrow?.start.getHours()).toBe(7);
    expect(nextTomorrow?.start.getMinutes()).toBe(30);
  });
});
