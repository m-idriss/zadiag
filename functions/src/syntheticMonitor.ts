interface SyntheticPushRecoveryState {
  expectedAtMs?: number;
  receivedAtMs?: number;
  recoveryRequestedAtMs?: number;
}

export type SyntheticMonitorAttestation = {
  version: 1;
  kind: 'health' | 'connectivity' | 'site_availability';
  collectedAt: string;
  rows?: Array<{ label: string; status: 'ok' | 'warning' | 'failure' }>;
  target?: '3dime.com';
  httpStatus?: number;
  latencyMs?: number;
};

const healthyRows = (value: unknown, expectedLabels: string[]) => {
  if (!Array.isArray(value) || value.length !== expectedLabels.length) return false;
  if (value.some((row) => !row || typeof row !== 'object' || Array.isArray(row))) return false;
  const rows = value as Array<{ label?: unknown; status?: unknown }>;
  return new Set(rows.map((row) => row.label)).size === expectedLabels.length
    && rows.every((row) => expectedLabels.includes(String(row.label)) && row.status === 'ok');
};

const isRecent = (value: unknown, now: Date) => {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && Math.abs(now.getTime() - timestamp) <= 10 * 60_000;
};

export const syntheticMonitorAttestationResult = (
  value: unknown,
  context: { trustedMonitor: boolean; routineId: string; routineName?: string; now?: Date },
): 'detected' | 'not_detected' | undefined => {
  if (!context.trustedMonitor || !value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const attestation = value as Partial<SyntheticMonitorAttestation>;
  if (attestation.version !== 1 || !isRecent(attestation.collectedAt, context.now ?? new Date())) return undefined;
  const name = context.routineName ?? '';
  if (attestation.kind === 'health' && ['synthetic-monitor-health', 'nemu-health', 'raspberry-pi-health'].includes(context.routineId)) {
    return healthyRows(attestation.rows, ['Mémoire', 'Charge CPU', 'Disque', 'Température', 'Docker', 'Agent']) ? 'detected' : 'not_detected';
  }
  if (attestation.kind === 'connectivity' && /connect(?:ivité|ivity)?\s*(?:du )?(?:raspberry )?pi|raspberry pi connectivity/i.test(name)) {
    return healthyRows(attestation.rows, ['Interface', 'Passerelle', 'DNS', 'Zadiag HTTPS', 'Horloge NTP', 'Agent']) ? 'detected' : 'not_detected';
  }
  if (attestation.kind === 'site_availability' && attestation.target === '3dime.com' && /3dime/i.test(name)) {
    return Number.isInteger(attestation.httpStatus)
      && Number(attestation.httpStatus) >= 200
      && Number(attestation.httpStatus) < 400
      && Number.isFinite(attestation.latencyMs)
      && Number(attestation.latencyMs) < 2_000
      ? 'detected'
      : 'not_detected';
  }
  return undefined;
};

export const shouldRecoverSyntheticPush = (
  state: SyntheticPushRecoveryState,
  nowMs: number,
  graceMs = 60_000,
) => Boolean(
  state.expectedAtMs
  && nowMs - state.expectedAtMs >= graceMs
  && (!state.receivedAtMs || state.receivedAtMs < state.expectedAtMs)
  && (!state.recoveryRequestedAtMs || state.recoveryRequestedAtMs < state.expectedAtMs)
);
