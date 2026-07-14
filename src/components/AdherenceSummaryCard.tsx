import { useMemo } from 'react';
import { adherencePeriodReport, eventsInSummaryRange, isSummaryRange, type SummaryRange } from '../domain/reporting';
import type { Locale, RoutineAssignment, VerificationEvent, VerificationStatus } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { presentRoutine } from '../domain/routinePresentation';

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
  range,
  onRangeChange,
  t,
}: {
  events: VerificationEvent[];
  assignments: RoutineAssignment[];
  locale: Locale;
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
  const comparison = report.rateDelta === undefined
    ? t('summaryNoPreviousBaseline')
    : report.rateDelta === 0
      ? t('summaryComparedStable')
      : `${t(report.rateDelta > 0 ? 'summaryComparedUp' : 'summaryComparedDown')} ${Math.abs(Math.round(report.rateDelta * 100))} ${t('summaryPoints')}`;

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
          <small className="summary-comparison">{comparison}</small>
        </div>
      </div>
      {report.byRoutine.length ? (
        <details className="routine-reporting">
          <summary>{t('summaryByRoutine')}</summary>
          <div>
            {report.byRoutine.map((routine) => (
              <p key={routine.routineId}>
                <strong>{routineNames.get(routine.routineId) ?? t('routine')}</strong>
                <span>{routine.successful}/{routine.completed} · {Math.round(routine.rate * 100)}%</span>
              </p>
            ))}
          </div>
        </details>
      ) : null}
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
    </section>
  );
}
