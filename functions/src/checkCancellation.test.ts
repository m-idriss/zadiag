import assert from 'node:assert/strict';
import test from 'node:test';
import { cancelledCheckUpdate, CheckCancellationError } from './checkCancellation.js';

test('cancels a live pending check and retains bounded responsible activity', () => {
  const responsibleActions = Array.from({ length: 20 }, (_, index) => ({ type: 'reminded', at: String(index) }));
  const update = cancelledCheckUpdate({
    status: 'pending',
    expiresAt: '2026-08-03T12:30:00.000Z',
    responsibleActions,
  }, { uid: 'owner-1', name: 'Idriss' }, new Date('2026-08-03T12:00:00.000Z'));
  assert.equal(update.status, 'cancelled');
  assert.equal(update.cancelledBy, 'owner-1');
  assert.equal(update.responsibleActions.length, 20);
  assert.deepEqual(update.responsibleActions.at(-1), {
    type: 'cancelled', at: '2026-08-03T12:00:00.000Z', actorUid: 'owner-1', actorName: 'Idriss',
  });
});

test('rejects completed and expired checks', () => {
  const actor = { uid: 'owner-1', name: 'Idriss' };
  const now = new Date('2026-08-03T12:00:00.000Z');
  assert.throws(() => cancelledCheckUpdate({ status: 'detected', expiresAt: '2026-08-03T12:30:00.000Z' }, actor, now), CheckCancellationError);
  assert.throws(() => cancelledCheckUpdate({ status: 'pending', expiresAt: '2026-08-03T12:00:00.000Z' }, actor, now), CheckCancellationError);
});
