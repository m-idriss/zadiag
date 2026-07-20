export const pushDeliveryGraceMs = 10 * 60 * 1000;

export const shouldMarkPushUnconfirmed = (input: {
  expectedAtMs?: number;
  receivedAtMs?: number;
  recoveryExpectedReceiptId?: string;
  expectedReceiptId?: string;
}, nowMs: number) => Boolean(
  input.expectedAtMs
  && input.expectedReceiptId
  && nowMs - input.expectedAtMs >= pushDeliveryGraceMs
  && (!input.receivedAtMs || input.receivedAtMs < input.expectedAtMs)
  && input.recoveryExpectedReceiptId !== input.expectedReceiptId,
);
