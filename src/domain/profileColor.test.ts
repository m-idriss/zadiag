import { describe, expect, it } from 'vitest';
import { defaultProfileColorKey, profileColorFor, profileColorKeyFor } from './profileColor';

describe('participant profile colors', () => {
  it('derives a stable default from the participant id', () => {
    expect(defaultProfileColorKey('participant-yoan')).toBe(defaultProfileColorKey('participant-yoan'));
    expect(profileColorFor({ id: 'participant-yoan' })).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('prefers the explicitly selected color', () => {
    expect(profileColorKeyFor({ id: 'participant-yoan', profileColor: 'violet' })).toBe('violet');
  });
});
