import type { PhotoChecklistItemResult, RoutinePhotoChecklistCriterion } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { AppIcon } from './Icon';

const itemStatusKey = (status: PhotoChecklistItemResult['status']): MessageKey =>
  status === 'detected'
    ? 'photoChecklistItemDetected'
    : status === 'not_detected'
      ? 'photoChecklistItemMissing'
      : 'photoChecklistItemUncertain';

export function PhotoChecklistSummary({
  criteria,
  results,
  title,
  t,
}: {
  criteria: RoutinePhotoChecklistCriterion[];
  results?: PhotoChecklistItemResult[];
  title: string;
  t: (key: MessageKey) => string;
}) {
  const resultById = new Map(results?.map((result) => [result.criterionId, result]));
  return (
    <section className="photo-checklist-summary" aria-labelledby="photo-checklist-summary-title">
      <h2 id="photo-checklist-summary-title">{title}</h2>
      <ul>
        {criteria.map((criterion) => {
          const result = resultById.get(criterion.id);
          const statusLabel = result ? t(itemStatusKey(result.status)) : undefined;
          const decisionLabel = result
            ? t(result.decision.source === 'responsible'
              ? 'photoChecklistDecisionResponsible'
              : result.decision.source === 'fallback'
                ? 'photoChecklistDecisionFallback'
                : 'photoChecklistDecisionAi')
            : undefined;
          return (
            <li
              key={criterion.id}
              className={result ? `photo-checklist-item status-${result.status}` : 'photo-checklist-item'}
              aria-label={statusLabel ? `${criterion.label}: ${statusLabel}` : criterion.label}
            >
              <span className="photo-checklist-item-icon" aria-hidden="true">
                <AppIcon name={!result ? 'camera' : result.status === 'detected' ? 'check' : result.status === 'not_detected' ? 'close' : 'time'} />
              </span>
              <span className="photo-checklist-item-copy">
                <strong>{criterion.label}</strong>
                {statusLabel ? <small>{statusLabel}</small> : null}
                {decisionLabel ? <small>{decisionLabel}</small> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
