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

export const canLeaveMembership = (
  target: Partial<MembershipDocument> | undefined,
  activeOwnerCount: number,
) => target?.status === 'active' && !(target.role === 'owner' && activeOwnerCount <= 1);

export interface LegacyFamilyDocument {
  childName?: unknown;
  members?: Record<string, unknown>;
  createdAt?: unknown;
}

export interface LegacyRelationshipMigration {
  participantId: string;
  participant: {
    displayName: string;
    userId?: string;
    status: 'active';
    sourceFamilyId: string;
    relationshipModelVersion: 2;
    createdAt: string;
    updatedAt: string;
  };
  memberships: MembershipDocument[];
  participantRefs: Array<{
    uid: string;
    participantId: string;
    role: MembershipRole;
    status: 'active';
    updatedAt: string;
  }>;
}

export const migrateLegacyFamilyRelationships = (
  familyId: string,
  family: LegacyFamilyDocument,
  now: string,
): LegacyRelationshipMigration => {
  if (!familyId) throw new Error('invalid_family_id');
  const displayName = typeof family.childName === 'string' ? family.childName.trim() : '';
  if (!displayName) throw new Error('invalid_participant_name');
  const legacyMembers = Object.entries(family.members ?? {})
    .filter((entry): entry is [string, 'parent' | 'child'] => entry[1] === 'parent' || entry[1] === 'child')
    .sort(([left], [right]) => left.localeCompare(right));
  if (!legacyMembers.some(([, role]) => role === 'parent')) throw new Error('missing_owner');
  const participantUids = legacyMembers.filter(([, role]) => role === 'child').map(([uid]) => uid);
  const createdAt = typeof family.createdAt === 'string' && Number.isFinite(Date.parse(family.createdAt))
    ? family.createdAt
    : now;
  const memberships = legacyMembers.map(([uid, legacyRole]) => createMembership({
    uid,
    role: legacyRole === 'parent' ? 'owner' : 'participant',
    now: createdAt,
  }));
  return {
    participantId: familyId,
    participant: {
      displayName,
      ...(participantUids.length === 1 ? { userId: participantUids[0] } : {}),
      status: 'active',
      sourceFamilyId: familyId,
      relationshipModelVersion: 2,
      createdAt,
      updatedAt: now,
    },
    memberships,
    participantRefs: memberships.map(({ uid, role }) => ({
      uid,
      participantId: familyId,
      role,
      status: 'active',
      updatedAt: now,
    })),
  };
};

export const isCompatibleParticipantMigration = (
  existing: Record<string, unknown> | undefined,
  expected: LegacyRelationshipMigration['participant'],
) => !existing || (
  existing.sourceFamilyId === expected.sourceFamilyId
  && existing.displayName === expected.displayName
  && existing.relationshipModelVersion === 2
  && (!expected.userId || existing.userId === expected.userId)
);

export const isCompatibleMembershipMigration = (
  existing: Partial<MembershipDocument> | undefined,
  expected: MembershipDocument,
) => !existing || (
  existing.uid === expected.uid
  && existing.role === expected.role
  && existing.status === 'active'
);

export const isCompatibleParticipantRefMigration = (
  existing: Record<string, unknown> | undefined,
  expected: LegacyRelationshipMigration['participantRefs'][number],
) => !existing || (
  existing.participantId === expected.participantId
  && existing.role === expected.role
  && existing.status === 'active'
);

export const isCompatibleLegacyContentTarget = (
  existing: Record<string, unknown> | undefined,
  familyId: string,
  sourcePath: string,
) => !existing || (
  existing.relationshipSourceFamilyId === familyId
  && existing.relationshipSourcePath === sourcePath
);

export const scheduledAggregatePaths = (
  familyIds: string[],
  participants: Array<{ id: string; status?: unknown; sourceFamilyId?: unknown; contentMigrationVersion?: unknown }>,
) => {
  const activeParticipants = participants.filter((participant) => participant.status === 'active');
  const migratedFamilyIds = new Set(activeParticipants
    .filter((participant) => Number(participant.contentMigrationVersion ?? 0) >= 1)
    .map((participant) => String(participant.sourceFamilyId ?? ''))
    .filter(Boolean));
  return [
    ...familyIds.filter((familyId) => !migratedFamilyIds.has(familyId)).map((id) => `families/${id}`),
    ...activeParticipants.map(({ id }) => `participants/${id}`),
  ];
};
