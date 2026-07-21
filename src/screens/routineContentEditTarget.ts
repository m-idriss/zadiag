export type RoutineContentEditTarget =
  | { kind: 'identity' }
  | { kind: 'description' }
  | { kind: 'proof' }
  | { kind: 'responsible' }
  | { kind: 'instructions' }
  | { kind: 'step'; stepId: string };
