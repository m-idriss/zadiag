import { expect, test } from 'vitest';
import { withPermanentMonitorAuth } from './permanent-auth-config.mjs';

test('adds private permanent credentials and the startup probe endpoint', () => {
  expect(withPermanentMonitorAuth('ZADIAG_MONITOR_ID=monitor-1\n', {
    email: 'monitor@example.invalid',
    password: 'private-password',
    probeUrl: 'https://example.invalid/probe',
  })).toBe([
    'ZADIAG_MONITOR_ID=monitor-1',
    'ZADIAG_MONITOR_AUTH_EMAIL=monitor@example.invalid',
    'ZADIAG_MONITOR_AUTH_PASSWORD=private-password',
    'ZADIAG_MONITOR_PROBE_URL=https://example.invalid/probe',
    '',
  ].join('\n'));
});

test('replaces permanent credentials without duplicating settings', () => {
  const updated = withPermanentMonitorAuth([
    'ZADIAG_MONITOR_AUTH_EMAIL=old@example.invalid',
    'ZADIAG_MONITOR_AUTH_PASSWORD=old-password',
    'ZADIAG_MONITOR_PROBE_URL=https://old.invalid/probe',
    '',
  ].join('\n'), {
    email: 'new@example.invalid',
    password: 'new-password',
    probeUrl: 'https://new.invalid/probe',
  });
  expect(updated.match(/ZADIAG_MONITOR_AUTH_EMAIL=/g)?.length).toBe(1);
  expect(updated).toMatch(/ZADIAG_MONITOR_AUTH_EMAIL=new@example\.invalid/);
});
