export class CheckCancellationError extends Error {}

export const cancelledCheckUpdate = (
  check: Record<string, unknown>,
  actor: { uid: string; name: string },
  now: Date,
) => {
  if (check.status !== 'pending' || Date.parse(String(check.expiresAt)) <= now.getTime()) {
    throw new CheckCancellationError('check_not_cancellable');
  }
  const cancelledAt = now.toISOString();
  return {
    status: 'cancelled' as const,
    cancelledAt,
    cancelledBy: actor.uid,
    responsibleActions: [
      ...(Array.isArray(check.responsibleActions) ? check.responsibleActions : []),
      { type: 'cancelled' as const, at: cancelledAt, actorUid: actor.uid, actorName: actor.name },
    ].slice(-20),
  };
};
