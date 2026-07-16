import { useMemo, useState } from 'react';
import { adherencePeriodReport, eventsInSummaryRange, isSummaryRange, type SummaryRange } from '../domain/reporting';
import type { Locale, RoutineAssignment, VerificationEvent, VerificationStatus } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { presentRoutine } from '../domain/routinePresentation';
import { languageTag } from '../services/locale';
import { AppIcon } from './Icon';
import { statusMessageKey } from './StatusPill';

export { isSummaryRange, type SummaryRange } from '../domain/reporting';

const ranges: Array<{
  id: SummaryRange;
  labelKey: MessageKey;
  titleKey: MessageKey;
}> = [
  { id: 'day', labelKey: 'range1Day', titleKey: 'summary1Day' },
  { id: 'twoDays', labelKey: 'range2Days', titleKey: 'summary2Days' },
  { id: 'week', labelKey: 'range1Week', titleKey: 'summary1Week' },
  { id: 'month', labelKey: 'range1Month', titleKey: 'summary1Month' },
  { id: 'quarter', labelKey: 'range3Months', titleKey: 'summary3Months' },
];

const ringSegments: Array<{ status: VerificationStatus; color: string }> = [
  { status: 'detected', color: 'var(--color-primary)' },
  { status: 'not_detected', color: 'var(--color-summary-not-detected)' },
  { status: 'uncertain', color: 'var(--color-summary-uncertain)' },
  { status: 'missed', color: 'var(--color-summary-missed)' },
  { status: 'expired', color: 'var(--color-summary-expired)' },
];

const summaryRing = (statusCounts: Record<string, number>, total: number) => {
  if (!total) return 'var(--color-summary-empty) 0deg 360deg';
  let cursor = 0;
  const segments = ringSegments.flatMap(({ status, color }) => {
    const count = statusCounts[status] ?? 0;
    if (!count) return [];
    const start = cursor;
    cursor += (count / total) * 360;
    return `${color} ${start}deg ${cursor}deg`;
  });
  return segments.length ? segments.join(', ') : 'var(--color-summary-empty) 0deg 360deg';
};

export const filterEventsBySummaryRange = (events: VerificationEvent[], range: SummaryRange, now = Date.now()) => {
  return eventsInSummaryRange(events, range, now);
};

