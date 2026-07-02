import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BottomNav } from '../components/BottomNav';
import { createDefaultRoutineAssignment, type AppState } from '../domain/models';
import { translate } from '../services/i18n';
import { RoutinesScreen } from './RoutinesScreen';

describe('participant routines navigation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('replaces Progress with Routines for participants', () => {
    act(() => root.render(<BottomNav tab="home" role="child" onChange={() => undefined} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('Today');
    expect(container.textContent).toContain('Routines');
    expect(container.textContent).not.toContain('My progress');
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Primary navigation');
    expect(container.querySelector('button[aria-current="page"]')?.textContent).toContain('Today');
  });

  it('announces routine loading and error states', () => {
    const state = {
      role: 'child' as const, locale: 'en' as const, notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: false },
      routineAssignments: [], events: [], routinesLoaded: false, routinesError: false,
    };
    act(() => root.render(<RoutinesScreen state={state} t={(key) => translate('en', key)} />));
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Loading routines');

    act(() => root.render(<RoutinesScreen state={{ ...state, routinesLoaded: true, routinesError: true }} t={(key) => translate('en', key)} />));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
  });

  it('shows the assigned routine frequency, completion and next task', () => {
    const assignment = createDefaultRoutineAssignment('2026-07-02T08:00:00.000Z');
    const state: AppState = {
      role: 'child',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: false },
      routineAssignments: [assignment],
      events: [
        { id: 'done', routineId: assignment.routineId, sessionId: 'one', requestedAt: '2026-07-02T08:00:00.000Z', expiresAt: '2026-07-02T09:00:00.000Z', status: 'detected' },
        { id: 'missed', routineId: assignment.routineId, sessionId: 'two', requestedAt: '2026-07-02T10:00:00.000Z', expiresAt: '2026-07-02T11:00:00.000Z', status: 'missed' },
        { id: 'next', routineId: assignment.routineId, sessionId: 'three', requestedAt: '2026-07-02T18:00:00.000Z', expiresAt: '2026-07-02T20:00:00.000Z', status: 'pending' },
        { id: 'other', routineId: 'another-routine', sessionId: 'four', requestedAt: '2026-07-02T12:00:00.000Z', expiresAt: '2026-07-02T13:00:00.000Z', status: 'detected', reason: 'Other routine event' },
      ],
    };

    act(() => root.render(<RoutinesScreen state={state} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('Orthodontic Elastics');
    expect(container.textContent).toContain('3 checks each day');
    expect(container.textContent).toContain('50% completion');
    expect(container.textContent).toContain('Next task before');
    expect(container.textContent).toContain('Active');

    const details = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('View details'));
    act(() => details?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.textContent).toContain('Routine overview');
    expect(container.textContent).toContain('Progress');
    expect(container.textContent).toContain('Schedule');
    expect(container.textContent).toContain('Instructions');
    expect(container.textContent).toContain('Calendar');
    expect(container.textContent).toContain('Recent submissions');
    expect(container.textContent).toContain('History');
    expect(container.textContent).toContain('50%');
    expect(container.textContent).not.toContain('Other routine event');

    const back = container.querySelector('.back-button');
    act(() => back?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('My routines');
  });
});
