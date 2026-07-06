import { useEffect, useRef, useState } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { cameraOutline, chevronBackOutline, chevronForwardOutline, ellipsisHorizontal, peopleOutline, sendOutline, timeOutline } from 'ionicons/icons';
import { adherenceSummary } from '../domain/adherence';
import { presentRoutine } from '../domain/routinePresentation';
import type { AppState, RoutineAssignment, RoutineValidationMode, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from '../components/Icon';
import { StatusPill } from '../components/StatusPill';
import { dayPeriodLabelKey } from '../domain/taskTimeLabel';
import { RoutineEditScreen } from './RoutineEditScreen';

type DetailTab = 'overview' | 'instructions' | 'history' | 'progress' | 'plan';

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
  if (icon === '▣') return <IonIcon icon={cameraOutline} />;
  if (icon === '➤') return <IonIcon icon={sendOutline} />;
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
  initialTab?: DetailTab;
  onSaveMonitoringPlan?: (plan: RoutineAssignment['plan'], validationMode?: RoutineValidationMode) => Promise<void>;
  routinePlanBusy?: boolean;
}) {
  const [tab, setTab] = useState<DetailTab>(initialTab ?? (edit ? 'plan' : 'overview'));
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [proofErrors, setProofErrors] = useState<Record<string, boolean>>({});
  const [enlargedProofUrl, setEnlargedProofUrl] = useState<string>();
  const todayHeatmapRef = useRef<HTMLSpanElement | null>(null);
  const events = state.events.filter((event) => event.routineId === assignment.routineId);
  const summary = adherenceSummary(events);
  const locale = state.locale === 'fr' ? 'fr-FR' : 'en-US';
  const visual = presentRoutine(assignment.routine, state.locale);
  const next = events.find((event) => event.status === 'pending' && Date.parse(event.expiresAt) > Date.now());
  const formatDateTime = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  const formatTime = (value: string) => new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(value));
  const days = calendarDays(events, locale);
  const monthSections = calendarMonthSections(days, locale);
  const currentStreak = streakFor(events);
  const tabs: DetailTab[] = edit ? ['plan', 'overview', 'instructions', 'history', 'progress'] : ['overview', 'instructions', 'history', 'progress'];

  useEffect(() => {
    if (tab !== 'progress') return;
    todayHeatmapRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [tab]);

  useEffect(() => {
    if (tab !== 'history' || !getProofImageUrl) return;
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
      <StatusPill status={event.status} t={t} /><span aria-hidden="true"><IonIcon icon={chevronForwardOutline} /></span>
    </article>
    );
  };

  return (
    <div className="content-screen routine-detail-screen" style={visual.style}>
      <div className="routine-detail-topbar">
        <button type="button" className="detail-back" onClick={back} aria-label={t('backToRoutines')}><IonIcon icon={chevronBackOutline} /></button>
        <button type="button" className="more-button" aria-label={t('moreOptions')}><IonIcon icon={ellipsisHorizontal} /></button>
      </div>
      <header className="routine-detail-hero">
        <span className="routine-hero-icon" aria-hidden="true"><AppIcon name={routineIconName(visual.icon)} /></span>
        <div className="routine-detail-title">
          <h1>{visual.name}</h1>
          <p>{assignment.plan.checksPerDay} {t('checksDay')}</p>
        </div>
      </header>
      <nav className="routine-tabs" aria-label={t('routineSections')}>
        {tabs.map((item) => <button type="button" className={tab === item ? 'active' : ''} aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)} key={item}>{t(item === 'overview' ? 'overviewTab' : item === 'instructions' ? 'instructions' : item === 'history' ? 'history' : item === 'plan' ? 'monitoringPlan' : 'routineProgress')}</button>)}
      </nav>

      {tab === 'overview' && <div className="routine-tab-panel">
        <section className="next-check-card"><div><small>{t('nextCheck')}</small><h2>{next ? t(dayPeriodLabelKey(next.expiresAt)) : t('noPendingTask')}</h2>{next && <p>{t('before')} {formatTime(next.expiresAt)}</p>}</div><span aria-hidden="true"><IonIcon icon={timeOutline} /></span></section>
        <section className="routine-copy"><h2>{t('overviewTab')}</h2><p>{visual.description}</p></section>
        <section className="routine-meta-card">
          <div className="routine-plan-meta"><span aria-hidden="true"><IonIcon icon={timeOutline} /></span><b>{t('monitoringPlan')}</b><p>{assignment.plan.checksPerDay} {t('timesPerDay')}</p>{edit && <button type="button" onClick={() => setTab('plan')} className="routine-edit-plan-button">{t('edit')}</button>}</div>
          <div><span aria-hidden="true"><IonIcon icon={cameraOutline} /></span><b>{t('expectedProof')}</b><p>{visual.proofType}</p><i><IonIcon icon={chevronForwardOutline} /></i></div>
          <div><span aria-hidden="true"><IonIcon icon={peopleOutline} /></span><b>{t('responsible')}</b><p>{visual.responsibleName}</p><i><IonIcon icon={chevronForwardOutline} /></i></div>
        </section>
        {next && start && <IonButton className="routine-proof-action" expand="block" onClick={start}><IonIcon icon={cameraOutline} slot="start" />{t('sendProof')}</IonButton>}
      </div>}

      {tab === 'instructions' && <div className="routine-tab-panel"><section className="routine-copy"><h2>{t('instructions')}</h2><p>{visual.instructions}</p></section><div className="routine-instruction-list">{visual.instructionSteps.map((step, index) => <article key={step.id}><b>{index + 1}</b><span aria-hidden="true">{renderRoutineStepIcon(step.icon)}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></article>)}</div><aside className="routine-advice"><b>{t('advice')}</b><p>{t('routineAdvice')}</p></aside></div>}

      {tab === 'history' && <div className="routine-tab-panel"><div className="tab-section-title"><h2>{t('recentHistory')}</h2><span>{events.length}</span></div><div className="routine-history-list">{events.map(historyRow)}{!events.length && <p className="empty-state">{t('noRoutineHistory')}</p>}</div></div>}

      {tab === 'progress' && <div className="routine-tab-panel">
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
      </div>}

      {enlargedProofUrl ? (
        <div className="proof-lightbox" role="dialog" aria-modal="true" aria-label={t('responsibleReviewImageAlt')} onClick={() => setEnlargedProofUrl(undefined)}>
          <button type="button" className="proof-lightbox-close" aria-label={t('close')} onClick={() => setEnlargedProofUrl(undefined)}>×</button>
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
          onCancel={() => setTab('overview')}
          busy={Boolean(routinePlanBusy)}
          t={t}
          embedded
        />
      </div>}
    </div>
  );
}
