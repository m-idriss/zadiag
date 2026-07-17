import { describe, expect, it } from 'vitest';
import { currentPilotParticipation, PILOT_CONSENT_VERSION, pilotParticipationRecord } from './pilotParticipation';

describe('pilot participation', () => {
  it('recognizes every explicit choice for the current consent version', () => {
    for (const status of ['accepted', 'declined', 'withdrawn'] as const) {
      expect(currentPilotParticipation(pilotParticipationRecord(status, 'parent'))?.status).toBe(status);
    }
  });

  it('requires a new choice when the consent text version changes', () => {
    expect(currentPilotParticipation({ ...pilotParticipationRecord('accepted', 'child'), version: 'previous' })).toBeUndefined();
    expect(PILOT_CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
