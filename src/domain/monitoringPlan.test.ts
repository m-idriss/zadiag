import { describe, expect, it } from 'vitest';
import { translate } from '../services/i18n';
import { nextWindowId, normalizeWeekdays, summarizeWeekdays, validateMonitoringPlanDraft } from './monitoringPlan';

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
});