export function AdherenceSummaryCard({
  events,
  assignments,
  locale,
  subjectName,
  range,
  onRangeChange,
  t,
}: {
  events: VerificationEvent[];
  assignments: RoutineAssignment[];
  locale: Locale;
  subjectName: string;
  range: SummaryRange;
  onRangeChange: (range: SummaryRange) => void;
  t: (key: MessageKey) => string;
}) {
  const selectedRange = ranges.find((item) => item.id === range) ?? ranges[0];
  const report = useMemo(() => adherencePeriodReport(events, range), [events, range]);
  const summary = report.current;
  const ring = summaryRing(summary.statusCounts, summary.completed);
  const routineNames = useMemo(() => new Map(assignments.map((assignment) => [
    assignment.routineId,
    presentRoutine(assignment.routine, locale).name,
  ])), [assignments, locale]);
  const dateTimeFormatter = useMemo(() => new Intl.DateTimeFormat(languageTag(locale), {
    dateStyle: 'short',
    timeStyle: 'short',
  }), [locale]);
  const completedEvents = useMemo(() => [...report.completedEvents].sort((a, b) => (
    Date.parse(b.capturedAt ?? b.requestedAt) - Date.parse(a.capturedAt ?? a.requestedAt)
  )), [report.completedEvents]);
  const comparison = report.rateDelta === undefined
    ? t('summaryNoPreviousBaseline')
    : report.rateDelta === 0
      ? t('summaryComparedStable')
      : `${t(report.rateDelta > 0 ? 'summaryComparedUp' : 'summaryComparedDown')} ${Math.abs(Math.round(report.rateDelta * 100))} ${t('summaryPoints')}`;
  const reportExportInput = {
    title: t('adherenceReport'),
    subject: `${t('reportParticipant')}: ${subjectName}`,
    period: `${t('reportPeriod')}: ${t(selectedRange.titleKey)}`,
    generatedOn: `${t('reportGeneratedOn')}: ${dateTimeFormatter.format(new Date())}`,
    summary: [
      { label: t('reportAdherenceRate'), value: `${Math.round(summary.rate * 100)}%` },
      { label: t('successful'), value: `${summary.successful}/${summary.completed}` },
      { label: t('reportEvolution'), value: comparison },
    ],
    routineHeading: t('summaryByRoutine'),
    routineColumns: [t('routine'), t('successful'), t('reportAdherenceRate')] as [string, string, string],
    routines: report.byRoutine.map((routine) => [
      routineNames.get(routine.routineId) ?? t('routine'),
      `${routine.successful}/${routine.completed}`,
      `${Math.round(routine.rate * 100)}%`,
    ] as [string, string, string]),
    historyHeading: t('reportCheckHistory'),
    historyColumns: [t('reportDate'), t('routine'), t('reportStatus')] as [string, string, string],
    history: completedEvents.map((event) => [
      dateTimeFormatter.format(new Date(event.capturedAt ?? event.requestedAt)),
      routineNames.get(event.routineId) ?? t('routine'),
      [
        t(statusMessageKey(event.status)),
        event.responsibleActions?.at(-1)
          ? `${event.responsibleActions.at(-1)?.actorName} · ${dateTimeFormatter.format(new Date(event.responsibleActions.at(-1)?.at ?? ''))}`
          : undefined,
      ].filter(Boolean).join(' — '),
    ] as [string, string, string]),
    privacyNote: t('reportPrivacyNote'),
  };
  const [reportDownloadState, setReportDownloadState] = useState<'idle' | 'pdf' | 'csv' | 'error'>('idle');
  const downloadReport = async (format: 'pdf' | 'csv') => {
    if (['pdf', 'csv'].includes(reportDownloadState) || !summary.completed) return;
    setReportDownloadState(format);
    try {
      const {
        adherenceReportFilename,
        deliverReportFile,
      } = await import('../services/reportExport');
      const blob = format === 'pdf'
        ? (await import('../services/reportPdf')).createAdherenceReportPdf(reportExportInput)
        : (await import('../services/reportCsv')).createAdherenceReportCsv({
          participant: subjectName,
          period: range,
          exportedAt: new Date().toISOString(),
          events: completedEvents.map((event) => ({
            eventId: event.id,
            sessionId: event.sessionId,
            routineId: event.routineId,
            routineName: routineNames.get(event.routineId) ?? t('routine'),
            requestedAt: event.requestedAt,
            expiresAt: event.expiresAt,
            capturedAt: event.capturedAt,
            status: event.status,
            analysisSource: event.analysisSource,
            automatedStatus: event.automatedStatus,
            confidence: event.confidence,
            imageQuality: event.imageQuality,
            reason: event.reason,
            reviewStatus: event.reviewStatus,
            reviewedAt: event.reviewedAt,
            reviewReason: event.reviewReason,
            responsibleActions: event.responsibleActions,
          })),
        });
      await deliverReportFile(blob, adherenceReportFilename(subjectName, format), reportExportInput.title);
      setReportDownloadState('idle');
    } catch (error) {
      console.error(error);
      setReportDownloadState('error');
    }
  };

  return (
    <section className="card summary-card adherence-summary-card">
      <div className="progress-ring" style={{ '--summary-ring': ring } as React.CSSProperties}>
        <span>{Math.round(summary.rate * 100)}%</span>
      </div>
      <div className="adherence-summary-content">
        <div className="adherence-summary-copy">
          <h2>{t(selectedRange.titleKey)}</h2>
          <p>{summary.successful} {t('clearChecks')} {summary.completed}</p>
          <strong>{t('progressEncouragement')}</strong>
        </div>
      </div>
      <div className="summary-range-toggle" role="group" aria-label={t('summaryRange')}>
        {ranges.map((item) => (
          <button
            type="button"
            key={item.id}
            className={range === item.id ? 'active' : ''}
            aria-pressed={range === item.id}
            onClick={() => onRangeChange(item.id)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>
      <details className="detailed-reporting">
        <summary>{t('summaryDetailedReport')}</summary>
        <div className="detailed-reporting-content">
          <small className="summary-comparison">{comparison}</small>
          {report.byRoutine.length ? (
            <section className="routine-reporting" aria-labelledby="routine-reporting-title">
              <strong id="routine-reporting-title">{t('summaryByRoutine')}</strong>
              <div>
                {report.byRoutine.map((routine) => (
                  <p key={routine.routineId}>
                    <strong>{routineNames.get(routine.routineId) ?? t('routine')}</strong>
                    <span>{routine.successful}/{routine.completed} · {Math.round(routine.rate * 100)}%</span>
                  </p>
                ))}
              </div>
            </section>
          ) : null}
          <div className="report-download-actions">
            <button
              type="button"
              className="action-button fill-outline report-print-action"
              disabled={!summary.completed || ['pdf', 'csv'].includes(reportDownloadState)}
              onClick={() => { void downloadReport('pdf'); }}
            >
              <AppIcon name="download" />
              {t(reportDownloadState === 'pdf' ? 'generatingReport' : 'downloadReport')}
            </button>
            <button
              type="button"
              className="action-button fill-outline report-print-action"
              disabled={!summary.completed || ['pdf', 'csv'].includes(reportDownloadState)}
              onClick={() => { void downloadReport('csv'); }}
            >
              <AppIcon name="download" />
              {t(reportDownloadState === 'csv' ? 'generatingCsvReport' : 'downloadCsvReport')}
            </button>
          </div>
          {!summary.completed ? <small className="report-unavailable-hint">{t('reportUnavailable')}</small> : null}
          {reportDownloadState === 'error' ? <small className="request-feedback error">{t('reportDownloadError')}</small> : null}
        </div>
      </details>
    </section>
  );
}
