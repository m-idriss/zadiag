import { describe, expect, it } from 'vitest';
import { migratedIdentityDocuments, replaceMonitorIdInEnvironment } from './identity-migration.mjs';

const input = {
  oldMonitorId: 'old-monitor',
  newMonitorId: 'new-monitor',
  participantId: 'participant-1',
  participant: { userId: 'old-monitor', syntheticMonitorUid: 'old-monitor', status: 'active' },
  membership: { uid: 'old-monitor', role: 'participant', status: 'active', permissions: { view: true } },
  participantRef: { participantId: 'participant-1', role: 'participant', status: 'active' },
  monitor: { participantId: 'participant-1', enabled: true, receiptToken: 'secret' },
  now: '2026-08-07T10:00:00.000Z',
};

describe('synthetic monitor identity migration', () => {
  it('moves only the synthetic identity while preserving participant state and monitor credentials', () => {
    const migrated = migratedIdentityDocuments(input);
    expect(migrated.participant.userId).toBe('new-monitor');
    expect(migrated.participant.status).toBe('active');
    expect(migrated.membership.uid).toBe('new-monitor');
    expect(migrated.membership.permissions).toEqual({ view: true });
    expect(migrated.monitor.receiptToken).toBe('secret');
    expect(migrated.monitor.migratedFrom).toBe('old-monitor');
  });

  it('rejects conflicting targets and replaces exactly one private environment entry', () => {
    expect(() => migratedIdentityDocuments({ ...input, newMonitorId: 'old-monitor' })).toThrow(/invalid_monitor_identity/);
    expect(() => migratedIdentityDocuments({ ...input, participant: { userId: 'other' } })).toThrow(/participant_monitor_mismatch/);
    expect(
      replaceMonitorIdInEnvironment('A=1\nZADIAG_MONITOR_ID=old-monitor\nB=2\n', 'old-monitor', 'new-monitor'),
    ).toBe('A=1\nZADIAG_MONITOR_ID=new-monitor\nB=2\n');
    expect(() => replaceMonitorIdInEnvironment('A=1\n', 'old-monitor', 'new-monitor')).toThrow(/monitor_environment_mismatch/);
  });
});
