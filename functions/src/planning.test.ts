import assert from 'node:assert/strict';
import test from 'node:test';
import { checkExpiresAt, monitoringPlanSchema, shouldAutoDispatchCheck } from './planning.js';

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
  assert.equal(monitoringPlanSchema.safeParse({ ...plan, expiryMinutes: 0 }).success, true);
  assert.equal(monitoringPlanSchema.safeParse({ ...plan, weekdays: [1, 1] }).success, false);
  assert.equal(monitoringPlanSchema.safeParse({
    ...plan,
    windows: [{ id: 'invalid', start: '20:00', end: '08:00' }],
  }).success, false);
});

test('uses the end of the active window when no response delay is configured', () => {
  const now = new Date('2026-07-02T06:45:00.000Z');
  const expiresAt = checkExpiresAt({ ...plan, expiryMinutes: 0 }, now);
  assert.equal(expiresAt.toISOString(), '2026-07-02T07:30:00.000Z');
});

test('caps fixed response delays at the active window end', () => {
  const now = new Date('2026-07-02T07:00:00.000Z');
  const expiresAt = checkExpiresAt({ ...plan, expiryMinutes: 60 }, now);
  assert.equal(expiresAt.toISOString(), '2026-07-02T07:30:00.000Z');
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

test('evaluates active checks and dispatch keys independently per routine', () => {
  const now = new Date('2026-07-02T06:45:00.000Z');
  const elasticsChecks = [{
    requestedAt: '2026-07-02T06:35:00.000Z',
    status: 'pending',
    dispatchKey: '2026-07-02_morning',
  }];
  const medicationChecks: Array<{ requestedAt?: string; status?: string; dispatchKey?: string }> = [];

  const elastics = shouldAutoDispatchCheck(plan, elasticsChecks, now, plan.timeZone, true);
  const medication = shouldAutoDispatchCheck(plan, medicationChecks, now, plan.timeZone, false);

  assert.equal(elastics.reason, 'active_check');
  assert.equal(medication.shouldDispatch, true);
  assert.equal(medication.dispatchKey, '2026-07-02_morning');

  const retriedMedication = shouldAutoDispatchCheck(plan, [{
    requestedAt: now.toISOString(),
    status: 'pending',
    dispatchKey: medication.dispatchKey,
  }], now, plan.timeZone, false);
  assert.equal(retriedMedication.reason, 'already_dispatched');
});

test('dispatches grouped schedules on their own weekdays', () => {
  const groupedPlan = {
    ...plan,
    checksPerDay: 2,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    windows: [
      { id: 'weekday_morning', start: '07:30', end: '09:30' },
      { id: 'weekend_late', start: '10:00', end: '12:00' },
    ],
    scheduleGroups: [
      {
        id: 'weekday',
        weekdays: [1, 2, 3, 4, 5],
        windows: [{ id: 'morning', start: '07:30', end: '09:30' }],
      },
      {
        id: 'weekend',
        weekdays: [6, 7],
        windows: [{ id: 'late', start: '10:00', end: '12:00' }],
      },
    ],
  };

  const weekday = shouldAutoDispatchCheck(groupedPlan, [], new Date('2026-07-03T06:45:00.000Z'), 'Europe/Paris', false);
  assert.equal(weekday.shouldDispatch, true);
  assert.equal(weekday.windowId, 'weekday_morning');

  const weekendMorning = shouldAutoDispatchCheck(groupedPlan, [], new Date('2026-07-04T06:45:00.000Z'), 'Europe/Paris', false);
  assert.equal(weekendMorning.reason, 'outside_window');

  const weekendLate = shouldAutoDispatchCheck(groupedPlan, [], new Date('2026-07-04T09:30:00.000Z'), 'Europe/Paris', false);
  assert.equal(weekendLate.shouldDispatch, true);
  assert.equal(weekendLate.windowId, 'weekend_late');
});
