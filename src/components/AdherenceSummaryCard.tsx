import { useMemo } from 'react';
import { adherenceSummary } from '../domain/adherence';
import type { VerificationEvent, VerificationStatus } from '../domain/models';
import type { MessageKey } from '../services/i18n';

export type SummaryRange = 'day' | 'week' | 'month' | 'quarter';

const ranges: Array<{
  id: SummaryRange;
  days: number;
  labelKey: MessageKey;
  titleKey: MessageKey;
}> = [
  { id: 'day', days: 1, labelKey: 'range1Day', titleKey: 'summary1Day' },
  { id: 'week', days: 7, labelKey: 'range1Week', titleKey: 'summary1Week' },
  { id: 'month', days: 30, labelKey: 'range1Month', titleKey: 'summary1Month' },
  { id: 'quarter', days: 90, labelKey: 'range3Months', titleKey: 'summary3Months' },
];

const eventTimestamp = (event: VerificationEvent) =>
  Date.parse(event.capturedAt ?? event.requestedAt);

const startOfToday = (now: number) => {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const ringSegments: Array<{ status: VerificationStatus; color: string }> = [
  { status: 'detected', color: 'var(--teal)' },
  { status: 'not_detected', color: '#f5b8af' },
  { status: 'uncertain', color: '#f5d7a8' },
  { status: 'missed', color: '#d7e0e4' },
  { status: 'expired', color: '#c9d3d8' },
];

const summaryRing = (statusCounts: Record<string, number>, total: number) => {
  if (!total) return '#e8efed 0deg 360deg';
  let cursor = 0;
  const segments = ringSegments.flatMap(({ status, color }) => {
    const count = statusCounts[status] ?? 0;
    if (!count) return [];
    const start = cursor;
    cursor += (count / total) * 360;
    return `${color} ${start}deg ${cursor}deg`;
  });
  return segments.length ? segments.join(', ') : '#e8efed 0deg 360deg';
};

export const filterEventsBySummaryRange = (events: VerificationEvent[], range: SummaryRange, now = Date.now()) => {
  const selectedRange = ranges.find((item) => item.id === range) ?? ranges[0];
  const cutoff = range === 'day'
    ? startOfToday(now)
    : now - selectedRange.days * 24 * 60 * 60 * 1000;
  return events.filter((event) => eventTimestamp(event) >= cutoff);
};

export function AdherenceSummaryCard({
  events,
  range,
  onRangeChange,
  t,
}: {
  events: VerificationEvent[];
  range: SummaryRange;
  onRangeChange: (range: SummaryRange) => void;
  t: (key: MessageKey) => string;
}) {
  const selectedRange = ranges.find((item) => item.id === range) ?? ranges[0];
  const summaryEvents = useMemo(() => filterEventsBySummaryRange(events, range), [events, range]);
  const summary = adherenceSummary(summaryEvents);
  const ring = summaryRing(summary.statusCounts, summary.completed);

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
            onClick={() => onRangeChange(item.id)}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>
    </section>
  );
}
