import type { MembershipPermission, MembershipPermissions, MembershipRole, ParticipantAccess, Role } from './models';

const permissionsForRole = (role: MembershipRole): MembershipPermissions => ({
  view: true,
  manageRoutines: role === 'owner' || role === 'caregiver',
  requestChecks: role !== 'viewer',
  submitChecks: role === 'owner' || role === 'participant',
  reviewProofs: role === 'owner' || role === 'caregiver',
  manageCaregivers: role === 'owner',
  manageParticipant: role === 'owner',
});

export const activeParticipantAccess = (
  access: ParticipantAccess[] | undefined,
  participantId: string,
) => access?.find((entry) => (
  entry.participant.id === participantId && entry.membership.status === 'active'
));

export const participantAccessCan = (
  access: ParticipantAccess | undefined,
  permission: MembershipPermission,
) => access?.membership.status === 'active'
  && (access.membership.permissions ?? permissionsForRole(access.membership.role))[permission];

export const participantRoleForAccess = (access: ParticipantAccess): Role => (
  access.membership.role === 'participant' || access.participant.selfManaged ? 'child' : 'parent'
);

export const preferredParticipantId = (
  access: ParticipantAccess[] | undefined,
  currentParticipantId?: string,
  rememberedParticipantId?: string,
) => {
  if (currentParticipantId && activeParticipantAccess(access, currentParticipantId)) return currentParticipantId;
  if (rememberedParticipantId && activeParticipantAccess(access, rememberedParticipantId)) return rememberedParticipantId;
  return access?.find((entry) => entry.membership.status === 'active')?.participant.id;
};
