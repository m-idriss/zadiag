export type MarketplaceRole = 'moderator' | 'admin';
export type ModerationStatus = 'unlisted' | 'pending' | 'approved' | 'rejected' | 'suspended' | 'revoked';
export type ModerationAction = 'approve' | 'reject' | 'suspend' | 'restore' | 'revoke';

const transitions: Record<ModerationAction, readonly ModerationStatus[]> = {
  approve: ['pending'], reject: ['pending'], suspend: ['approved'], restore: ['suspended'], revoke: ['pending', 'approved', 'rejected', 'suspended', 'unlisted'],
};

export const marketplaceRole = (claims: Record<string, unknown> | undefined): MarketplaceRole | undefined => claims?.routineMarketplaceRole === 'admin' ? 'admin' : claims?.routineMarketplaceRole === 'moderator' ? 'moderator' : undefined;

export const moderateMarketplaceStatus = (current: ModerationStatus, action: ModerationAction, role: MarketplaceRole): ModerationStatus => {
  if (action === 'revoke' && role !== 'admin') throw new Error('admin_required');
  if (!transitions[action].includes(current)) throw new Error('invalid_moderation_transition');
  if (action === 'approve' || action === 'restore') return 'approved';
  if (action === 'reject') return 'rejected';
  if (action === 'suspend') return 'suspended';
  return 'revoked';
};

interface MarketplaceInstallableEntry {
  visibility?: unknown;
  moderationStatus?: unknown;
  revokedAt?: unknown;
  shareCodeHash?: unknown;
}

export const marketplaceEntryInstallable = (entry: MarketplaceInstallableEntry) => !entry.revokedAt && (
  entry.moderationStatus === 'unlisted' || (entry.visibility === 'listed' && entry.moderationStatus === 'approved') || entry.moderationStatus === undefined
);

export const marketplaceEntryAuthorizedForInstall = (
  entry: MarketplaceInstallableEntry,
  suppliedShareCodeHash?: string,
) => marketplaceEntryInstallable(entry) && (
  entry.visibility !== 'unlisted' && entry.moderationStatus !== 'unlisted'
    ? true
    : typeof entry.shareCodeHash === 'string' && entry.shareCodeHash === suppliedShareCodeHash
);
