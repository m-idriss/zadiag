import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRoutineAssignment, type AppState } from '../domain/models';
import { translate } from '../services/i18n';
import { ParentDashboard } from './ParentDashboard';

describe('ParentDashboard', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps the parent overview blocks and replaces needs attention with filterable history', () => {
    const assignment = createDefaultRoutineAssignment('2026-07-02T08:00:00.000Z');
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: false, childName: 'Maya', linkingCode: 'ZD-123456', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment],
      events: [
        { id: 'event', routineId: assignment.routineId, sessionId: 'one', requestedAt: '2026-07-02T08:00:00.000Z', expiresAt: '2026-07-02T09:00:00.000Z', status: 'detected' },
      ],
    };

    act(() => root.render(<ParentDashboard state={state} regenerateCode={vi.fn()} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('Last 7 days');
    expect(container.textContent).toContain('Participant linking code');
    expect(container.textContent).toContain('Recent history');
    expect(container.textContent).toContain('StatusAll');
    expect(container.textContent).not.toContain('Monitoring plan');
    expect(container.textContent).not.toContain('Needs attention');
  });

  it('shows a first routine creation block when no routine exists', () => {
    const openRoutines = vi.fn();
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: false, childName: 'Maya', linkingCode: 'ZD-123456', parentRecoveryCode: '', consented: true },
      routineAssignments: [],
      events: [],
    };

    act(() => root.render(<ParentDashboard state={state} regenerateCode={vi.fn()} onCreateRoutine={openRoutines} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('Create the first routine');
    act(() => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Choose a routine')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(openRoutines).toHaveBeenCalled();
  });
});
