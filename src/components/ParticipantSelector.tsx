import { useRef } from 'react';
import { checkmarkOutline, chevronDownOutline, peopleOutline } from 'ionicons/icons';
import type { ParticipantAccess } from '../domain/models';
import { SvgIcon } from './SvgIcon';

export function ParticipantSelector({ access, activeParticipantId, label, title, subtitle, actionLabel, onSelect }: {
  access: ParticipantAccess[] | undefined;
  activeParticipantId?: string;
  label: string;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  onSelect?: (participantId: string) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const activeAccess = (access ?? []).filter((entry) => entry.membership.status === 'active');
  if (!activeAccess.length) return null;
  const selectedId = activeAccess.some((entry) => entry.participant.id === activeParticipantId)
    ? activeParticipantId
    : activeAccess[0].participant.id;
  const selected = activeAccess.find((entry) => entry.participant.id === selectedId)!;
  const displayTitle = title ?? `${label} ${selected.participant.displayName}`;
  if (activeAccess.length < 2 || !onSelect) {
    return <div className="card relationship-manager-card participant-switcher-static">
      <div className="relationship-manager-toggle">
        <span className="relationship-manager-icon" aria-hidden="true"><SvgIcon icon={peopleOutline} /></span>
        <span className="relationship-manager-summary"><strong>{displayTitle}</strong>{subtitle ? <small>{subtitle}</small> : null}</span>
      </div>
    </div>;
  }
  return (
    <details className="participant-switcher" ref={detailsRef}>
      <summary className="card relationship-manager-toggle" aria-label={`${label} : ${selected.participant.displayName}`}>
        <span className="relationship-manager-icon" aria-hidden="true"><SvgIcon icon={peopleOutline} /></span>
        <span className="relationship-manager-summary"><strong>{displayTitle}</strong>{subtitle ? <small>{subtitle}</small> : null}</span>
        {actionLabel ? <span className="relationship-manager-action">{actionLabel}<SvgIcon icon={chevronDownOutline} /></span> : null}
      </summary>
      <div className="participant-switcher-menu" role="group" aria-label={label}>
        <span className="participant-switcher-label">{label}</span>
        {activeAccess.map((entry) => {
          const active = entry.participant.id === selectedId;
          return (
            <button
              type="button"
              className={active ? 'active' : undefined}
              aria-current={active ? 'true' : undefined}
              key={entry.participant.id}
              onClick={() => {
                detailsRef.current?.removeAttribute('open');
                if (!active) onSelect(entry.participant.id);
              }}
            >
              <span className="participant-switcher-option-avatar" aria-hidden="true">{entry.participant.displayName.trim().charAt(0).toUpperCase() || '?'}</span>
              <span>{entry.participant.displayName}</span>
              {active ? <SvgIcon icon={checkmarkOutline} /> : null}
            </button>
          );
        })}
      </div>
    </details>
  );
}
