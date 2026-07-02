import assert from 'node:assert/strict';
import test from 'node:test';
import { monitoringPlanSchema, shouldAutoDispatchCheck } from './planning.js';

const plan = {
  checksPerDay: 3,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  windows: [
    { id: 'morning', start: '07:30', end: '09:30' },
    { id: 'midday', start: '12:00', end: '14:00' },
    { id: 'evening', start: '17:00', end: '20:00' },
  ],
  expiryMinutes: 20,
  timeZone: 'Europe/Paris',
};

test('validates monitoring plans at the callable boundary', () => {
  assert.equal(monitoringPlanSchema.safeParse(plan).success, true);
  assert.equal(monitoringPlanSchema.safeParse({ ...plan, timeZone: 'Not/AZone' }).success, false);
  assert.equal(monitoringPlanSchema.safeParse({ ...plan, expiryMinutes: 0 }).success, false);
  assert.equal(monitoringPlanSchema.safeParse({ ...plan, weekdays: [1, 1] }).success, false);
  assert.equal(monitoringPlanSchema.safeParse({
    ...plan,
    windows: [{ id: 'invalid', start: '20:00', end: '08:00' }],
  }).success, false);
});

test('allows a check inside the current window when quota is available', () => {
  const now = new Date('2026-07-02T06:45:00.000Z');
  const decision = shouldAutoDispatchCheck(
    plan,
    [],
    now,
    'Europe/Paris',
    false,
  );
  assert.equal(decision.shouldDispatch, true);
  assert.equal(decision.reason, 'ready');
  assert.equal(decision.windowId, 'morning');
});

test('blocks when a check already exists in the same window', () => {
  const now = new Date('2026-07-02T06:45:00.000Z');
  const decision = shouldAutoDispatchCheck(
    plan,
    [
      { requestedAt: '2026-07-02T06:10:00.000Z' },
    ],
    now,
    'Europe/Paris',
    false,
  );
  assert.equal(decision.shouldDispatch, false);
  assert.equal(decision.reason, 'already_dispatched');
});

test('blocks outside configured windows and when quota is reached', () => {
  const outsideWindow = shouldAutoDispatchCheck(
    plan,
    [],
    new Date('2026-07-02T08:15:00.000Z'),
    'Europe/Paris',
    false,
  );
  assert.equal(outsideWindow.shouldDispatch, false);
  assert.equal(outsideWindow.reason, 'outside_window');

  const quotaReached = shouldAutoDispatchCheck(
    plan,
    [
      { requestedAt: '2026-07-02T05:35:00.000Z' },
      { requestedAt: '2026-07-02T10:05:00.000Z' },
      { requestedAt: '2026-07-02T15:20:00.000Z' },
    ],
    new Date('2026-07-02T06:15:00.000Z'),
    'Europe/Paris',
    false,
  );
  assert.equal(quotaReached.shouldDispatch, false);
  assert.equal(quotaReached.reason, 'quota_reached');
});
