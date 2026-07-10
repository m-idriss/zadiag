export const membershipRoles = ['owner', 'caregiver', 'participant', 'viewer'] as const;
export type MembershipRole = typeof membershipRoles[number];

export const membershipPermissions = [
  'view',
  'manageRoutines',
  'requestChecks',
  'submitChecks',
  'reviewProofs',
  'manageCaregivers',
  'manageParticipant',
] as const;
export type MembershipPermission = typeof membershipPermissions[number];
export type PermissionSet = Record<MembershipPermission, boolean>;

export type MembershipStatus = 'active' | 'suspended';
export type MembershipLabel = 'parent' | 'partner' | 'relative' | 'professional' | 'self' | 'other';

export interface MembershipDocument {
  uid: string;
  role: MembershipRole;
  label?: MembershipLabel;
  permissions: PermissionSet;
  status: MembershipStatus;
  invitedBy?: string;
  createdAt: string;
  updatedAt: string;
}

const noPermissions = (): PermissionSet => ({
  view: false,
  manageRoutines: false,
  requestChecks: false,
  submitChecks: false,
  reviewProofs: false,
  manageCaregivers: false,
  manageParticipant: false,
});

export const defaultPermissionsForRole = (role: MembershipRole): PermissionSet => {
  const permissions = noPermissions();
  permissions.view = true;
  if (role === 'viewer') return permissions;
  permissions.requestChecks = true;
  if (role === 'participant') {
    permissions.submitChecks = true;
    return permissions;
  }
  permissions.manageRoutines = true;
  permissions.reviewProofs = true;
  if (role === 'owner') {
    permissions.submitChecks = true;
    permissions.manageCaregivers = true;
    permissions.manageParticipant = true;
  }
  return permissions;
};

export const createMembership = ({
  uid,
  role,
  label,
  invitedBy,
  now = new Date().toISOString(),
}: {
  uid: string;
  role: MembershipRole;
  label?: MembershipLabel;
  invitedBy?: string;
  now?: string;
}): MembershipDocument => ({
  uid,
  role,
  ...(label ? { label } : {}),
  permissions: defaultPermissionsForRole(role),
  status: 'active',
  ...(invitedBy ? { invitedBy } : {}),
  createdAt: now,
  updatedAt: now,
});

export const hasParticipantPermission = (
  membership: Partial<MembershipDocument> | undefined,
  permission: MembershipPermission,
) => membership?.status === 'active' && membership.permissions?.[permission] === true;

export const canGrantPermissions = (
  actor: Partial<MembershipDocument> | undefined,
  requested: PermissionSet,
) => hasParticipantPermission(actor, 'manageCaregivers')
  && membershipPermissions.every((permission) => !requested[permission] || actor?.permissions?.[permission] === true);

export const canRemoveMembership = ({
  actor,
  target,
  activeOwnerCount,
}: {
  actor: Partial<MembershipDocument> | undefined;
  target: Partial<MembershipDocument> | undefined;
  activeOwnerCount: number;
}) => hasParticipantPermission(actor, 'manageCaregivers')
  && target?.status === 'active'
  && !(target.role === 'owner' && activeOwnerCount <= 1);

