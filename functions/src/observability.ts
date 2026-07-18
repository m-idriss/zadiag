import * as logger from 'firebase-functions/logger';

export type OperationalAlertKind =
  | 'push_send_failed'
  | 'push_subscription_invalidated'
  | 'push_delivery_unconfirmed'
  | 'scheduler_dispatch_failed'
  | 'analysis_failed'
  | 'storage_cleanup_failed'
  | 'app_check_rejected'
  | 'operational_test';

type OperationalEventKind =
  | 'push_dispatch_summary'
  | 'scheduler_run_summary'
  | 'analysis_completed'
  | 'proof_image_fallback'
  | 'synthetic_push_receipt';

type AlertValue = string | number | boolean | null | undefined;

export const operationalAlertDefinitions = {
  push_send_failed: { severity: 'SEV-2', owner: 'pilot-operations', occurrences: 5, windowMinutes: 10, recoveryMinutes: 15, runbook: 'docs/pilot-support-incident-playbook.md#push-delivery' },
  push_subscription_invalidated: { severity: 'SEV-3', owner: 'pilot-operations', occurrences: 10, windowMinutes: 60, recoveryMinutes: 60, runbook: 'docs/pilot-support-incident-playbook.md#push-delivery' },
  push_delivery_unconfirmed: { severity: 'SEV-2', owner: 'pilot-operations', occurrences: 2, windowMinutes: 20, recoveryMinutes: 20, runbook: 'docs/pilot-support-incident-playbook.md#synthetic-monitor' },
  scheduler_dispatch_failed: { severity: 'SEV-2', owner: 'backend-operations', occurrences: 1, windowMinutes: 10, recoveryMinutes: 10, runbook: 'docs/pilot-support-incident-playbook.md#scheduled-jobs' },
  analysis_failed: { severity: 'SEV-2', owner: 'ai-reliability', occurrences: 3, windowMinutes: 15, recoveryMinutes: 15, runbook: 'docs/pilot-support-incident-playbook.md#analysis' },
  storage_cleanup_failed: { severity: 'SEV-2', owner: 'privacy-operations', occurrences: 1, windowMinutes: 30, recoveryMinutes: 30, runbook: 'docs/pilot-support-incident-playbook.md#proof-cleanup' },
  app_check_rejected: { severity: 'SEV-2', owner: 'security-operations', occurrences: 20, windowMinutes: 10, recoveryMinutes: 20, runbook: 'docs/pilot-support-incident-playbook.md#app-check' },
  operational_test: { severity: 'TEST', owner: 'pilot-operations', occurrences: 1, windowMinutes: 5, recoveryMinutes: 5, runbook: 'docs/pilot-support-incident-playbook.md#test-alert' },
} as const satisfies Record<OperationalAlertKind, { severity: string; owner: string; occurrences: number; windowMinutes: number; recoveryMinutes: number; runbook: string }>;

interface OperationalAlertInput {
  kind: OperationalAlertKind;
  familyId?: string;
  checkId?: string;
  routineId?: string;
  actorUid?: string;
  details?: Record<string, AlertValue>;
  error?: unknown;
}

interface OperationalEventInput {
  kind: OperationalEventKind;
  familyId?: string;
  checkId?: string;
  routineId?: string;
  actorUid?: string;
  details?: Record<string, AlertValue>;
  error?: unknown;
}

const errorMessage = (error: unknown) => {
  if (!error) return undefined;
  return String((error as { message?: unknown }).message ?? error).slice(0, 240);
};

export const operationalAlertPayload = (input: OperationalAlertInput) => {
  const definition = operationalAlertDefinitions[input.kind];
  const details = Object.fromEntries(
    Object.entries(input.details ?? {})
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value) || value === null),
  );
  return {
    alert: 'operational_alert',
    kind: input.kind,
    severity: definition.severity,
    owner: definition.owner,
    thresholdOccurrences: definition.occurrences,
    thresholdWindowMinutes: definition.windowMinutes,
    runbook: definition.runbook,
    dedupeKey: `operational:${input.kind}`,
    ...(input.familyId ? { familyId: input.familyId } : {}),
    ...(input.checkId ? { checkId: input.checkId } : {}),
    ...(input.routineId ? { routineId: input.routineId } : {}),
    ...(input.actorUid ? { actorUid: input.actorUid } : {}),
    ...(Object.keys(details).length ? { details } : {}),
    ...(errorMessage(input.error) ? { error: errorMessage(input.error) } : {}),
  };
};

export const operationalRecoveryPayload = (kind: OperationalAlertKind) => ({
  event: 'operational_recovery', kind, owner: operationalAlertDefinitions[kind].owner,
  dedupeKey: `operational:${kind}`, recoveryWindowMinutes: operationalAlertDefinitions[kind].recoveryMinutes,
});

export const reportOperationalRecovery = (kind: OperationalAlertKind) => logger.info('operational_recovery', operationalRecoveryPayload(kind));

export const reportOperationalAlert = (input: OperationalAlertInput) => {
  logger.error('operational_alert', operationalAlertPayload(input));
};

export const operationalEventPayload = (input: OperationalEventInput) => {
  const details = Object.fromEntries(
    Object.entries(input.details ?? {})
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value) || value === null),
  );
  return {
    event: 'operational_event',
    kind: input.kind,
    ...(input.familyId ? { familyId: input.familyId } : {}),
    ...(input.checkId ? { checkId: input.checkId } : {}),
    ...(input.routineId ? { routineId: input.routineId } : {}),
    ...(input.actorUid ? { actorUid: input.actorUid } : {}),
    ...(Object.keys(details).length ? { details } : {}),
    ...(errorMessage(input.error) ? { error: errorMessage(input.error) } : {}),
  };
};

export const reportOperationalEvent = (input: OperationalEventInput) => {
  logger.info('operational_event', operationalEventPayload(input));
};
