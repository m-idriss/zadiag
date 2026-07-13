import { useRef } from 'react';
import { checkmarkOutline, personCircleOutline } from 'ionicons/icons';
import type { ParticipantAccess } from '../domain/models';
import { ProfileContextCard } from './ProfileContextCard';
import { SvgIcon } from './SvgIcon';
import { profileColorFor } from '../domain/profileColor';

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
      <ProfileContextCard as="div" title={displayTitle} subtitle={subtitle} profileColor={profileColorFor(selected.participant)} />
    </div>;
  }
  return (
    <details className="participant-switcher" ref={detailsRef}>
      <ProfileContextCard
        as="summary"
        className="card"
        title={displayTitle}
        subtitle={subtitle}
        actionIcon={personCircleOutline}
        actionLabel={`${actionLabel ?? label} : ${selected.participant.displayName}`}
        profileColor={profileColorFor(selected.participant)}
      />
      <div className="participant-switcher-menu" role="group" aria-label={label}>
        <span className="participant-switcher-label">{label}</span>
        {activeAccess.map((entry) => {
          const active = entry.participant.id === selectedId;
          return (
            <button
              type="button"
              className={active ? 'active' : undefined}
              aria-pressed={active}
              key={entry.participant.id}
              onClick={() => {
                detailsRef.current?.removeAttribute('open');
                if (!active) onSelect(entry.participant.id);
              }}
            >
              <span className="participant-switcher-option-avatar" style={{ color: profileColorFor(entry.participant) }} aria-hidden="true">{entry.participant.displayName.trim().charAt(0).toUpperCase() || '?'}</span>
              <span>{entry.participant.displayName}</span>
              {active ? <SvgIcon icon={checkmarkOutline} /> : null}
            </button>
          );
        })}
      </div>
    </details>
  );
}
