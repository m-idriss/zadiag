import { describe, expect, it } from 'vitest';
import { translate } from '../services/i18n';
import {
  flattenScheduleGroups,
  groupsFromLegacyPlan,
  maxChecksPerActiveDay,
  nextWindowId,
  normalizeWeekdays,
  summarizeWeekdays,
  validateMonitoringPlanDraft,
  validateScheduleGroupsDraft,
} from './monitoringPlan';

describe('monitoring plan helpers', () => {
  it('normalizes weekdays and summarizes common schedules', () => {
    expect(normalizeWeekdays([7, 1, 1, 9, 0, 3])).toEqual([1, 3, 7]);
    expect(summarizeWeekdays([1, 2, 3, 4, 5, 6, 7], (key) => translate('en', key))).toBe('Every day');
    expect(summarizeWeekdays([1, 2, 3, 4, 5], (key) => translate('fr', key))).toBe('Du lundi au vendredi');
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
});
