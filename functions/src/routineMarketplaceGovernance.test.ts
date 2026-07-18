import assert from 'node:assert/strict';
import test from 'node:test';
import { marketplaceEntryInstallable, marketplaceRole, moderateMarketplaceStatus } from './routineMarketplaceGovernance.js';

test('enforces marketplace roles and moderation transitions', () => {
  assert.equal(marketplaceRole({ routineMarketplaceRole: 'moderator' }), 'moderator');
  assert.equal(moderateMarketplaceStatus('pending', 'approve', 'moderator'), 'approved');
  assert.equal(moderateMarketplaceStatus('approved', 'suspend', 'moderator'), 'suspended');
  assert.equal(moderateMarketplaceStatus('suspended', 'restore', 'admin'), 'approved');
  assert.throws(() => moderateMarketplaceStatus('approved', 'approve', 'moderator'));
  assert.throws(() => moderateMarketplaceStatus('approved', 'revoke', 'moderator'));
  assert.equal(moderateMarketplaceStatus('approved', 'revoke', 'admin'), 'revoked');
});

test('blocks new installs after moderation without affecting snapshots', () => {
  assert.equal(marketplaceEntryInstallable({ visibility: 'listed', moderationStatus: 'approved' }), true);
  assert.equal(marketplaceEntryInstallable({ visibility: 'unlisted', moderationStatus: 'unlisted' }), true);
  assert.equal(marketplaceEntryInstallable({ visibility: 'listed', moderationStatus: 'suspended' }), false);
  assert.equal(marketplaceEntryInstallable({ visibility: 'listed', moderationStatus: 'approved', revokedAt: 'now' }), false);
});
