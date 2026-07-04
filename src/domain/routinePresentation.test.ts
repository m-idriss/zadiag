import { describe, expect, it } from 'vitest';
import { presentRoutine } from './routinePresentation';

describe('routine presentation', () => {
  it('enriches legacy orthodontic routines without persisted presentation fields', () => {
    const visual = presentRoutine({
      id: 'orthodontic-elastics',
      name: 'Orthodontic Elastics',
      description: 'Legacy description',
    }, 'fr');

    expect(visual.name).toBe('Élastiques orthodontiques');
    expect(visual.icon).toBe('🦷');
    expect(visual.accent).toBe('#0d927d');
    expect(visual.instructionSteps).toHaveLength(3);
  });

  it('enriches persisted orthodontic routines even when their id changed', () => {
    const visual = presentRoutine({
      id: 'legacy-prod-id',
      name: 'Élastiques orthodontiques',
      description: '',
    }, 'fr');

    expect(visual.icon).toBe('🦷');
    expect(visual.accent).toBe('#0d927d');
  });

  it('sanitizes custom accent colors', () => {
    expect(presentRoutine({ id: 'custom', name: 'Custom', description: '', accentColor: 'url(evil)' }, 'en').accent).toBe('#0d927d');
  });
});
