import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomNav } from '../components/BottomNav';
import { createDefaultRoutineAssignment, type AppState } from '../domain/models';
import { translate } from '../services/i18n';
import { RoutinesScreen } from './RoutinesScreen';

describe('participant routines navigation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => root.unmount());
    container.remove();
  });

  it('replaces Progress with Routines for participants', () => {
    act(() => root.render(<BottomNav tab="home" role="child" onChange={() => undefined} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('Activity');
    expect(container.textContent).toContain('Routines');
    expect(container.textContent).not.toContain('My progress');
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Primary navigation');
    expect(container.querySelector('button[aria-current="page"]')?.textContent).toContain('Activity');
  });

  it('can roll participant navigation back with the feature flag', () => {
    act(() => root.render(<BottomNav tab="home" role="child" routineCentricEnabled={false} onChange={() => undefined} t={(key) => translate('en', key)} />));
    expect(container.textContent).toContain('My progress');
    expect(container.textContent).not.toContain('Routines');
  });

  it('uses the routine tab for responsible navigation too', () => {
    act(() => root.render(<BottomNav tab="home" role="parent" onChange={() => undefined} t={(key) => translate('en', key)} />));
    expect(container.textContent).toContain('Overview');
    expect(container.textContent).toContain('Routines');
    expect(container.textContent).toContain('Settings');
    expect(container.textContent).not.toContain('History');
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

  it('opens the routine catalog when the responsible view is empty', () => {
    const state: AppState = {
      role: 'parent', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: false, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [], events: [], routinesLoaded: true, routinesError: false,
    };
    act(() => root.render(<RoutinesScreen state={state} onAssignRoutine={async () => undefined} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('Choose a routine');
    expect(container.textContent).toContain('Hydration');
    expect(container.querySelector('.add-routine-button')).not.toBeNull();
  });

  it('shows the assigned routine frequency, completion and next task', async () => {
    await import('./RoutineDetailScreen');
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
    expect(container.textContent).toContain('50%');
    expect(container.textContent).not.toContain('Wear your elastics as prescribed');
    expect(container.textContent).toContain('Next check');
    expect(container.textContent).not.toContain('07:30–09:30');

    const scheduleToggle = container.querySelector('button[aria-label="Show schedule"]');
    act(() => scheduleToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(scheduleToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('Wear your elastics as prescribed');
    expect(container.textContent).toContain('Next check');
    expect(container.textContent).toContain('07:30–09:30');

    const details = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Details');
    await act(async () => {
      details?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    });

    expect(container.textContent).toContain('Progress');
    expect(container.textContent).toContain('Instructions');
    expect(container.textContent).toContain('History');
    expect(container.textContent).toContain('Expected proof');

    const instructions = Array.from(container.querySelectorAll('.routine-tabs button')).find((button) => button.textContent === 'Instructions');
    act(() => instructions?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('Take a clear photo');

    const history = Array.from(container.querySelectorAll('.routine-tabs button')).find((button) => button.textContent === 'History');
    act(() => history?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('Recent history');
    expect(container.textContent).not.toContain('Other routine event');

    const progress = Array.from(container.querySelectorAll('.routine-tabs button')).find((button) => button.textContent === 'Progress');
    act(() => progress?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('Overall progress');
    expect(container.textContent).toContain('Activity');
    const heatmapDays = container.querySelectorAll('.routine-heatmap-day');
    expect(heatmapDays.length).toBeGreaterThanOrEqual(56);
    expect(heatmapDays.length % 7).toBe(0);
    expect(container.textContent).toContain('50%');

    const back = container.querySelector('.detail-back');
    act(() => back?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('My routines');
  });

  it('uses custom routine presentation and localized content without new UI code', () => {
    const assignment = createDefaultRoutineAssignment();
    assignment.id = 'hydration';
    assignment.routineId = 'hydration';
    assignment.routine = {
      id: 'hydration', name: 'Hydration', description: 'Daily water target', icon: '💧', accentColor: '#2387c9', proofType: 'Counter',
      translations: { fr: { name: 'Hydratation', description: 'Objectif quotidien en eau' } },
    };
    const state: AppState = {
      role: 'child', locale: 'fr', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: false },
      routineAssignments: [assignment], events: [],
    };
    act(() => root.render(<RoutinesScreen state={state} t={(key) => translate('fr', key)} />));
    expect(container.textContent).toContain('Hydratation');
    expect(container.querySelector('.routine-icon .app-icon')).not.toBeNull();
    expect(container.querySelector('.routine-card')?.getAttribute('style')).toContain('#2387c9');
  });

  it('shows the next planned check when no task is pending', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 6, 10, 0));
    const assignment = createDefaultRoutineAssignment();
    const state: AppState = {
      role: 'child', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: false },
      routineAssignments: [assignment], events: [],
    };

    act(() => root.render(<RoutinesScreen state={state} t={(key) => translate('en', key)} />));

    const scheduleToggle = container.querySelector('button[aria-label="Show schedule"]');
    act(() => scheduleToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.textContent).toContain('Next check');
    expect(container.textContent).toContain('Before');
    expect(container.textContent).not.toContain('No task is waiting right now.');
  });

  it('opens a routine catalog and assigns a new routine', async () => {
    const assignment = createDefaultRoutineAssignment();
    const state: AppState = {
      role: 'parent', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: false },
      routineAssignments: [assignment], events: [],
    };
    const assignRoutine = vi.fn().mockResolvedValue(undefined);
    act(() => root.render(<RoutinesScreen state={state} onAssignRoutine={assignRoutine} t={(key) => translate('en', key)} />));

    const addButton = container.querySelector('.add-routine-button');
    act(() => addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.textContent).toContain('Choose a routine');
    expect(container.textContent).toContain('Hydration');
    expect(Array.from(container.querySelectorAll('.routine-catalog-add')).some((button) => button.textContent === 'Added')).toBe(true);

    const hydrationButton = Array.from(container.querySelectorAll('.routine-catalog-item'))
      .find((item) => item.textContent?.includes('Hydration'))
      ?.querySelector('button');
    await act(async () => {
      hydrationButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(assignRoutine).toHaveBeenCalledWith('daily-hydration');
  });

  it('deletes an assigned routine after confirmation', async () => {
    const elastics = createDefaultRoutineAssignment();
    const hydration = createDefaultRoutineAssignment();
    hydration.id = 'daily-hydration';
    hydration.routineId = 'daily-hydration';
    hydration.routine = {
      id: 'daily-hydration',
      name: 'Hydration',
      description: 'Daily water target',
      icon: '💧',
      accentColor: '#2387c9',
    };
    const state: AppState = {
      role: 'parent', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: false },
      routineAssignments: [elastics, hydration], events: [],
    };
    const deleteRoutine = vi.fn().mockResolvedValue(undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    act(() => root.render(<RoutinesScreen state={state} edit onDeleteRoutine={deleteRoutine} t={(key) => translate('en', key)} />));

    const hydrationCard = Array.from(container.querySelectorAll('.routine-card'))
      .find((card) => card.textContent?.includes('Hydration'));
    const scheduleToggle = hydrationCard?.querySelector('button[aria-label="Show schedule"]');
    act(() => scheduleToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const deleteButton = Array.from(hydrationCard?.querySelectorAll('button') ?? [])
      .find((button) => button.getAttribute('aria-label') === 'Delete Hydration');
    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(confirm).toHaveBeenCalledWith('Delete Hydration? Related checks will be removed.');
    expect(deleteRoutine).toHaveBeenCalledWith('daily-hydration');
    confirm.mockRestore();
  });
});
