import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldRecoverSyntheticPush, syntheticMonitorAttestationResult } from './syntheticMonitor.js';

test('requests recovery when an accepted synthetic push remains unconfirmed', () => {
  assert.equal(shouldRecoverSyntheticPush({ expectedAtMs: 1_000 }, 61_000), true);
});

test('accepts only fresh, healthy attestations for their explicitly bound monitor routines', () => {
  const now = new Date('2026-09-25T06:10:00.000Z');
  assert.equal(syntheticMonitorAttestationResult({
    version: 1, kind: 'health', collectedAt: now.toISOString(),
    rows: ['Mémoire', 'Charge CPU', 'Disque', 'Température', 'Docker', 'Agent'].map((label) => ({ label, status: 'ok' })),
  }, { trustedMonitor: true, routineId: 'synthetic-monitor-health', now }), 'detected');
  assert.equal(syntheticMonitorAttestationResult({
    version: 1, kind: 'connectivity', collectedAt: now.toISOString(),
    rows: ['Interface', 'Passerelle', 'DNS', 'Zadiag HTTPS', 'Horloge NTP', 'Agent'].map((label) => ({ label, status: 'ok' })),
  }, { trustedMonitor: true, routineId: 'private-connectivity', routineName: 'Connect Pi', now }), 'detected');
  assert.equal(syntheticMonitorAttestationResult({
    version: 1, kind: 'site_availability', collectedAt: now.toISOString(), target: '3dime.com', httpStatus: 200, latencyMs: 31,
  }, { trustedMonitor: true, routineId: 'private-3dime', routineName: '3dime.com', now }), 'detected');
  assert.equal(syntheticMonitorAttestationResult({
    version: 1, kind: 'health', collectedAt: now.toISOString(), rows: [{ label: 'Mémoire', status: 'ok' }],
  }, { trustedMonitor: true, routineId: 'synthetic-monitor-health', now }), 'not_detected');
  assert.equal(syntheticMonitorAttestationResult({
    version: 1, kind: 'health', collectedAt: now.toISOString(), rows: [null, null, null, null, null, null],
  }, { trustedMonitor: true, routineId: 'synthetic-monitor-health', now }), 'not_detected');
  assert.equal(syntheticMonitorAttestationResult({
    version: 1, kind: 'health', collectedAt: now.toISOString(), rows: [],
  }, { trustedMonitor: false, routineId: 'synthetic-monitor-health', now }), undefined);
});

test('waits for the delivery grace period', () => {
  assert.equal(shouldRecoverSyntheticPush({ expectedAtMs: 1_000 }, 60_999), false);
});

test('does not recover a received push or repeat recovery for the same dispatch', () => {
  assert.equal(shouldRecoverSyntheticPush({ expectedAtMs: 1_000, receivedAtMs: 1_001 }, 70_000), false);
  assert.equal(shouldRecoverSyntheticPush({ expectedAtMs: 1_000, recoveryRequestedAtMs: 1_001 }, 70_000), false);
});
