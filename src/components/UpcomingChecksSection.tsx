import type { presentedUpcomingRoutineChecks } from '../domain/dashboardChecks';
import { plannedWindowLabel } from '../domain/taskTimeLabel';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from './Icon';

type PresentedUpcomingCheck = ReturnType<typeof presentedUpcomingRoutineChecks>[number];

export function UpcomingChecksSection({
  checks,
  now,
  locale,
  titleId,
  t,
}: {
  checks: PresentedUpcomingCheck[];
  now: Date;
  locale: string;
  titleId: string;
  t: (key: MessageKey) => string;
}) {
  if (!checks.length) return null;
  return (
    <section className="today-section upcoming-checks-section" aria-labelledby={titleId}>
      <div className="section-heading upcoming-checks-heading">
        <h2 id={titleId}>{t('upcomingChecks')}</h2>
      </div>
      <div className="upcoming-checks-list">
        {checks.map((item) => (
          <article className="upcoming-check-card" style={item.presentation.style} key={item.id}>
            <span className="settings-row-icon today-task-icon" aria-hidden="true"><AppIcon name={routineIconName(item.presentation.icon)} /></span>
            <div>
              <h3>{item.presentation.name}</h3>
              <p>{plannedWindowLabel(item.planned.start, item.planned.end, now, locale, t)}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
