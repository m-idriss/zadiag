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
      ],
    };

    act(() => root.render(<RoutinesScreen state={state} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('Orthodontic Elastics');
    expect(container.textContent).toContain('3 checks each day');
    expect(container.textContent).toContain('50% completion');
    expect(container.textContent).toContain('Next task before');
    expect(container.textContent).toContain('Active');
  });
});
