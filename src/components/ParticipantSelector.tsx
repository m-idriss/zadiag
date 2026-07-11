import { useRef } from 'react';
import { checkmarkOutline } from 'ionicons/icons';
import type { ParticipantAccess } from '../domain/models';
import { SvgIcon } from './SvgIcon';

export function ParticipantSelector({ access, activeParticipantId, label, title, actionLabel, onSelect }: {
  access: ParticipantAccess[] | undefined;
  activeParticipantId?: string;
  label: string;
  title?: string;
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
    return <div className="participant-switcher-card participant-switcher-static"><strong>{displayTitle}</strong></div>;
  }
  return (
    <details className="participant-switcher" ref={detailsRef}>
      <summary className="participant-switcher-card" aria-label={`${label} : ${selected.participant.displayName}`}>
        <strong>{displayTitle}</strong>
        {actionLabel ? <small>{actionLabel}</small> : null}
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
