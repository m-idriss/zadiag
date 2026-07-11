import { useRef } from 'react';
import { checkmarkOutline, chevronDownOutline } from 'ionicons/icons';
import type { ParticipantAccess } from '../domain/models';
import { SvgIcon } from './SvgIcon';

export function ParticipantSelector({ access, activeParticipantId, label, onSelect }: {
  access: ParticipantAccess[] | undefined;
  activeParticipantId?: string;
  label: string;
  onSelect?: (participantId: string) => void;
}) {
  const activeAccess = (access ?? []).filter((entry) => entry.membership.status === 'active');
  if (activeAccess.length < 2 || !onSelect) return null;
  const selectedId = activeAccess.some((entry) => entry.participant.id === activeParticipantId)
    ? activeParticipantId
    : activeAccess[0].participant.id;
  const selected = activeAccess.find((entry) => entry.participant.id === selectedId)!;
  const detailsRef = useRef<HTMLDetailsElement>(null);
  return (
    <details className="participant-switcher" ref={detailsRef}>
      <summary aria-label={`${label} : ${selected.participant.displayName}`}>
        <span className="avatar participant-switcher-avatar" aria-hidden="true">
          {selected.participant.displayName.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <span className="participant-switcher-chevron" aria-hidden="true"><SvgIcon icon={chevronDownOutline} /></span>
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
