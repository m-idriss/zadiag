import type { presentedAwaitingRoutineChecks } from '../domain/dashboardChecks';
import { plannedWindowLabel } from '../domain/taskTimeLabel';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from './Icon';

type PresentedAwaitingCheck = ReturnType<typeof presentedAwaitingRoutineChecks>[number];

export function AwaitingCheckCards({ checks, now, locale, t }: {
  checks: PresentedAwaitingCheck[];
  now: Date;
  locale: string;
  t: (key: MessageKey) => string;
}) {
  return checks.map((item) => (
    <article className="upcoming-check-card awaiting-check-card" style={item.presentation.style} key={item.id}>
      <span className="settings-row-icon today-task-icon" aria-hidden="true"><AppIcon name={routineIconName(item.presentation.icon)} /></span>
      <div>
        <h3>{item.presentation.name}</h3>
        <p>{plannedWindowLabel(item.planned.start, item.planned.end, now, locale, t)}</p>
        <p aria-live="polite">{t('scheduledCheckPreparing')}</p>
      </div>
    </article>
  ));
}
