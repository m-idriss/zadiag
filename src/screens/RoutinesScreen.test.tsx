import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomNav, navigationTabs, tabAfterSwipe } from '../components/BottomNav';
import { createDefaultRoutineAssignment, type AppState } from '../domain/models';
import { translate } from '../services/i18n';
import { RoutinesScreen } from './RoutinesScreen';

describe('participant routines navigation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
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

    expect(container.textContent).toContain('Home');
    expect(container.textContent).toContain('Routines');
    expect(container.textContent).not.toContain('My progress');
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Primary navigation');
    expect(container.querySelector('button[aria-current="page"]')?.textContent).toContain('Home');
  });

  it('can roll participant navigation back with the feature flag', () => {
    act(() => root.render(<BottomNav tab="home" role="child" routineCentricEnabled={false} onChange={() => undefined} t={(key) => translate('en', key)} />));
    expect(container.textContent).toContain('My progress');
    expect(container.textContent).not.toContain('Routines');
  });

  it('uses the routine tab for responsible navigation too', () => {
    act(() => root.render(<BottomNav tab="home" role="parent" onChange={() => undefined} t={(key) => translate('en', key)} />));
    expect(container.textContent).toContain('Home');
    expect(container.textContent).toContain('Routines');
    expect(container.textContent).toContain('Settings');
    expect(container.textContent).not.toContain('History');
  });

  it('moves between tabs in visual navigation order without wrapping', () => {
    const tabs = navigationTabs('parent');
    expect(tabs).toEqual(['home', 'routines', 'settings']);
    expect(tabAfterSwipe(tabs, 'home', 'left')).toBe('routines');
    expect(tabAfterSwipe(tabs, 'routines', 'left')).toBe('settings');
    expect(tabAfterSwipe(tabs, 'settings', 'left')).toBe('settings');
    expect(tabAfterSwipe(tabs, 'settings', 'right')).toBe('routines');
    expect(tabAfterSwipe(tabs, 'home', 'right')).toBe('home');
  });

  it('announces routine loading and error states', () => {
    const state = {
      role: 'child' as const, locale: 'en' as const, notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: false },
      routineAssignments: [], events: [], routinesLoaded: false, routinesError: false,
    };
    act(() => root.render(<RoutinesScreen state={state} t={(key) => translate('en', key)} />));
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Loading routines');

    const retry = vi.fn().mockResolvedValue(undefined);
    act(() => root.render(<RoutinesScreen state={{ ...state, routinesLoaded: true, routinesError: true }} onRetryRoutines={retry} t={(key) => translate('en', key)} />));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('could not be loaded');
    const retryButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Retry');
    expect(retryButton).toBeDefined();
    act(() => retryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(retry).toHaveBeenCalled();
  });

  it('opens the routine catalog when the responsible view is empty', () => {
    localStorage.setItem('zadiag.routines.catalogOpen', 'false');
    const state: AppState = {
      role: 'parent', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: false, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [], events: [], routinesLoaded: true, routinesError: false,
    };
    act(() => root.render(<RoutinesScreen state={state} onAssignRoutine={async () => undefined} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('Choose a routine');
    expect(container.textContent).toContain('Hydration');
    expect(container.textContent).toContain('Wellness');
    expect(container.textContent).toContain('Validation: AI analysis');
    expect(container.textContent).toContain('Proof example');
    expect(container.textContent).toContain('visible glass');
    expect(container.querySelector('.routines-add-button')?.getAttribute('aria-label')).toBe('Add a routine');
    expect(container.querySelector('.routines-add-button')?.textContent).not.toContain('Add a routine');
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
        { id: 'missed', routineId: assignment.routineId, sessionId: 'two', requestedAt: '2026-07-02T10:00:00.000Z', capturedAt: '2026-07-02T10:20:00.000Z', expiresAt: '2026-07-02T11:00:00.000Z', status: 'not_detected', proofImagePath: 'families/family/checks/missed/proof.jpg', analysisSource: 'ai', confidence: 0.82, imageQuality: 0.74, reason: 'Elastics not visible', reviewStatus: 'approved', reviewedAt: '2026-07-02T10:30:00.000Z', reviewReason: 'Checked manually' },
        { id: 'next', routineId: assignment.routineId, sessionId: 'three', requestedAt: '2026-07-02T18:00:00.000Z', expiresAt: '2026-07-02T20:00:00.000Z', status: 'pending' },
        { id: 'other', routineId: 'another-routine', sessionId: 'four', requestedAt: '2026-07-02T12:00:00.000Z', expiresAt: '2026-07-02T13:00:00.000Z', status: 'detected', reason: 'Other routine event' },
      ],
    };

    const getProofImageUrl = vi.fn().mockResolvedValue('data:image/png;base64,PROOF');
    act(() => root.render(<RoutinesScreen state={state} getProofImageUrl={getProofImageUrl} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('Orthodontic Elastics');
    expect(container.textContent).toContain('3 max checks each day');
    expect(container.textContent).toContain('33%');
    expect(container.textContent).not.toContain('Wear your elastics as prescribed');
    expect(container.textContent).toContain('Next check');
    expect(container.textContent).not.toContain('07:30–09:30');

    const scheduleToggle = container.querySelector('button[aria-label="Show schedule"]');
    act(() => scheduleToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(scheduleToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('Wear your elastics as prescribed');
    expect(container.textContent).toContain('Next check');
    expect(container.textContent).toContain('07:30–09:30');

    const details = container.querySelector('button[aria-label="Details"]');
    await act(async () => {
      details?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    });

    expect(container.textContent).toContain('Tracking');
    expect(container.textContent).toContain('Instructions');
    expect(container.textContent).toContain('Expected proof');
    expect(container.textContent).toContain('Take a clear photo');

    const tracking = Array.from(container.querySelectorAll('.routine-tabs button')).find((button) => button.textContent === 'Tracking');
    await act(async () => {
      tracking?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(container.textContent).toContain('Recent history');
    expect(container.textContent).not.toContain('Other routine event');
    expect(getProofImageUrl).toHaveBeenCalledWith('missed');
    const proofThumb = container.querySelector<HTMLButtonElement>('.submission-thumb-button');
    expect(proofThumb?.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,PROOF');
    act(() => proofThumb?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector('.proof-lightbox img')?.getAttribute('src')).toBe('data:image/png;base64,PROOF');
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(container.querySelector('.proof-lightbox')).toBeNull();

    const historyRows = Array.from(container.querySelectorAll('.routine-history-row'));
    const missedHistoryRow = historyRows.find((row) => row.textContent?.includes('Elastics not visible'));
    const historyOpen = missedHistoryRow?.querySelector<HTMLButtonElement>('.routine-history-open');
    expect(historyOpen?.getAttribute('aria-label')).toContain('Check details');
    act(() => historyOpen?.click());
    expect(container.querySelector('.history-detail-dialog')).not.toBeNull();
    expect(container.querySelector('.history-detail-dialog')?.textContent).toContain('Proof sent');
    expect(container.querySelector('.history-detail-dialog')?.textContent).toContain('AI');
    expect(container.querySelector('.history-detail-dialog')?.textContent).toContain('82%');
    expect(container.querySelector('.history-detail-dialog')?.textContent).toContain('Approved');
    expect(container.querySelector('.history-detail-dialog')?.textContent).toContain('Checked manually');
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(container.querySelector('.history-detail-dialog')).toBeNull();

    expect(container.textContent).toContain('Overall progress');
    expect(container.textContent).toContain('Activity');
    const heatmapDays = container.querySelectorAll('.routine-heatmap-day');
    expect(heatmapDays.length).toBeGreaterThanOrEqual(56);
    expect(heatmapDays.length % 7).toBe(0);
    expect(container.textContent).toContain('33%');

    const back = container.querySelector('.detail-back');
    act(() => back?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('Routines');
  });

  it('keeps participant routine management read-only even when edit callbacks are provided', async () => {
    await import('./RoutineDetailScreen');
    const assignment = createDefaultRoutineAssignment();
    const state: AppState = {
      role: 'child',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: false },
      routineAssignments: [assignment],
      events: [],
    };
    const requestCheck = vi.fn().mockResolvedValue(undefined);
    const assignRoutine = vi.fn().mockResolvedValue(undefined);
    const deleteRoutine = vi.fn().mockResolvedValue(undefined);
    const saveMonitoringPlan = vi.fn().mockResolvedValue(undefined);

    act(() => root.render(
      <RoutinesScreen
        state={state}
        edit
        requestCheck={requestCheck}
        onAssignRoutine={assignRoutine}
        onDeleteRoutine={deleteRoutine}
        onSaveMonitoringPlan={saveMonitoringPlan}
        t={(key) => translate('en', key)}
      />,
    ));

    expect(container.querySelector('.add-routine-button')).toBeNull();

    const scheduleToggle = container.querySelector('button[aria-label="Show schedule"]');
    act(() => scheduleToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).not.toContain('Request a check now');
    expect(container.querySelector('button[aria-label^="Delete"]')).toBeNull();

    const details = container.querySelector('button[aria-label="Details"]');
    await act(async () => {
      details?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    });

    expect(Array.from(container.querySelectorAll('.routine-tabs button')).map((button) => button.textContent)).toEqual(['Info', 'Tracking']);
    expect(container.textContent).not.toContain('Edit');
    expect(requestCheck).not.toHaveBeenCalled();
    expect(assignRoutine).not.toHaveBeenCalled();
    expect(deleteRoutine).not.toHaveBeenCalled();
    expect(saveMonitoringPlan).not.toHaveBeenCalled();
  });

  it('restores routine page and detail tab state after returning to the page', async () => {
    await import('./RoutineDetailScreen');
    const assignment = createDefaultRoutineAssignment();
    const state: AppState = {
      role: 'child',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: false },
      routineAssignments: [assignment],
      events: [
        { id: 'done', routineId: assignment.routineId, sessionId: 'one', requestedAt: '2026-07-02T08:00:00.000Z', expiresAt: '2026-07-02T09:00:00.000Z', status: 'detected' },
      ],
    };

    act(() => root.render(<RoutinesScreen state={state} t={(key) => translate('en', key)} />));

    const scheduleToggle = container.querySelector('button[aria-label="Show schedule"]');
    act(() => scheduleToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(scheduleToggle?.getAttribute('aria-expanded')).toBe('true');

    const details = container.querySelector('button[aria-label="Details"]');
    await act(async () => {
      details?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    });

    const tracking = Array.from(container.querySelectorAll('.routine-tabs button')).find((button) => button.textContent === 'Tracking');
    act(() => tracking?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(tracking?.getAttribute('aria-current')).toBe('page');

    act(() => root.render(<div />));
    await act(async () => {
      root.render(<RoutinesScreen state={state} t={(key) => translate('en', key)} />);
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    });

    expect(container.textContent).toContain('Recent history');
    const restoredTracking = Array.from(container.querySelectorAll('.routine-tabs button')).find((button) => button.textContent === 'Tracking');
    expect(restoredTracking?.getAttribute('aria-current')).toBe('page');

    const back = container.querySelector('.detail-back');
    act(() => back?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('Routines');
    const restoredScheduleToggle = container.querySelector('button[aria-label="Hide schedule"]');
    expect(restoredScheduleToggle?.getAttribute('aria-expanded')).toBe('true');

    act(() => root.render(<div />));
    act(() => root.render(<RoutinesScreen state={state} t={(key) => translate('en', key)} />));
    expect(container.textContent).toContain('Routines');
    expect(container.querySelector('.routine-tabs')).toBeNull();
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
    expect(container.textContent).toContain('12:00 PM–2:00 PM');
    expect(container.textContent).not.toContain('Before');
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

    const addButton = container.querySelector('.routines-add-button');
    act(() => addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.textContent).toContain('Choose a routine');
    expect(container.textContent).toContain('Hydration');
    expect(container.textContent).toContain('Dental care');
    expect(container.textContent).toContain('Proof example: Mouth photo');
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
      routineAssignments: [elastics, hydration],
      events: [{
        id: 'hydration-active',
        routineId: 'daily-hydration',
        sessionId: 'hydration-session',
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
        status: 'pending',
      }],
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

    expect(confirm).toHaveBeenCalledWith('Delete Hydration? This removes 1 history items and 1 active checks for this routine.');
    expect(deleteRoutine).toHaveBeenCalledWith('daily-hydration');
    confirm.mockRestore();
  });

  it('prevents deleting the last assigned routine with clear messaging', () => {
    const assignment = createDefaultRoutineAssignment();
    const state: AppState = {
      role: 'parent', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: false },
      routineAssignments: [assignment], events: [],
    };
    const deleteRoutine = vi.fn().mockResolvedValue(undefined);
    act(() => root.render(<RoutinesScreen state={state} edit onDeleteRoutine={deleteRoutine} t={(key) => translate('en', key)} />));

    const scheduleToggle = container.querySelector('button[aria-label="Show schedule"]');
    act(() => scheduleToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    const deleteButton = container.querySelector<HTMLButtonElement>('button[aria-label="Delete Orthodontic Elastics"]');
    expect(deleteButton?.disabled).toBe(true);
    expect(container.textContent).toContain('Keep at least one routine before deleting another one.');
    expect(deleteRoutine).not.toHaveBeenCalled();
  });

  it('backs off before retrying failed check requests', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-07T08:00:00.000Z'));
    const assignment = createDefaultRoutineAssignment();
    const state: AppState = {
      role: 'parent', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment], events: [],
    };
    const requestCheck = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(undefined);
    act(() => root.render(<RoutinesScreen state={state} edit requestCheck={requestCheck} t={(key) => translate('en', key)} />));

    const scheduleToggle = container.querySelector('button[aria-label="Show schedule"]');
    act(() => scheduleToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const requestButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Request a check now') as HTMLButtonElement;

    await act(async () => {
      requestButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Retry in 2s.');
    expect(requestButton.disabled).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await Promise.resolve();
    });

    expect(requestButton.disabled).toBe(false);
  });
});
