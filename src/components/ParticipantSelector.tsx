import type { ParticipantAccess } from '../domain/models';

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
  return (
    <label className="participant-selector">
      <span>{label}</span>
      <select value={selectedId} onChange={(event) => onSelect(event.target.value)}>
        {activeAccess.map((entry) => (
          <option key={entry.participant.id} value={entry.participant.id}>{entry.participant.displayName}</option>
        ))}
      </select>
    </label>
  );
}

