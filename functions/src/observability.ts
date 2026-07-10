import * as logger from 'firebase-functions/logger';

export type OperationalAlertKind =
  | 'push_send_failed'
  | 'push_subscription_invalidated'
  | 'analysis_failed'
  | 'storage_cleanup_failed';

type AlertValue = string | number | boolean | null | undefined;

export interface OperationalAlertInput {
  kind: OperationalAlertKind;
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
  const details = Object.fromEntries(
    Object.entries(input.details ?? {})
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value) || value === null),
  );
  return {
    alert: 'operational_alert',
    kind: input.kind,
    ...(input.familyId ? { familyId: input.familyId } : {}),
    ...(input.checkId ? { checkId: input.checkId } : {}),
    ...(input.routineId ? { routineId: input.routineId } : {}),
    ...(input.actorUid ? { actorUid: input.actorUid } : {}),
    ...(Object.keys(details).length ? { details } : {}),
    ...(errorMessage(input.error) ? { error: errorMessage(input.error) } : {}),
  };
};

export const reportOperationalAlert = (input: OperationalAlertInput) => {
  logger.error('operational_alert', operationalAlertPayload(input));
};
