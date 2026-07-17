export interface AdherenceReportCsvInput {
  participant: string;
  period: string;
  exportedAt: string;
  events: Array<{
    eventId: string;
    sessionId: string;
    routineId: string;
    routineName: string;
    requestedAt: string;
    expiresAt: string;
    capturedAt?: string;
    status: string;
    analysisSource?: string;
    automatedStatus?: string;
    confidence?: number;
    imageQuality?: number;
    reason?: string;
    reviewStatus?: string;
    reviewedAt?: string;
    reviewReason?: string;
    responsibleActions?: Array<{ type: string; at: string; actorUid: string; actorName: string }>;
    anomaly?: string;
  }>;
}

const columns = [
  'participant',
  'period',
  'exported_at',
  'event_id',
  'session_id',
  'routine_id',
  'routine_name',
  'requested_at',
  'expires_at',
  'captured_at',
  'status',
  'analysis_source',
  'automated_status',
  'confidence',
  'image_quality',
  'reason',
  'review_status',
  'reviewed_at',
  'review_reason',
  'responsible_actions',
  'routine_anomaly',
] as const;

const csvCell = (value: string) => {
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  if (!/[,"\r\n]/.test(safeValue)) return safeValue;
  return `"${safeValue.replace(/"/g, '""')}"`;
};

export const createAdherenceReportCsv = (input: AdherenceReportCsvInput) => {
  const rows = input.events.map((event) => [
    input.participant,
    input.period,
    input.exportedAt,
    event.eventId,
    event.sessionId,
    event.routineId,
    event.routineName,
    event.requestedAt,
    event.expiresAt,
    event.capturedAt ?? '',
    event.status,
    event.analysisSource ?? '',
    event.automatedStatus ?? '',
    event.confidence?.toString() ?? '',
    event.imageQuality?.toString() ?? '',
    event.reason ?? '',
    event.reviewStatus ?? '',
    event.reviewedAt ?? '',
    event.reviewReason ?? '',
    event.responsibleActions ? JSON.stringify(event.responsibleActions) : '',
    event.anomaly ?? '',
  ]);
  const content = [columns, ...rows]
    .map((row) => row.map((cell) => csvCell(cell)).join(','))
    .join('\r\n');
  return new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
};
