import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregatePilotReport, pilotReportPeriod } from './pilotReport.js';

test('builds an identifier-free aggregate pilot funnel', () => {
  const events = ['one', 'two', 'three'].flatMap((actorUid) => [
    { action: 'app_ready', actorUid, participantId: `profile-${actorUid}`, metadata: { pilotConsentVersion: '2026-07-17' } },
    { action: 'request_check', actorUid, participantId: `profile-${actorUid}`, metadata: { pilotConsentVersion: '2026-07-17' } },
    { action: 'notification_opened', actorUid, participantId: `profile-${actorUid}`, metadata: { pilotConsentVersion: '2026-07-17' } },
    { action: 'check_opened', actorUid, participantId: `profile-${actorUid}`, metadata: { pilotConsentVersion: '2026-07-17' } },
    { action: 'submit_proof', actorUid, participantId: `profile-${actorUid}`, metadata: { pilotConsentVersion: '2026-07-17' } },
  ]);
  const report = aggregatePilotReport(events);
  assert.equal(report.status, 'ready');
  assert.equal(report.actors, 3);
  assert.equal(report.profiles, 3);
  assert.equal(report.rates.completion, 1);
  assert.doesNotMatch(JSON.stringify(report), /profile-one|\bone\b/);
});

test('suppresses small cohorts instead of returning identifiable cells', () => {
  assert.deepEqual(aggregatePilotReport([
    { action: 'app_ready', actorUid: 'one', familyId: 'family-one', metadata: { pilotConsentVersion: '2026-07-17' } },
    { action: 'app_ready', actorUid: 'two', familyId: 'family-two', metadata: { pilotConsentVersion: '2026-07-17' } },
  ]), { status: 'insufficient_data', minimumActors: 3 });
});

test('excludes events without active measurement consent', () => {
  assert.deepEqual(aggregatePilotReport([
    { action: 'app_ready', actorUid: 'one', metadata: { pilotConsentVersion: 'previous' } },
    { action: 'app_ready', actorUid: 'two' },
    { action: 'app_ready', actorUid: 'three', metadata: { pilotConsentVersion: '2026-07-17' } },
  ]), { status: 'insufficient_data', minimumActors: 3 });
});

test('limits reports to a valid completed 35-day period', () => {
  const now = new Date('2026-07-18T12:00:00.000Z');
  assert.deepEqual(pilotReportPeriod('2026-07-01T00:00:00.000Z', '2026-07-18T00:00:00.000Z', now), {
    start: new Date('2026-07-01T00:00:00.000Z'),
    end: new Date('2026-07-18T00:00:00.000Z'),
  });
  assert.throws(() => pilotReportPeriod('2026-06-01T00:00:00.000Z', '2026-07-18T00:00:00.000Z', now));
  assert.throws(() => pilotReportPeriod('2026-07-18T00:00:00.000Z', '2026-07-19T00:00:00.000Z', now));
});
