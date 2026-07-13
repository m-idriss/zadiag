export interface SyntheticPushRecoveryState {
  expectedAtMs?: number;
  receivedAtMs?: number;
  recoveryRequestedAtMs?: number;
}

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
