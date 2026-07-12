import { useEffect, useRef, useState } from 'react';
import { cameraOutline, chevronBackOutline, chevronForwardOutline, ellipsisHorizontal, peopleOutline, sendOutline, timeOutline } from 'ionicons/icons';
import { adherenceSummary, withResolvedEventStatuses } from '../domain/adherence';
import { presentRoutine } from '../domain/routinePresentation';
import type { AppState, RoutineAssignment, RoutineValidationMode, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from '../components/Icon';
import { StatusPill } from '../components/StatusPill';
import { dayPeriodLabelKey } from '../domain/taskTimeLabel';
import { RoutineEditScreen } from './RoutineEditScreen';
import { SvgIcon } from '../components/SvgIcon';
import { ActionButton } from '../components/ui';
import { languageTag } from '../services/locale';
import { useModalFocus } from '../hooks/useModalFocus';

type DetailTab = 'details' | 'tracking' | 'plan';
type DetailInitialTab = DetailTab | 'overview';

const detailTabStorageKey = (assignmentId: string) => `zadiag.routineDetail.${assignmentId}.tab`;

const isDetailTab = (value: unknown): value is DetailTab =>
  value === 'details' || value === 'tracking' || value === 'plan';

const readStoredDetailTab = (assignmentId: string) => {
  try {
    const stored = localStorage.getItem(detailTabStorageKey(assignmentId));
    return isDetailTab(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
};

const defaultDetailTab = (assignmentId: string, edit?: boolean, initialTab?: DetailInitialTab): DetailTab => {
  if (initialTab === 'plan') return 'plan';
  if (initialTab === 'overview') return 'details';
  const stored = readStoredDetailTab(assignmentId);
  if (stored && (stored !== 'plan' || edit)) return stored;
  return edit ? 'plan' : 'details';
};

const sameLocalDay = (value: string, day = new Date()) => {
  const date = new Date(value);
  return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();
};

const sameDate = (date: Date, day = new Date()) => date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();

const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`;

export const calendarDays = (events: VerificationEvent[], locale: string, referenceDate = new Date()) => {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
  const daysUntilSunday = (7 - end.getDay()) % 7;
  end.setDate(end.getDate() + daysUntilSunday);

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const days = [];

  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const day = new Date(date);
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEvents = events.filter((event) => sameLocalDay(event.requestedAt, day));
    const successful = dayEvents.filter((event) => event.status === 'detected').length;
    const attention = dayEvents.filter((event) => ['not_detected', 'uncertain'].includes(event.status)).length;
    const missed = dayEvents.filter((event) => ['missed', 'expired'].includes(event.status)).length;
    const total = successful + attention + missed;
    const status = missed > 0
      ? 'missed'
      : attention > 0
        ? 'attention'
        : successful > 0
          ? 'completed'
          : 'empty';
    days.push({
      key: day.toISOString(),
      weekday: day.getDay(),
      label: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(day),
      dayOfMonth: day.getDate(),
      dateLabel: dateFormatter.format(day),
      monthKey: monthKey(day),
      isToday: sameDate(day, referenceDate),
      isFuture: dayStart > today,
      successful,
      attention,
      missed,
      total,
      successfulShare: total > 0 ? Math.round((successful / total) * 100) : 0,
      attentionShare: total > 0 ? Math.round((attention / total) * 100) : 0,
      missedShare: total > 0 ? Math.round((missed / total) * 100) : 0,
      status,
      level: Math.min(4, successful),
    });
  }

  return days;
};

const capitalize = (value: string) => value.length > 0 ? `${value.charAt(0).toLocaleUpperCase()}${value.slice(1)}` : value;

const chunkWeeks = <T,>(days: T[]) => Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, (index + 1) * 7));

export const calendarMonthSections = (days: ReturnType<typeof calendarDays>, locale: string, referenceDate = new Date()) => {
  const monthFormatter = new Intl.DateTimeFormat(locale, { month: 'long' });
  return [-1, 0].map((offset) => {
    const month = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + offset, 1);
    const targetMonthKey = monthKey(month);
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const firstWeekOffset = (firstDay.getDay() + 6) % 7;
    const start = new Date(firstDay);
    start.setDate(start.getDate() - firstWeekOffset);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const lastWeekOffset = (7 - lastDay.getDay()) % 7;
    const end = new Date(lastDay);
    end.setDate(end.getDate() + lastWeekOffset);

    const sectionDays = days
      .filter((day) => {
        const date = new Date(day.key);
        return date >= start && date <= end;
      })
      .map((day) => ({ ...day, isOutsideMonth: day.monthKey !== targetMonthKey }));

    return {
      key: targetMonthKey,
      label: capitalize(monthFormatter.format(month)),
      weeks: chunkWeeks(sectionDays),
    };
  });
};

const streakFor = (events: VerificationEvent[]) => {
  let streak = 0;
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  while (events.some((event) => event.status === 'detected' && sameLocalDay(event.requestedAt, day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
};

const renderRoutineStepIcon = (icon: string) => {
  if (icon === '▣') return <SvgIcon icon={cameraOutline} />;
  if (icon === '➤') return <SvgIcon icon={sendOutline} />;
  return icon;
};

export function RoutineDetailScreen({ assignment, state, back, start, getProofImageUrl, t, edit, initialTab, onSaveMonitoringPlan, routinePlanBusy }: {
  assignment: RoutineAssignment;
  state: AppState;
  back: () => void;
  start?: () => void;
  getProofImageUrl?: (eventId: string) => Promise<string>;
  t: (key: MessageKey) => string;
  edit?: boolean;
  initialTab?: DetailInitialTab;
  onSaveMonitoringPlan?: (plan: RoutineAssignment['plan'], validationMode?: RoutineValidationMode) => Promise<void>;
  routinePlanBusy?: boolean;
}) {
  const [tab, setTab] = useState<DetailTab>(() => defaultDetailTab(assignment.id, edit, initialTab));
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [proofErrors, setProofErrors] = useState<Record<string, boolean>>({});
  const [enlargedProofUrl, setEnlargedProofUrl] = useState<string>();
  const [selectedHistoryEventId, setSelectedHistoryEventId] = useState<string>();
  const proofDialogRef = useModalFocus<HTMLDivElement>(Boolean(enlargedProofUrl), () => setEnlargedProofUrl(undefined));
  const historyDialogRef = useModalFocus<HTMLDivElement>(Boolean(selectedHistoryEventId), () => setSelectedHistoryEventId(undefined));
  const todayHeatmapRef = useRef<HTMLSpanElement | null>(null);
  const now = Date.now();
  const rawEvents = state.events.filter((event) => event.routineId === assignment.routineId);
  const events = withResolvedEventStatuses(rawEvents, now);
  const summary = adherenceSummary(events);
  const locale = languageTag(state.locale);
  const visual = presentRoutine(assignment.routine, state.locale);
  const next = rawEvents.find((event) => event.status === 'pending' && Date.parse(event.expiresAt) > now);
  const formatDateTime = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  const formatTime = (value: string) => new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(value));
  const days = calendarDays(events, locale);
  const monthSections = calendarMonthSections(days, locale);
  const currentStreak = streakFor(events);
  const selectedHistoryEvent = events.find((event) => event.id === selectedHistoryEventId);
  const tabs: DetailTab[] = edit ? ['plan', 'details', 'tracking'] : ['details', 'tracking'];
  const analysisSourceLabel = (source?: VerificationEvent['analysisSource']) => source ? t(source === 'ai' ? 'analysisSourceAi' : source === 'fallback' ? 'analysisSourceFallback' : 'analysisSourceSelf') : undefined;
  const reviewStatusLabel = (status?: VerificationEvent['reviewStatus']) => status ? t(status === 'approved' ? 'historyReviewApproved' : status === 'rejected' ? 'historyReviewRejected' : 'historyReviewPending') : undefined;
  const scoreLabel = (score?: number) => score === undefined ? undefined : `${Math.round(score * 100)}%`;

  useEffect(() => {
    if (!tabs.includes(tab)) {
      setTab(tabs[0]);
      return;
    }
    try {
      localStorage.setItem(detailTabStorageKey(assignment.id), tab);
    } catch {
      // Routine detail tab persistence is optional.
    }
  }, [assignment.id, tab, tabs]);

  useEffect(() => {
    if (tab !== 'tracking') return;
    todayHeatmapRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [tab]);

  useEffect(() => {
    if (tab !== 'tracking' || !getProofImageUrl) return;
    events.forEach((event) => {
      if (!event.proofImagePath || proofUrls[event.id] || proofErrors[event.id]) return;
      void getProofImageUrl(event.id)
        .then((url) => setProofUrls((current) => ({ ...current, [event.id]: url })))
        .catch((error) => {
          console.error(error);
          setProofErrors((current) => ({ ...current, [event.id]: true }));
        });
    });
  }, [events, getProofImageUrl, proofErrors, proofUrls, tab]);

  const historyRow = (event: VerificationEvent) => {
    const proofUrl = proofUrls[event.id];
    return (
    <article className="routine-history-row" key={event.id}>
      {proofUrl ? (
        <button type="button" className="submission-thumb submission-thumb-button" aria-label={t('responsibleReviewImageAlt')} onClick={() => setEnlargedProofUrl(proofUrl)}>
          <img src={proofUrl} alt={t('responsibleReviewImageAlt')} />
        </button>
      ) : (
        <span className={`submission-thumb ${event.proofImagePath ? 'submission-thumb-loading' : ''}`} aria-hidden="true"><AppIcon name={routineIconName(visual.icon)} /></span>
      )}
      <div><strong>{formatDateTime(event.requestedAt)}</strong><small>{event.reason ?? t('noAnalysisYet')}</small></div>
      <StatusPill status={event.status} t={t} />
      <button type="button" className="routine-history-open" aria-label={`${t('historyDetailTitle')} · ${formatDateTime(event.requestedAt)}`} onClick={() => setSelectedHistoryEventId(event.id)}><SvgIcon icon={chevronForwardOutline} /></button>
    </article>
    );
  };

  const detailsPanel = (
    <div className="routine-tab-panel">
      <section className="next-check-card"><div><small>{t('nextCheck')}</small><h2>{next ? t(dayPeriodLabelKey(next.expiresAt)) : t('noPendingTask')}</h2>{next && <p>{t('before')} {formatTime(next.expiresAt)}</p>}</div><span aria-hidden="true"><SvgIcon icon={timeOutline} /></span></section>
      <section className="routine-copy"><h2>{t('routineSummary')}</h2><p>{visual.description}</p></section>
      <section className="routine-meta-card">
        <div className="routine-plan-meta"><span aria-hidden="true"><SvgIcon icon={timeOutline} /></span><b>{t('monitoringPlan')}</b><p>{assignment.plan.checksPerDay} {t('checksDay')}</p>{edit && <button type="button" onClick={() => setTab('plan')} className="routine-edit-plan-button">{t('edit')}</button>}</div>
        <div><span aria-hidden="true"><SvgIcon icon={cameraOutline} /></span><b>{t('expectedProof')}</b><p>{visual.proofType}</p><i><SvgIcon icon={chevronForwardOutline} /></i></div>
        <div><span aria-hidden="true"><SvgIcon icon={peopleOutline} /></span><b>{t('responsible')}</b><p>{visual.responsibleName}</p><i><SvgIcon icon={chevronForwardOutline} /></i></div>
      </section>
      <section className="routine-copy"><h2>{t('instructions')}</h2><p>{visual.instructions}</p></section>
      <div className="routine-instruction-list">{visual.instructionSteps.map((step, index) => <article key={step.id}><b>{index + 1}</b><span aria-hidden="true">{renderRoutineStepIcon(step.icon)}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></article>)}</div>
      <aside className="routine-advice"><b>{t('advice')}</b><p>{t('routineAdvice')}</p></aside>
      {next && start && <ActionButton className="routine-proof-action" onClick={start}><SvgIcon icon={cameraOutline} />{t('sendProof')}</ActionButton>}
    </div>
  );

  const trackingPanel = (
    <div className="routine-tab-panel">
      <h2>{t('globalProgress')}</h2><section className="card progress-summary"><div className="progress-ring" style={{ '--progress': `${summary.rate * 360}deg` } as React.CSSProperties}><span>{Math.round(summary.rate * 100)}%</span></div><dl><div><dt>{t('checksSuccessful')}</dt><dd>{summary.successful}</dd></div><div><dt>{t('toReview')}</dt><dd>{summary.attention}</dd></div><div><dt>{t('missed')}</dt><dd>{events.filter((event) => ['missed', 'expired'].includes(event.status)).length}</dd></div></dl></section>
      <h2>{t('activityHeatmap')}</h2><div className="routine-heatmap" aria-label={t('activityHeatmap')}>
        <div className="routine-heatmap-body">
          <div className="routine-heatmap-weekdays" aria-hidden="true">{days.slice(0, 7).map((day) => <span key={day.weekday}>{day.label}</span>)}</div>
          <div className="routine-heatmap-months">
            {monthSections.map((month) => (
              <section className="routine-heatmap-month" key={month.key} aria-label={month.label}>
                <h3>{month.label}</h3>
                <div className="routine-heatmap-weeks">
                  {month.weeks.map((week, weekIndex) => (
                    <div className="routine-heatmap-week" key={week[0]?.key ?? weekIndex}>
                      {week.map((day) => (
                        <span
                          className={`routine-heatmap-day ${day.status} level-${day.level} ${day.total > 0 && !day.isFuture ? 'has-activity' : ''} ${day.isToday ? 'is-today' : ''} ${day.isFuture ? 'is-future' : ''} ${day.isOutsideMonth ? 'is-outside-month' : ''}`}
                          key={`${month.key}-${day.key}`}
                          ref={day.isToday && !day.isOutsideMonth ? todayHeatmapRef : undefined}
                          style={{
                            '--success-share': `${day.successfulShare}%`,
                            '--attention-end': `${day.successfulShare + day.attentionShare}%`,
                          } as React.CSSProperties}
                          title={day.isOutsideMonth ? undefined : `${day.dateLabel}: ${day.successful} ${t('successful')}, ${day.attention} ${t('toReview')}, ${day.missed} ${t('missed')}`}
                          aria-hidden={day.isOutsideMonth ? true : undefined}
                          aria-label={day.isOutsideMonth ? undefined : `${day.dateLabel}: ${day.successful} ${t('successful')}, ${day.attention} ${t('toReview')}, ${day.missed} ${t('missed')}`}
                        ><b>{day.isOutsideMonth ? '' : day.dayOfMonth}</b></span>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
      <div className="heatmap-legend" aria-hidden="true"><span><i className="success" />{t('successful')}</span><span><i className="attention" />{t('toReview')}</span><span><i className="missed" />{t('missed')}</span></div>
      <h2>{t('streaks')}</h2><div className="streak-grid"><div><small>{t('currentStreak')}</small><b>{currentStreak}</b><span>{t('days')}</span></div><div><small>{t('bestStreak')}</small><b>{Math.max(currentStreak, summary.successful)}</b><span>{t('days')}</span></div></div>
      <div className="tab-section-title"><h2>{t('recentHistory')}</h2><span>{events.length}</span></div><div className="routine-history-list">{events.map(historyRow)}{!events.length && <p className="empty-state">{t('noRoutineHistory')}</p>}</div>
    </div>
  );

  return (
    <div className="content-screen routine-detail-screen" style={visual.style}>
      <div className="routine-detail-topbar">
        <button type="button" className="detail-back" onClick={back} aria-label={t('backToRoutines')}><SvgIcon icon={chevronBackOutline} /></button>
        <header className="routine-detail-hero">
          <span className="routine-hero-icon" aria-hidden="true"><AppIcon name={routineIconName(visual.icon)} /></span>
          <div className="routine-detail-title">
            <h1>{visual.name}</h1>
            <p>{assignment.plan.checksPerDay} {t('checksDay')}</p>
          </div>
        </header>
        <button type="button" className="more-button" aria-label={t('moreOptions')}><SvgIcon icon={ellipsisHorizontal} /></button>
      </div>
      <nav className="routine-tabs" aria-label={t('routineSections')}>
        {tabs.map((item) => <button type="button" className={tab === item ? 'active' : ''} aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)} key={item}>{t(item === 'details' ? 'infoTab' : item === 'plan' ? 'monitoringPlan' : 'trackingTab')}</button>)}
      </nav>

      {tab === 'details' && detailsPanel}
      {tab === 'tracking' && trackingPanel}

      {selectedHistoryEvent ? (
        <div className="history-detail-backdrop" onClick={() => setSelectedHistoryEventId(undefined)}>
          <div ref={historyDialogRef} className={`history-detail-dialog${proofUrls[selectedHistoryEvent.id] ? '' : ' no-proof'}`} role="dialog" aria-modal="true" aria-labelledby="history-detail-title" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
            <header>
              <div className="history-detail-heading"><small>{t('historyDetailTitle')}</small><h2 id="history-detail-title">{formatDateTime(selectedHistoryEvent.requestedAt)}</h2><StatusPill status={selectedHistoryEvent.status} t={t} /></div>
              <button type="button" data-autofocus aria-label={t('close')} onClick={() => setSelectedHistoryEventId(undefined)}><AppIcon name="close" /></button>
            </header>
            {proofUrls[selectedHistoryEvent.id] ? (
              <div className="history-detail-proof">
                <img src={proofUrls[selectedHistoryEvent.id]} alt={t('responsibleReviewImageAlt')} />
              </div>
            ) : null}
            <dl>
              <div><dt>{t('historyRequestedAt')}</dt><dd>{formatDateTime(selectedHistoryEvent.requestedAt)}</dd></div>
              {selectedHistoryEvent.capturedAt ? <div><dt>{t('historyCapturedAt')}</dt><dd>{formatDateTime(selectedHistoryEvent.capturedAt)}</dd></div> : null}
              <div><dt>{t('historyExpiresAt')}</dt><dd>{formatDateTime(selectedHistoryEvent.expiresAt)}</dd></div>
              {analysisSourceLabel(selectedHistoryEvent.analysisSource) ? <div><dt>{t('analysisSource')}</dt><dd>{analysisSourceLabel(selectedHistoryEvent.analysisSource)}</dd></div> : null}
              {scoreLabel(selectedHistoryEvent.confidence) ? <div><dt>{t('analysisConfidence')}</dt><dd>{scoreLabel(selectedHistoryEvent.confidence)}</dd></div> : null}
              {scoreLabel(selectedHistoryEvent.imageQuality) ? <div><dt>{t('analysisQuality')}</dt><dd>{scoreLabel(selectedHistoryEvent.imageQuality)}</dd></div> : null}
              {selectedHistoryEvent.reason ? <div className="wide"><dt>{t('analysisReason')}</dt><dd>{selectedHistoryEvent.reason}</dd></div> : null}
              {reviewStatusLabel(selectedHistoryEvent.reviewStatus) ? <div><dt>{t('historyReviewDecision')}</dt><dd>{reviewStatusLabel(selectedHistoryEvent.reviewStatus)}</dd></div> : null}
              {selectedHistoryEvent.reviewedAt ? <div><dt>{t('historyReviewedAt')}</dt><dd>{formatDateTime(selectedHistoryEvent.reviewedAt)}</dd></div> : null}
              {selectedHistoryEvent.reviewReason ? <div className="wide"><dt>{t('historyReviewComment')}</dt><dd>{selectedHistoryEvent.reviewReason}</dd></div> : null}
            </dl>
          </div>
        </div>
      ) : null}

      {enlargedProofUrl ? (
        <div ref={proofDialogRef} className="proof-lightbox" role="dialog" aria-modal="true" aria-label={t('responsibleReviewImageAlt')} tabIndex={-1} onClick={() => setEnlargedProofUrl(undefined)}>
          <button type="button" className="proof-lightbox-close" data-autofocus aria-label={t('close')} onClick={() => setEnlargedProofUrl(undefined)}><AppIcon name="close" /></button>
          <img src={enlargedProofUrl} alt={t('responsibleReviewImageAlt')} onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}

      {tab === 'plan' && edit && onSaveMonitoringPlan && <div className="routine-tab-panel routine-plan-tab-panel">
        <RoutineEditScreen
          plan={assignment.plan}
          validationMode={assignment.validationMode ?? 'ai'}
          canEditValidationMode={assignment.createdBy === 'child'}
          routineId={assignment.routineId}
          onSave={onSaveMonitoringPlan}
          onCancel={() => setTab('details')}
          busy={Boolean(routinePlanBusy)}
          t={t}
          embedded
        />
      </div>}
    </div>
  );
}
