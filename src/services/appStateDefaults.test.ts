import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialRemoteState, PREFERENCES_KEY, readStoredPreferences } from './appStateDefaults';

describe('app state defaults', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('falls back to empty preferences when persisted JSON is corrupted', () => {
    localStorage.setItem(PREFERENCES_KEY, '{not-json');

    expect(readStoredPreferences()).toEqual({});
    expect(initialRemoteState()).toMatchObject({
      family: { linked: false },
      routinesLoaded: false,
      events: [],
    });
  });

  it('drops obsolete display preferences from persisted state', () => {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
      notificationWindowStart: '09:00',
      notificationWindowEnd: '20:00',
      legacyLayoutMode: true,
    }));

    expect(initialRemoteState().preferences).toEqual({
      notificationWindowStart: '09:00',
      notificationWindowEnd: '20:00',
    });
  });
});
