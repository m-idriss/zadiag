import { describe, expect, it } from 'vitest';
import type { AppState } from './models';
import { routeForState } from './appRouting';

const state = (overrides: Partial<AppState> = {}): AppState => ({
  locale: 'en',
  notificationsEnabled: false,
  family: {
    linked: false,
    childLinked: false,
    childName: '',
    linkingCode: '',
    parentRecoveryCode: '',
    consented: false,
  },
  routineAssignments: [],
  events: [],
  ...overrides,
});

describe('app routing', () => {
  it('prioritizes setup preview and install requirements before account state', () => {
    expect(routeForState(state({ role: 'parent' }), { setupPreview: 'notifications' })).toBe('notifications');
    expect(routeForState(state({ role: 'parent' }), { requiresInstall: true })).toBe('install');
  });

  it('guides new users through role selection then family linking', () => {
    expect(routeForState(state())).toBe('welcome');
    expect(routeForState(state({ role: 'parent' }))).toBe('link');
  });

  it('only requires notifications for linked child devices outside local demo', () => {
    const linkedChild = state({ role: 'child', family: { ...state().family, linked: true } });

    expect(routeForState(linkedChild)).toBe('notifications');
    expect(routeForState(linkedChild, { useLocalDemo: true })).toBe('app');
    expect(routeForState({ ...linkedChild, notificationsEnabled: true })).toBe('app');
  });
});
