import type { Locale, Routine, RoutineTemplate } from './models';
import { availableRoutines } from './routineCatalog';
import { presentRoutine } from './routinePresentation';

interface RoutineMarketplace {
  templates: RoutineTemplate[];
}

export const builtinRoutineTemplates: RoutineTemplate[] = availableRoutines.map((routine) => ({
  id: routine.id,
  routine,
  visibility: 'builtin',
}));

export const createRoutineTemplateSnapshot = (template: RoutineTemplate): Routine => structuredClone({
  ...template.routine,
  id: template.routine.id || template.id,
});

export const marketplaceFromTemplates = (templates: RoutineTemplate[] = []): RoutineMarketplace => {
  const byId = new Map<string, RoutineTemplate>();
  [...builtinRoutineTemplates, ...templates].forEach((template) => {
    byId.set(template.id, template);
  });
  return { templates: [...byId.values()] };
};

export const routineTemplateById = (marketplace: RoutineMarketplace, templateId: string) =>
  marketplace.templates.find((template) => template.id === templateId);

export const assignableRoutineTemplates = (
  marketplace: RoutineMarketplace,
  assignedRoutineIds: string[],
) => {
  const assigned = new Set(assignedRoutineIds);
  return marketplace.templates.filter((template) => !assigned.has(template.routine.id));
};

export const presentRoutineTemplate = (template: RoutineTemplate, locale: Locale) =>
  presentRoutine(template.routine, locale);
