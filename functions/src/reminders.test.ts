import assert from 'node:assert/strict';
import test from 'node:test';
import { isCheckRequestRateLimited, normalizeReminderRepeatMinutes, shouldSendCheckReminder } from './reminders.js';

test('normalizes reminder repeat preferences', () => {
  assert.equal(normalizeReminderRepeatMinutes(0), 0);
  assert.equal(normalizeReminderRepeatMinutes(20), 20);
  assert.equal(normalizeReminderRepeatMinutes(30), 30);
  assert.equal(normalizeReminderRepeatMinutes(15), 20);
  assert.equal(normalizeReminderRepeatMinutes('bad'), 20);
});

test('rate limits duplicate manual check requests inside the cooldown', () => {
  const now = Date.parse('2026-07-11T10:00:10.000Z');
  assert.equal(isCheckRequestRateLimited('2026-07-11T10:00:00.001Z', now), true);
  assert.equal(isCheckRequestRateLimited('2026-07-11T10:00:00.000Z', now), false);
  assert.equal(isCheckRequestRateLimited('invalid', now), false);
  assert.equal(isCheckRequestRateLimited('2026-07-11T10:00:11.000Z', now), false);
});

test('does not send automatic reminders when repeat is disabled', () => {
  assert.equal(shouldSendCheckReminder({
    requestedAt: '2026-07-07T10:00:00.000Z',
    expiresAt: '2026-07-07T11:00:00.000Z',
    repeatMinutes: 0,
    now: new Date('2026-07-07T10:30:00.000Z'),
  }), false);
});

test('sends the first reminder after the configured interval', () => {
  const input = {
    requestedAt: '2026-07-07T10:00:00.000Z',
    expiresAt: '2026-07-07T11:00:00.000Z',
    repeatMinutes: 20,
  };

  assert.equal(shouldSendCheckReminder({
    ...input,
    now: new Date('2026-07-07T10:19:59.000Z'),
  }), false);
  assert.equal(shouldSendCheckReminder({
    ...input,
    now: new Date('2026-07-07T10:20:00.000Z'),
  }), true);
});

test('uses the last reminder time for repeated reminders', () => {
  const input = {
    requestedAt: '2026-07-07T10:00:00.000Z',
    expiresAt: '2026-07-07T11:00:00.000Z',
    lastReminderAt: '2026-07-07T10:20:00.000Z',
    repeatMinutes: 20,
  };

  assert.equal(shouldSendCheckReminder({
    ...input,
    now: new Date('2026-07-07T10:39:59.000Z'),
  }), false);
  assert.equal(shouldSendCheckReminder({
    ...input,
    now: new Date('2026-07-07T10:40:00.000Z'),
  }), true);
});

test('does not send reminders for expired checks', () => {
  assert.equal(shouldSendCheckReminder({
    requestedAt: '2026-07-07T10:00:00.000Z',
    expiresAt: '2026-07-07T10:20:00.000Z',
    repeatMinutes: 20,
    now: new Date('2026-07-07T10:20:00.000Z'),
  }), false);
});
