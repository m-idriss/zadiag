import { describe, expect, it } from 'vitest';
import type { ParticipantAccess } from './models';
import { activeParticipantAccess } from './participantAccess';

const access: ParticipantAccess[] = [
  {
    participant: { id: 'alex', displayName: 'Alex' },
    membership: { role: 'owner', status: 'active' },
  },
  {
    participant: { id: 'sam', displayName: 'Sam' },
    membership: { role: 'caregiver', status: 'suspended' },
  },
];

describe('activeParticipantAccess', () => {
  it('selects an active participant from several relationships', () => {
    expect(activeParticipantAccess(access, 'alex')?.participant.displayName).toBe('Alex');
  });

  it('does not select suspended or unrelated relationships', () => {
    expect(activeParticipantAccess(access, 'sam')).toBeUndefined();
    expect(activeParticipantAccess(access, 'unrelated')).toBeUndefined();
  });
});

