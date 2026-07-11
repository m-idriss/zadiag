import type { ParticipantAccess } from './models';

export const activeParticipantAccess = (
  access: ParticipantAccess[] | undefined,
  participantId: string,
) => access?.find((entry) => (
  entry.participant.id === participantId && entry.membership.status === 'active'
));

export const preferredParticipantId = (
  access: ParticipantAccess[] | undefined,
  currentParticipantId?: string,
  rememberedParticipantId?: string,
) => {
  if (currentParticipantId && activeParticipantAccess(access, currentParticipantId)) return currentParticipantId;
  if (rememberedParticipantId && activeParticipantAccess(access, rememberedParticipantId)) return rememberedParticipantId;
  return access?.find((entry) => entry.membership.status === 'active')?.participant.id;
};
