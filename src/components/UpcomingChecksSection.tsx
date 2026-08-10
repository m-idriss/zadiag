import type { presentedUpcomingRoutineChecks } from '../domain/dashboardChecks';
import { plannedWindowLabel } from '../domain/taskTimeLabel';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from './Icon';
import { UpcomingCheckActionMenu } from './UpcomingCheckActionMenu';

type PresentedUpcomingCheck = ReturnType<typeof presentedUpcomingRoutineChecks>[number];

export function UpcomingChecksSection({
  checks,
  now,
  locale,
  titleId,
  onRequest,
  onSkip,
  onEditPlan,
  t,
}: {
  checks: PresentedUpcomingCheck[];
  now: Date;
  locale: string;
  titleId: string;
  onRequest?: (routineId: string) => Promise<void>;
  onSkip?: (routineId: string, plannedStart: Date, plannedEnd: Date) => Promise<void>;
  onEditPlan?: (routineId: string) => void;
  t: (key: MessageKey) => string;
}) {
  if (!checks.length) return null;
  return (
    <section className="today-section upcoming-checks-section" aria-labelledby={titleId}>
      <div className="section-heading upcoming-checks-heading">
        <h2 id={titleId}>{t('upcomingChecks')}</h2>
      </div>
      <div className="upcoming-checks-list">
        {checks.map((item) => {
          const actionId = `${item.routineId}:${item.planned.start.toISOString()}`;
          return <article className="upcoming-check-card" style={item.presentation.style} key={actionId}>
            <span className="settings-row-icon today-task-icon" aria-hidden="true"><AppIcon name={routineIconName(item.presentation.icon)} /></span>
            <div className="upcoming-check-copy">
              <h3>{item.presentation.name}</h3>
              <p>{plannedWindowLabel(item.planned.start, item.planned.end, now, locale, t)}</p>
            </div>
            {onRequest || onSkip || onEditPlan ? <UpcomingCheckActionMenu actionId={actionId} routineId={item.routineId} routineName={item.presentation.name} plannedStart={item.planned.start} plannedEnd={item.planned.end} onRequest={onRequest} onSkip={onSkip} onEditPlan={onEditPlan} t={t} /> : null}
          </article>;
        })}
      </div>
    </section>
  );
}
