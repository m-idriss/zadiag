import { describe, expect, it } from 'vitest';
import { defaultPlan } from '../domain/models';
import { routineUpdatePayload } from './routineUpdate';

describe('routine update payload', () => {
  it('omits an unavailable validation mode instead of encoding it as null', () => {
    expect(routineUpdatePayload('participant-1', 'routine-1', defaultPlan)).toEqual({
      familyId: 'participant-1',
      routineId: 'routine-1',
      plan: defaultPlan,
    });
  });

  it('includes an explicitly selected validation mode', () => {
    expect(routineUpdatePayload('participant-1', 'routine-1', defaultPlan, 'ai')).toMatchObject({
      validationMode: 'ai',
    });
  });

  it('includes the active routine name, icon and color customization', () => {
    const appearance = { name: 'Routine du soir', icon: 'star', accentColor: '#7C3AED' };

    expect(routineUpdatePayload('family-1', 'routine-1', defaultPlan, undefined, appearance)).toEqual({
      familyId: 'family-1',
      routineId: 'routine-1',
      plan: defaultPlan,
      appearance,
    });
  });
});
