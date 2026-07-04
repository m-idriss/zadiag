import { describe, expect, it } from 'vitest';
import type { RoutineTemplate } from './models';
import {
  assignableRoutineTemplates,
  builtinRoutineTemplates,
  createRoutineTemplateSnapshot,
  marketplaceFromTemplates,
  routineTemplateById,
} from './routineMarketplace';

describe('routine marketplace', () => {
  it('exposes built-in routines as templates', () => {
    const marketplace = marketplaceFromTemplates();

    expect(marketplace.templates.length).toBeGreaterThan(0);
    expect(routineTemplateById(marketplace, 'orthodontic-elastics')?.visibility).toBe('builtin');
  });

  it('merges shared templates over built-ins by id', () => {
    const custom: RoutineTemplate = {
      id: builtinRoutineTemplates[0].id,
      visibility: 'public',
      routine: {
        ...builtinRoutineTemplates[0].routine,
        name: 'Shared override',
      },
    };

    const marketplace = marketplaceFromTemplates([custom]);

    expect(routineTemplateById(marketplace, custom.id)?.routine.name).toBe('Shared override');
  });

  it('filters templates by assigned routine ids', () => {
    const marketplace = marketplaceFromTemplates([
      {
        id: 'shared-bedtime',
        visibility: 'unlisted',
        shareCode: 'RT-BEDTIME',
        routine: {
          id: 'shared-bedtime',
          name: 'Bedtime',
          description: 'Night routine',
        },
      },
    ]);

    const assignable = assignableRoutineTemplates(marketplace, ['orthodontic-elastics']);

    expect(assignable.some((template) => template.routine.id === 'orthodontic-elastics')).toBe(false);
    expect(assignable.some((template) => template.routine.id === 'shared-bedtime')).toBe(true);
  });

  it('creates an assignment-safe routine snapshot', () => {
    const template: RoutineTemplate = {
      id: 'template-1',
      visibility: 'private',
      routine: { id: 'custom-routine', name: 'Custom', description: 'Custom routine' },
    };

    const snapshot = createRoutineTemplateSnapshot(template);
    template.routine.name = 'Changed later';

    expect(snapshot).toEqual({ id: 'custom-routine', name: 'Custom', description: 'Custom routine' });
  });
});
