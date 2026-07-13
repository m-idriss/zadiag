import type { ParticipantSummary, ProfileColorKey } from './models';

export const profileColorPalette: ReadonlyArray<{ key: ProfileColorKey; hex: string }> = [
  { key: 'blue', hex: '#2563EB' },
  { key: 'indigo', hex: '#4F46E5' },
  { key: 'violet', hex: '#7C3AED' },
  { key: 'rose', hex: '#DB2777' },
  { key: 'coral', hex: '#D94F4F' },
  { key: 'amber', hex: '#A86408' },
  { key: 'emerald', hex: '#15803D' },
  { key: 'teal', hex: '#0F766E' },
];

export const isProfileColorKey = (value: unknown): value is ProfileColorKey =>
  typeof value === 'string' && profileColorPalette.some((color) => color.key === value);

export const defaultProfileColorKey = (participantId: string): ProfileColorKey => {
  let hash = 2166136261;
  for (const character of participantId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return profileColorPalette[Math.abs(hash) % profileColorPalette.length].key;
};

export const profileColorKeyFor = (participant: Pick<ParticipantSummary, 'id' | 'profileColor'>) =>
  participant.profileColor ?? defaultProfileColorKey(participant.id);

export const profileColorHex = (key: ProfileColorKey) =>
  profileColorPalette.find((color) => color.key === key)?.hex ?? profileColorPalette[0].hex;

export const profileColorFor = (participant: Pick<ParticipantSummary, 'id' | 'profileColor'>) =>
  profileColorHex(profileColorKeyFor(participant));
