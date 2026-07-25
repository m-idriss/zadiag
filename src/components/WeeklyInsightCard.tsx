import { useMemo, useState } from 'react';
import type { Locale, RoutineAssignment, VerificationEvent } from '../domain/models';
import { weeklyInsight } from '../domain/reporting';
import { presentRoutine } from '../domain/routinePresentation';
import type { MessageKey } from '../services/i18n';
import { DisclosureToggle } from './DisclosureToggle';
import { AppIcon } from './Icon';

export function WeeklyInsightCard({
  assignments,
  events,
  locale,
  now,
  onOpenReport,
  t,
}: {
  assignments: RoutineAssignment[];
  events: VerificationEvent[];
  locale: Locale;
  now: number;
  onOpenReport: () => void;
  t: (key: MessageKey) => string;
}) {
  const [open, setOpen] = useState(false);
  const insight = useMemo(() => weeklyInsight(assignments, events, now), [assignments, events, now]);
  const routineNames = useMemo(() => new Map(assignments.map((assignment) => [
    assignment.routineId,
    presentRoutine(assignment.routine, locale).name,
  ])), [assignments, locale]);
  const priorityKey: MessageKey | undefined = insight ? {
    adjust_schedule: 'weeklyPriorityAdjustSchedule',
    review_proofs: 'weeklyPriorityReviewProofs',
    support_consistency: 'weeklyPrioritySupportConsistency',
    keep_course: 'weeklyPriorityKeepCourse',
  }[insight.priority] as MessageKey : undefined;

  return (
    <section className="card weekly-insight-card" aria-labelledby="weekly-insight-title">
      <div className="weekly-insight-heading">
        <div><span className="eyebrow">{t('weeklyInsightEyebrow')}</span><h2 id="weekly-insight-title">{t('weeklyInsightTitle')}</h2></div>
        <span className="weekly-insight-rate"><strong>{insight ? `${Math.round(insight.rate * 100)}%` : '—'}</strong></span>
        <DisclosureToggle
          expanded={open}
          showLabel={t('weeklyInsightShow')}
          hideLabel={t('weeklyInsightHide')}
          onToggle={() => setOpen((current) => !current)}
        />
      </div>
      {open ? <div className="weekly-insight-content">
        {insight && priorityKey ? (
          <>
            <p className="weekly-insight-evolution">{insight.rateDelta === undefined
              ? t('summaryNoPreviousBaseline')
              : insight.rateDelta === 0
                ? t('summaryComparedStable')
                : `${t(insight.rateDelta > 0 ? 'weeklyInsightUp' : 'weeklyInsightDown')} ${Math.abs(Math.round(insight.rateDelta * 100))} ${t('summaryPoints')}`}</p>
            <div className="weekly-insight-metrics">
              {insight.strongestRoutineId && insight.strongestRoutineId !== insight.watchRoutineId ? <span><small>{t('weeklyInsightStrongest')}</small><strong>{routineNames.get(insight.strongestRoutineId) ?? t('routine')}</strong></span> : null}
              {insight.watchRoutineId ? <span><small>{t('weeklyInsightWatch')}</small><strong>{routineNames.get(insight.watchRoutineId) ?? t('routine')}</strong></span> : null}
              {insight.bestWindow ? <span><small>{t('weeklyInsightBestWindow')}</small><strong>{insight.bestWindow.start}–{insight.bestWindow.end}</strong></span> : null}
              <span><small>{t('weeklyInsightResponsibleActions')}</small><strong>{insight.responsibleActions.length ? insight.responsibleActions.map((actor) => `${actor.actorName} · ${actor.count}`).join(', ') : insight.responsibleActionCount}</strong></span>
            </div>
            <div className="weekly-insight-priority"><AppIcon name="sparkles" /><p><small>{t('weeklyInsightPriority')}</small><strong>{t(priorityKey)}</strong></p></div>
            <button type="button" onClick={onOpenReport}>{t('weeklyInsightOpenReport')}</button>
          </>
        ) : <p className="weekly-insight-empty">{t('weeklyInsightEmpty')}</p>}
      </div> : null}
    </section>
  );
}
