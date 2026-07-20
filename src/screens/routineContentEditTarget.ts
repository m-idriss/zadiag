export type RoutineContentEditTarget =
  | { kind: 'identity' }
  | { kind: 'description' }
  | { kind: 'proof' }
  | { kind: 'responsible' }
  | { kind: 'instructions' }
  | { kind: 'step'; stepId: string };

export const routineContentEditTargetKey = (target?: RoutineContentEditTarget) =>
  target?.kind === 'step' ? `step-${target.stepId}` : target?.kind ?? 'general';
