import { useState } from 'react';
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

export const calendarDays = (events: VerificationEvent[], locale: string, referenceDate = new Date()) => {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday - 21);

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return Array.from({ length: 28 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dayEvents = events.filter((event) => sameLocalDay(event.requestedAt, date));
    const successful = dayEvents.filter((event) => event.status === 'detected').length;
    const attention = dayEvents.filter((event) => ['not_detected', 'uncertain'].includes(event.status)).length;
    const missed = dayEvents.filter((event) => ['missed', 'expired'].includes(event.status)).length;
    const status = missed > 0
      ? 'missed'
      : attention > 0
        ? 'attention'
        : successful > 0
          ? 'completed'
          : 'empty';
    return {
      key: date.toISOString(),
      weekday: date.getDay(),
      label: new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(date),
      dateLabel: dateFormatter.format(date),
      successful,
      attention,
      missed,
      status,
      level: Math.min(4, successful),
    };
  });
};

const chunkWeeks = <T,>(days: T[]) => Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => days.slice(index * 7, (index + 1) * 7));

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

export function RoutineDetailScreen({ assignment, state, back, start, t, edit, initialTab, onSaveMonitoringPlan, routinePlanBusy }: {
  assignment: RoutineAssignment;
  state: AppState;
  back: () => void;
  start?: () => void;
  t: (key: MessageKey) => string;
  edit?: boolean;
  initialTab?: DetailTab;
  onSaveMonitoringPlan?: (plan: RoutineAssignment['plan'], validationMode?: RoutineValidationMode) => Promise<void>;
  routinePlanBusy?: boolean;
}) {
  const [tab, setTab] = useState<DetailTab>(initialTab ?? (edit ? 'plan' : 'overview'));
  const events = state.events.filter((event) => event.routineId === assignment.routineId);
  const summary = adherenceSummary(events);
  const locale = state.locale === 'fr' ? 'fr-FR' : 'en-US';
  const visual = presentRoutine(assignment.routine, state.locale);
  const next = events.find((event) => event.status === 'pending' && Date.parse(event.expiresAt) > Date.now());
  const formatDateTime = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  const formatTime = (value: string) => new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(value));
  const days = calendarDays(events, locale);
  const weeks = chunkWeeks(days);
  const currentStreak = streakFor(events);
  const tabs: DetailTab[] = edit ? ['plan', 'overview', 'instructions', 'history', 'progress'] : ['overview', 'instructions', 'history', 'progress'];

  const historyRow = (event: VerificationEvent) => (
    <article className="routine-history-row" key={event.id}>
      <span className="submission-thumb" aria-hidden="true"><AppIcon name={routineIconName(visual.icon)} /></span>
      <div><strong>{formatDateTime(event.requestedAt)}</strong><small>{event.reason ?? t('noAnalysisYet')}</small></div>
      <StatusPill status={event.status} t={t} /><span aria-hidden="true"><IonIcon icon={chevronForwardOutline} /></span>
    </article>
  );

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
        <h2>{t('activityHeatmap')}</h2><div className="routine-heatmap" aria-label={t('lastFourWeeks')}>
          <div className="routine-heatmap-weekdays" aria-hidden="true">{days.slice(0, 7).map((day) => <span key={day.weekday}>{day.label}</span>)}</div>
          <div className="routine-heatmap-weeks">
            {weeks.map((week, weekIndex) => (
              <div className="routine-heatmap-week" key={week[0]?.key ?? weekIndex}>
                {week.map((day) => (
                  <span
                    className={`routine-heatmap-day ${day.status} level-${day.level}`}
                    key={day.key}
                    title={`${day.dateLabel}: ${day.successful} ${t('successful')}, ${day.attention} ${t('toReview')}, ${day.missed} ${t('missed')}`}
                    aria-label={`${day.dateLabel}: ${day.successful} ${t('successful')}, ${day.attention} ${t('toReview')}, ${day.missed} ${t('missed')}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="heatmap-legend" aria-hidden="true"><span>{t('less')}</span><i className="level-0" /><i className="level-1" /><i className="level-2" /><i className="level-3" /><i className="level-4" /><span>{t('more')}</span><span className="attention">{t('toReview')}</span><span className="missed">{t('missed')}</span></div>
        <h2>{t('streaks')}</h2><div className="streak-grid"><div><small>{t('currentStreak')}</small><b>{currentStreak}</b><span>{t('days')}</span></div><div><small>{t('bestStreak')}</small><b>{Math.max(currentStreak, summary.successful)}</b><span>{t('days')}</span></div></div>
      </div>}

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
