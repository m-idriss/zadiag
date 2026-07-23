import { useEffect, useRef, useState } from 'react';
import { cameraOutline, chevronBackOutline, chevronForwardOutline, ellipsisHorizontal, peopleOutline } from 'ionicons/icons';
import { adherenceSummary, isSuccessfulVerification, withResolvedEventStatuses } from '../domain/adherence';
import { presentRoutine } from '../domain/routinePresentation';
import type { AppState, RoutineAppearance, RoutineAssignment, RoutineValidationMode, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from '../components/Icon';
import { RoutineIconPicker } from '../components/RoutineIconPicker';
import { StatusPill } from '../components/StatusPill';
import { RoutineEditScreen } from './RoutineEditScreen';
import { SvgIcon } from '../components/SvgIcon';
import { ActionButton } from '../components/ui';
import { languageTag } from '../services/locale';
import { ProofLightbox } from '../components/ProofLightbox';
import { VerificationEventDetailDialog } from '../components/VerificationEventDetailDialog';
import type { RoutineContentEditTarget } from './routineContentEditTarget';
import { DEFAULT_PRIVATE_ROUTINE_ACCENT } from '../domain/routineDraft';

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
  if (initialTab === 'tracking') return 'tracking';
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
    const successful = dayEvents.filter(isSuccessfulVerification).length;
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
  while (events.some((event) => isSuccessfulVerification(event) && sameLocalDay(event.requestedAt, day))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
};

function RoutineContentEditButton({ label, target, busy, onEdit }: {
  label: string;
  target: RoutineContentEditTarget;
  busy: boolean;
  onEdit: (target: RoutineContentEditTarget) => void;
}) {
  return <button type="button" className="routine-content-edit-overlay" aria-label={label} aria-busy={busy} disabled={busy} onClick={() => onEdit(target)}><SvgIcon icon={chevronForwardOutline} /></button>;
}

export function RoutineDetailScreen({ assignment, state, back, start, getProofImageUrl, reviewCheck, requestCheck, t, edit, initialTab, initialEventId, onInitialEventConsumed, onSaveMonitoringPlan, onSaveAppearance, onForkContent, forkingContent, routinePlanBusy }: {
  assignment: RoutineAssignment;
  state: AppState;
  back: () => void;
  start?: () => void;
  getProofImageUrl?: (eventId: string) => Promise<string>;
  reviewCheck?: (eventId: string, decision: 'detected' | 'not_detected') => Promise<void>;
  requestCheck?: (routineId: string) => Promise<void>;
  t: (key: MessageKey) => string;
  edit?: boolean;
  initialTab?: DetailInitialTab;
  initialEventId?: string;
  onInitialEventConsumed?: () => void;
  onSaveMonitoringPlan?: (plan: RoutineAssignment['plan'], validationMode?: RoutineValidationMode) => Promise<void>;
  onSaveAppearance?: (appearance: RoutineAppearance) => Promise<void>;
  onForkContent?: (target: RoutineContentEditTarget) => void;
  forkingContent?: boolean;
  routinePlanBusy?: boolean;
}) {
  const [tab, setTab] = useState<DetailTab>(() => defaultDetailTab(assignment.id, edit, initialTab));
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [proofErrors, setProofErrors] = useState<Record<string, boolean>>({});
  const [enlargedProofUrl, setEnlargedProofUrl] = useState<string>();
  const [selectedHistoryEventId, setSelectedHistoryEventId] = useState<string | undefined>(initialEventId);
  const [appearance, setAppearance] = useState<RoutineAppearance>(() => ({
    name: presentRoutine(assignment.routine, state.locale).name,
    icon: routineIconName(assignment.routine.icon),
    accentColor: /^#[0-9a-f]{6}$/i.test(assignment.routine.accentColor ?? '') ? assignment.routine.accentColor! : DEFAULT_PRIVATE_ROUTINE_ACCENT,
  }));
  const [appearanceStatus, setAppearanceStatus] = useState<'saving' | 'saved' | 'error'>();
  const [appearanceEditing, setAppearanceEditing] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const todayHeatmapRef = useRef<HTMLSpanElement | null>(null);
  const now = Date.now();
  const rawEvents = state.events.filter((event) => event.routineId === assignment.routineId);
  const events = withResolvedEventStatuses(rawEvents, now);
  const summary = adherenceSummary(events);
  const locale = languageTag(state.locale);
  const visual = presentRoutine(assignment.routine, state.locale);
  const next = rawEvents.find((event) => event.status === 'pending' && Date.parse(event.expiresAt) > now);
  const formatDateTime = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  const days = calendarDays(events, locale);
  const monthSections = calendarMonthSections(days, locale);
  const currentStreak = streakFor(events);
  const selectedHistoryEvent = events.find((event) => event.id === selectedHistoryEventId);
  const tabs: DetailTab[] = edit ? ['plan', 'details', 'tracking'] : ['details', 'tracking'];
  const canEditContent = Boolean(edit && onForkContent);
  const editLabel = (label: string) => `${t('edit')} · ${label}`;
  const saveAppearance = async () => {
    if (!onSaveAppearance || !appearance.name.trim()) return;
    setAppearanceStatus('saving');
    try {
      await onSaveAppearance({ ...appearance, name: appearance.name.trim(), accentColor: appearance.accentColor.toUpperCase() });
      setAppearanceStatus('saved');
      setAppearanceEditing(false);
    } catch {
      setAppearanceStatus('error');
    }
  };

  useEffect(() => {
    if (initialEventId) onInitialEventConsumed?.();
  }, [initialEventId, onInitialEventConsumed]);

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
      <section className={`routine-copy${canEditContent ? ' routine-content-editable' : ''}`}><h2>{t('routineSummary')}</h2><p>{visual.description}</p>{canEditContent ? <RoutineContentEditButton label={editLabel(t('routineSummary'))} target={{ kind: 'description' }} busy={Boolean(forkingContent)} onEdit={onForkContent!} /> : null}</section>
      <section className="routine-meta-card">
        <div className={canEditContent ? 'routine-content-editable' : undefined}><span aria-hidden="true"><SvgIcon icon={cameraOutline} /></span><b>{t('expectedProof')}</b><p>{visual.proofType}</p>{canEditContent ? <RoutineContentEditButton label={editLabel(t('expectedProof'))} target={{ kind: 'proof' }} busy={Boolean(forkingContent)} onEdit={onForkContent!} /> : null}</div>
        <div className={canEditContent ? 'routine-content-editable' : undefined}><span aria-hidden="true"><SvgIcon icon={peopleOutline} /></span><b>{t('responsible')}</b><p>{visual.responsibleName}</p>{canEditContent ? <RoutineContentEditButton label={editLabel(t('responsible'))} target={{ kind: 'responsible' }} busy={Boolean(forkingContent)} onEdit={onForkContent!} /> : null}</div>
      </section>
      <section className={`routine-copy${canEditContent ? ' routine-content-editable' : ''}`}><h2>{t('instructions')}</h2><p>{visual.instructions}</p>{canEditContent ? <RoutineContentEditButton label={editLabel(t('instructions'))} target={{ kind: 'instructions' }} busy={Boolean(forkingContent)} onEdit={onForkContent!} /> : null}</section>
      <div className="routine-instruction-list">{visual.instructionSteps.map((step, index) => <article className={canEditContent ? 'routine-content-editable' : undefined} key={step.id}><b>{index + 1}</b><span aria-hidden="true"><AppIcon name={routineIconName(step.icon)} /></span><div><h3>{step.title}</h3><p>{step.description}</p></div>{canEditContent ? <RoutineContentEditButton label={editLabel(step.title)} target={{ kind: 'step', stepId: step.id }} busy={Boolean(forkingContent)} onEdit={onForkContent!} /> : null}</article>)}</div>
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
    <div className="content-screen routine-detail-screen" style={visual.style} aria-busy={forkingContent || undefined}>
      <div className="routine-detail-topbar">
        <button type="button" className="detail-back" onClick={back} aria-label={t('backToRoutines')}><SvgIcon icon={chevronBackOutline} /></button>
        {edit && onSaveAppearance ? <button type="button" className="routine-detail-hero routine-appearance-trigger" aria-expanded={appearanceEditing} aria-label={t('routineAppearanceEdit')} onClick={() => setAppearanceEditing((editing) => !editing)}>
          <span className="routine-hero-icon" aria-hidden="true"><AppIcon name={routineIconName(visual.icon)} /></span>
          <div className="routine-detail-title">
            <h1>{visual.name}</h1>
            <p>{assignment.plan.checksPerDay} {t('checksDay')}</p>
          </div>
        </button> : <header className="routine-detail-hero">
          <span className="routine-hero-icon" aria-hidden="true"><AppIcon name={routineIconName(visual.icon)} /></span>
          <div className="routine-detail-title"><h1>{visual.name}</h1><p>{assignment.plan.checksPerDay} {t('checksDay')}</p></div>
        </header>}
        <button type="button" className="more-button" aria-label={t('moreOptions')}><SvgIcon icon={ellipsisHorizontal} /></button>
      </div>
      {appearanceEditing && edit && onSaveAppearance ? <section className="card routine-appearance-editor routine-appearance-top-editor">
        <label className="native-input-field"><span>{t('routineDraftName')}</span><input value={appearance.name} maxLength={120} onChange={(event) => { setAppearance((current) => ({ ...current, name: event.target.value })); setAppearanceStatus(undefined); }} /></label>
        <fieldset><legend>{t('routineIcon')}</legend><button type="button" className="routine-icon-picker-trigger" onClick={() => setIconPickerOpen(true)}><AppIcon name={routineIconName(appearance.icon)} /><span>{t('routineIconChoose')}</span><AppIcon name="chevron-forward" /></button></fieldset>
        <label className="routine-appearance-color"><span>{t('routineDraftAccentColor')}</span><input type="color" value={appearance.accentColor} onChange={(event) => { setAppearance((current) => ({ ...current, accentColor: event.target.value.toUpperCase() })); setAppearanceStatus(undefined); }} /></label>
        <div className="routine-appearance-actions"><button type="button" onClick={() => setAppearanceEditing(false)}>{t('cancel')}</button><button type="button" className="primary-action-button" disabled={!appearance.name.trim() || appearanceStatus === 'saving'} onClick={() => { void saveAppearance(); }}>{t(appearanceStatus === 'saving' ? 'saving' : 'save')}</button></div>
        {appearanceStatus === 'saved' ? <p role="status">{t('routineAppearanceSaved')}</p> : appearanceStatus === 'error' ? <p role="alert" className="form-error">{t('routineAppearanceError')}</p> : null}
      </section> : null}
      {iconPickerOpen ? <RoutineIconPicker selected={routineIconName(appearance.icon)} locale={state.locale} close={() => setIconPickerOpen(false)} select={(icon) => { setAppearance((current) => ({ ...current, icon })); setAppearanceStatus(undefined); }} t={t} /> : null}
      <nav className="routine-tabs" aria-label={t('routineSections')}>
        {tabs.map((item) => <button type="button" className={tab === item ? 'active' : ''} aria-current={tab === item ? 'page' : undefined} onClick={() => setTab(item)} key={item}>{t(item === 'details' ? 'infoTab' : item === 'plan' ? 'monitoringPlan' : 'trackingTab')}</button>)}
      </nav>

      {forkingContent ? <div className="routine-content-loading-overlay" role="status" aria-live="polite"><div className="routine-content-loading-card"><span className="button-spinner" aria-hidden="true" /><strong>{t('routineDraftPreparing')}</strong></div></div> : null}

      {tab === 'details' && detailsPanel}
      {tab === 'tracking' && trackingPanel}

      {selectedHistoryEvent ? (
        <VerificationEventDetailDialog event={selectedHistoryEvent} locale={state.locale} proofUrl={proofUrls[selectedHistoryEvent.id]} getProofImageUrl={getProofImageUrl} reviewCheck={reviewCheck} requestCheck={requestCheck} onClose={() => setSelectedHistoryEventId(undefined)} t={t} />
      ) : null}

      {enlargedProofUrl ? (
        <ProofLightbox src={enlargedProofUrl} alt={t('responsibleReviewImageAlt')} closeLabel={t('close')} onClose={() => setEnlargedProofUrl(undefined)} />
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
