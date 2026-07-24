import { useRef, type CSSProperties } from 'react';
import { checkmarkOutline, peopleOutline, personCircleOutline } from 'ionicons/icons';
import type { ParticipantAccess } from '../domain/models';
import { ProfileContextCard } from './ProfileContextCard';
import { SvgIcon } from './SvgIcon';
import { profileColorFor } from '../domain/profileColor';

export function ParticipantSelector({ access, activeParticipantId, label, title, subtitle, actionLabel, overviewLabel, overviewSelected = false, onSelect, onSelectOverview }: {
  access: ParticipantAccess[] | undefined;
  activeParticipantId?: string;
  label: string;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  overviewLabel?: string;
  overviewSelected?: boolean;
  onSelect?: (participantId: string) => void;
  onSelectOverview?: () => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const activeAccess = (access ?? []).filter((entry) => entry.membership.status === 'active');
  if (!activeAccess.length) return null;
  const selectedId = activeAccess.some((entry) => entry.participant.id === activeParticipantId)
    ? activeParticipantId
    : activeAccess[0].participant.id;
  const selected = activeAccess.find((entry) => entry.participant.id === selectedId)!;
  const displayTitle = overviewSelected && overviewLabel ? overviewLabel : title ?? `${label} ${selected.participant.displayName}`;
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
        leadingIcon={personCircleOutline}
        actionIcon={peopleOutline}
        actionLabel={`${actionLabel ?? label} : ${overviewSelected && overviewLabel ? overviewLabel : selected.participant.displayName}`}
        profileColor={overviewSelected ? undefined : profileColorFor(selected.participant)}
      />
      <div className="participant-switcher-menu" role="group" aria-label={label}>
        <span className="participant-switcher-label">{label}</span>
        {overviewLabel && onSelectOverview ? (
          <button
            type="button"
            className={overviewSelected ? 'active' : undefined}
            aria-pressed={overviewSelected}
            onClick={() => {
              detailsRef.current?.removeAttribute('open');
              if (!overviewSelected) onSelectOverview();
            }}
          >
            <span className="participant-switcher-option-avatar participant-switcher-overview-avatar" aria-hidden="true"><SvgIcon icon={peopleOutline} /></span>
            <span>{overviewLabel}</span>
            {overviewSelected ? <SvgIcon icon={checkmarkOutline} /> : null}
          </button>
        ) : null}
        {activeAccess.map((entry) => {
          const active = !overviewSelected && entry.participant.id === selectedId;
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
              <span className="participant-switcher-option-avatar" style={{ '--profile-color': profileColorFor(entry.participant) } as CSSProperties} aria-hidden="true">{entry.participant.displayName.trim().charAt(0).toUpperCase() || '?'}</span>
              <span>{entry.participant.displayName}</span>
              {active ? <SvgIcon icon={checkmarkOutline} /> : null}
            </button>
          );
        })}
      </div>
    </details>
  );
}
