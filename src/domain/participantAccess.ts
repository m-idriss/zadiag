import type { ParticipantAccess } from './models';

export const activeParticipantAccess = (
  access: ParticipantAccess[] | undefined,
  participantId: string,
) => access?.find((entry) => (
  entry.participant.id === participantId && entry.membership.status === 'active'
));

