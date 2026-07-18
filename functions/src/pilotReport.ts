const reportActions = [
  'app_ready',
  'accept_relationship_invitation',
  'notifications_enabled',
  'notification_opened',
  'check_opened',
  'request_check',
  'submit_proof',
  'review_proof',
  'accept_pilot_participation',
] as const;

type ReportAction = typeof reportActions[number];

export interface PilotReportEvent {
  action?: unknown;
  actorUid?: unknown;
  familyId?: unknown;
  participantId?: unknown;
  metadata?: unknown;
}

const ratio = (numerator: number, denominator: number) => denominator
  ? Math.round((numerator / denominator) * 1000) / 1000
  : null;

export const pilotReportPeriod = (from: unknown, to: unknown, now = new Date()) => {
  if (typeof from !== 'string' || typeof to !== 'string') throw new Error('invalid_period');
  const start = new Date(from);
  const end = new Date(to);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) throw new Error('invalid_period');
  if (end > now || end.getTime() - start.getTime() > 35 * 86_400_000) throw new Error('invalid_period');
  return { start, end };
};

export const aggregatePilotReport = (events: PilotReportEvent[], minimumActors = 3) => {
  const actors = new Set<string>();
  const aggregates = new Set<string>();
  const stages = Object.fromEntries(reportActions.map((action) => [action, 0])) as Record<ReportAction, number>;

  events.forEach((event) => {
    const metadata = event.metadata && typeof event.metadata === 'object'
      ? event.metadata as Record<string, unknown>
      : undefined;
    if (metadata?.pilotConsentVersion !== '2026-07-17') return;
    const action = typeof event.action === 'string' && reportActions.includes(event.action as ReportAction)
      ? event.action as ReportAction
      : undefined;
    if (!action || typeof event.actorUid !== 'string' || !event.actorUid) return;
    actors.add(event.actorUid);
    const aggregateId = typeof event.participantId === 'string' && event.participantId
      ? `participant:${event.participantId}`
      : typeof event.familyId === 'string' && event.familyId
        ? `family:${event.familyId}`
        : undefined;
    if (aggregateId) aggregates.add(aggregateId);
    stages[action] += 1;
  });

  if (actors.size < minimumActors) return { status: 'insufficient_data' as const, minimumActors };
  return {
    status: 'ready' as const,
    actors: actors.size,
    profiles: aggregates.size,
    stages,
    rates: {
      notificationEngagement: ratio(stages.notification_opened, stages.request_check),
      checkStart: ratio(stages.check_opened, stages.request_check),
      completion: ratio(stages.submit_proof, stages.check_opened),
      responsibleReview: ratio(stages.review_proof, stages.submit_proof),
    },
  };
};
