import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomNav, navigationTabs, tabAfterSwipe } from '../components/BottomNav';
import { createDefaultRoutineAssignment, type AppState } from '../domain/models';
import { availableRoutines } from '../domain/routineCatalog';
import type { PublishedRoutineVersion, RoutineCatalogEntry, RoutineDraft } from '../domain/routineDraft';
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
    act(() => root.render(<BottomNav tab="home" role="child" profileColor="#7C3AED" onChange={() => undefined} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('Home');
    expect(container.textContent).toContain('Routines');
    expect(container.textContent).not.toContain('My progress');
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('Primary navigation');
    expect(container.querySelector('button[aria-current="page"]')?.textContent).toContain('Home');
    expect((container.querySelector('.bottom-nav') as HTMLElement | null)?.style.getPropertyValue('--profile-color')).toBe('#7C3AED');
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

    expect(document.body.textContent).toContain('Choose a routine');
    expect(document.body.textContent).toContain('Hydration');
    expect(document.body.textContent).toContain('Wellness');
    expect(document.body.textContent).toContain('Validation: AI analysis');
    expect(document.body.textContent).toContain('Proof example');
    expect(document.body.textContent).toContain('visible glass');
    expect(document.body.querySelector('.routine-catalog-tabs')).toBeNull();
    const builtInCards = Array.from(document.body.querySelectorAll<HTMLElement>('.routine-catalog-item'));
    expect(builtInCards).toHaveLength(availableRoutines.length);
    for (const card of builtInCards) {
      const headingId = card.getAttribute('aria-labelledby');
      expect(headingId).toBeTruthy();
      expect(card.querySelectorAll(`#${headingId}`)).toHaveLength(1);
      expect(card.querySelectorAll('.routine-catalog-add')).toHaveLength(1);
    }
    const dock = document.body.querySelector('.routine-add-switcher');
    expect(dock?.querySelector('.routines-add-dock-button')?.textContent).toContain('Add a routine');
    expect(dock?.querySelector('.routine-catalog-popover')).not.toBeNull();
    expect(dock?.closest('.content-screen')).toBeNull();
  });

  it('loads, opens and deletes private routine drafts without hiding built-ins', async () => {
    const assignment = createDefaultRoutineAssignment('2026-07-02T08:00:00.000Z');
    const state: AppState = {
      role: 'parent', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      participantAccess: [{ participant: { id: 'participant-1', displayName: 'Maya' }, membership: { role: 'owner', status: 'active' } }],
      activeParticipantId: 'participant-1', routineAssignments: [assignment], events: [], routinesLoaded: true, routinesError: false,
    };
    const draft: RoutineDraft = {
      id: 'draft-1', ownerId: 'owner-1', revision: 2, state: 'active',
      package: { schemaVersion: 1, version: 1, defaultLocale: 'en', availableLocales: ['en'], routine: { ...assignment.routine, id: 'private-hydration', name: 'My hydration plan', description: 'A private draft description' } },
      validation: { status: 'incomplete', issues: [{ code: 'required_field', path: 'routine.proofExample' }] },
      createdAt: '2026-07-02T08:00:00.000Z', updatedAt: '2026-07-02T09:00:00.000Z',
    };
    const listDrafts = vi.fn().mockResolvedValue([draft]);
    const deleteDraft = vi.fn().mockResolvedValue(undefined);
    const assignDraft = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    act(() => {
      root.render(<RoutinesScreen state={state} onAssignRoutine={async () => undefined} onListRoutineDrafts={listDrafts} onDeleteRoutineDraft={deleteDraft} onAssignRoutineDraft={assignDraft} t={(key) => translate('en', key)} />);
    });
    await act(async () => {
      document.body.querySelector<HTMLButtonElement>('.routines-add-dock-button')?.click();
      await Promise.resolve();
    });
    await act(async () => {
      Array.from(document.body.querySelectorAll<HTMLButtonElement>('.routine-catalog-tabs button')).find((button) => button.textContent === 'Private drafts')?.click();
      await Promise.resolve();
    });

    expect(listDrafts).toHaveBeenCalledWith('participant-1');
    expect(document.body.textContent).toContain('Private drafts');
    expect(document.body.textContent).toContain('Needs completion');
    expect(document.body.textContent).toContain('My hydration plan');
    expect(document.body.querySelectorAll('.routine-catalog-item')).toHaveLength(0);

    const view = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'View');
    act(() => view?.click());
    expect(view?.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.textContent).toContain('A private draft description');
    expect(document.body.textContent).toContain('Revision 2 · 1 issues');
    expect(document.body.textContent).toContain('Responsible view');
    expect(document.body.textContent).toContain('Participant view');
    expect(Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Assign this draft')?.disabled).toBe(true);
    expect(assignDraft).not.toHaveBeenCalled();

    await act(async () => {
      document.body.querySelector<HTMLButtonElement>('button[aria-label="Delete My hydration plan"]')?.click();
      await Promise.resolve();
    });
    expect(deleteDraft).toHaveBeenCalledWith('participant-1', 'draft-1', 2);
    expect(document.body.textContent).not.toContain('My hydration plan');
  });

  it('forks assigned content into a private draft before opening the editor', async () => {
    await import('./RoutineDetailScreen');
    await import('./RoutineDraftEditorScreen');
    const assignment = createDefaultRoutineAssignment('2026-07-20T08:00:00.000Z');
    const state: AppState = {
      role: 'parent', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      participantAccess: [{ participant: { id: 'participant-1', displayName: 'Maya' }, membership: { role: 'owner', status: 'active' } }],
      activeParticipantId: 'participant-1', routineAssignments: [assignment], events: [], routinesLoaded: true, routinesError: false,
    };
    const draft: RoutineDraft = {
      id: 'fork-1', ownerId: 'owner-1', revision: 1, state: 'active',
      package: { schemaVersion: 1, version: 1, defaultLocale: 'en', availableLocales: ['en'], routine: structuredClone(assignment.routine) },
      validation: { status: 'valid', issues: [] }, forkedFrom: { routineId: assignment.routineId },
      createdAt: '2026-07-20T09:00:00.000Z', updatedAt: '2026-07-20T09:00:00.000Z',
    };
    const fork = vi.fn().mockResolvedValue(draft);

    localStorage.setItem(`zadiag.routineDetail.${assignment.id}.tab`, 'details');
    act(() => root.render(<RoutinesScreen state={state} edit onForkRoutineAssignmentDraft={fork} t={(key) => translate('en', key)} />));
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Show schedule"]')?.click());
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Details"]')?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    });
    const editContent = container.querySelector<HTMLButtonElement>('.routine-content-edit-button');
    expect(editContent).not.toBeNull();
    await act(async () => {
      editContent?.click();
      await Promise.resolve();
    });

    expect(fork).toHaveBeenCalledWith('participant-1', assignment.routineId, 'en');
    expect(container.textContent).toContain('Routine editor');
    expect(container.querySelector<HTMLInputElement>('.routine-draft-field input')?.value).toBe(assignment.routine.name);
  });

  it('reviews fork changes before publishing the next routine version', async () => {
    const assignment = createDefaultRoutineAssignment('2026-07-20T08:00:00.000Z');
    const state: AppState = {
      role: 'parent', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      participantAccess: [{ participant: { id: 'participant-1', displayName: 'Maya' }, membership: { role: 'owner', status: 'active' } }],
      activeParticipantId: 'participant-1', routineAssignments: [assignment], events: [], routinesLoaded: true, routinesError: false,
    };
    const changedRoutine = structuredClone(assignment.routine);
    changedRoutine.name = 'Updated elastics';
    changedRoutine.analysis = { ...changedRoutine.analysis!, detectedCriteria: 'Updated visual criteria' };
    const draft: RoutineDraft = {
      id: 'fork-1', ownerId: 'owner-1', revision: 3, state: 'active',
      package: { schemaVersion: 1, version: 1, defaultLocale: 'en', availableLocales: ['en'], routine: changedRoutine },
      validation: { status: 'valid', issues: [] }, forkedFrom: { routineId: assignment.routineId },
      createdAt: '2026-07-20T09:00:00.000Z', updatedAt: '2026-07-20T09:30:00.000Z',
    };
    const publish = vi.fn().mockResolvedValue(undefined);

    act(() => root.render(<RoutinesScreen state={state} onAssignRoutine={vi.fn()} onListRoutineDrafts={vi.fn().mockResolvedValue([draft])} onPublishRoutineDraft={publish} t={(key) => translate('en', key)} />));
    await act(async () => {
      document.body.querySelector<HTMLButtonElement>('.routines-add-dock-button')?.click();
      await Promise.resolve();
    });
    await act(async () => {
      Array.from(document.body.querySelectorAll<HTMLButtonElement>('.routine-catalog-tabs button')).find((button) => button.textContent === 'Private drafts')?.click();
      await Promise.resolve();
    });
    act(() => Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'View')?.click());
    act(() => Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Review publication')?.click());

    expect(publish).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Name, description or responsible person');
    expect(document.body.textContent).toContain('Gemini validation criteria');
    await act(async () => {
      Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Confirm publication')?.click();
      await Promise.resolve();
    });
    expect(publish).toHaveBeenCalledWith('participant-1', 'fork-1', 3);
  });

  it('reviews and explicitly applies a published assignment version', async () => {
    const assignment = createDefaultRoutineAssignment('2026-07-20T08:00:00.000Z');
    const state: AppState = {
      role: 'parent', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      participantAccess: [{ participant: { id: 'participant-1', displayName: 'Maya' }, membership: { role: 'owner', status: 'active' } }],
      activeParticipantId: 'participant-1', routineAssignments: [assignment], events: [], routinesLoaded: true, routinesError: false,
    };
    const nextRoutine = structuredClone(assignment.routine);
    nextRoutine.name = 'Updated elastics';
    nextRoutine.analysis = { ...nextRoutine.analysis!, detectedCriteria: 'Updated visual criteria' };
    const published: PublishedRoutineVersion & { routineId: string } = {
      ownerId: 'owner-1', authorName: 'Alex Martin', origin: 'private', sourceDraftId: 'fork-1', sourceRevision: 3, version: 1,
      package: { schemaVersion: 1, version: 1, defaultLocale: 'en', availableLocales: ['en'], routine: nextRoutine },
      publishedAt: '2026-07-20T10:00:00.000Z', routineId: assignment.routineId,
    };
    const upgrade = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    act(() => root.render(<RoutinesScreen state={state} onAssignRoutine={vi.fn()} onListRoutineDrafts={vi.fn().mockResolvedValue([])} onListPublishedRoutineVersions={vi.fn().mockResolvedValue([published])} onUpgradeRoutineAssignment={upgrade} t={(key) => translate('en', key)} />));
    await act(async () => {
      document.body.querySelector<HTMLButtonElement>('.routines-add-dock-button')?.click();
      await Promise.resolve();
    });
    await act(async () => {
      Array.from(document.body.querySelectorAll<HTMLButtonElement>('.routine-catalog-tabs button')).find((button) => button.textContent === 'Private drafts')?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 50));
    });

    expect(document.body.textContent).toContain('Current version 0 → version 1');
    expect(document.body.textContent).toContain('Gemini validation criteria will change');
    expect(document.body.textContent).toContain('Built-in version currently applied');
    act(() => document.body.querySelector<HTMLButtonElement>('button[aria-label="Show version history"]')?.click());
    expect(document.body.textContent).toContain('Alex Martin');
    expect(document.body.textContent).toContain('Private version');
    await act(async () => {
      Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Apply version 1')?.click();
      await Promise.resolve();
    });
    expect(upgrade).toHaveBeenCalledWith('participant-1', assignment.routineId, 1);
  });

  it('keeps built-in and assigned routines visible when private drafts fail', async () => {
    const assignment = createDefaultRoutineAssignment('2026-07-02T08:00:00.000Z');
    const state: AppState = {
      role: 'parent', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      participantAccess: [{ participant: { id: 'participant-1', displayName: 'Maya' }, membership: { role: 'owner', status: 'active' } }],
      activeParticipantId: 'participant-1', routineAssignments: [assignment], events: [], routinesLoaded: true, routinesError: false,
    };
    act(() => {
      root.render(<RoutinesScreen state={state} onAssignRoutine={async () => undefined} onListRoutineDrafts={vi.fn().mockRejectedValue(new Error('offline'))} t={(key) => translate('en', key)} />);
    });
    await act(async () => {
      document.body.querySelector<HTMLButtonElement>('.routines-add-dock-button')?.click();
      await Promise.resolve();
    });
    await act(async () => {
      Array.from(document.body.querySelectorAll<HTMLButtonElement>('.routine-catalog-tabs button')).find((button) => button.textContent === 'Private drafts')?.click();
      await Promise.resolve();
    });
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('Private drafts could not be loaded');
    expect(container.textContent).toContain('Orthodontic Elastics');
    act(() => Array.from(document.body.querySelectorAll<HTMLButtonElement>('.routine-catalog-tabs button')).find((button) => button.textContent === 'Built-in routines')?.click());
    expect(document.body.textContent).toContain('Hydration');
  });

  it('does not request private drafts offline and keeps built-ins available', async () => {
    const listDrafts = vi.fn();
    const state: AppState = {
      role: 'parent', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      participantAccess: [{ participant: { id: 'participant-1', displayName: 'Maya' }, membership: { role: 'owner', status: 'active' } }],
      activeParticipantId: 'participant-1', routineAssignments: [], events: [], routinesLoaded: true, routinesError: false,
    };
    await act(async () => {
      root.render(<RoutinesScreen state={state} online={false} onAssignRoutine={async () => undefined} onListRoutineDrafts={listDrafts} t={(key) => translate('en', key)} />);
      await Promise.resolve();
    });
    await act(async () => {
      Array.from(document.body.querySelectorAll<HTMLButtonElement>('.routine-catalog-tabs button')).find((button) => button.textContent === 'Private drafts')?.click();
      await Promise.resolve();
    });
    expect(listDrafts).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Private drafts are unavailable offline');
    act(() => Array.from(document.body.querySelectorAll<HTMLButtonElement>('.routine-catalog-tabs button')).find((button) => button.textContent === 'Built-in routines')?.click());
    expect(document.body.textContent).toContain('Hydration');
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
    expect(container.querySelector('.history-detail-dialog dl')).not.toBeNull();
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Hide information"]')?.getAttribute('aria-expanded')).toBe('true');
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

  it('opens a home history event directly in routine tracking details', async () => {
    await import('./RoutineDetailScreen');
    const assignment = createDefaultRoutineAssignment('2026-07-02T08:00:00.000Z');
    const historyEvent = {
      id: 'history-focus',
      routineId: assignment.routineId,
      sessionId: 'history-session',
      requestedAt: '2026-07-02T10:00:00.000Z',
      capturedAt: '2026-07-02T10:10:00.000Z',
      expiresAt: '2026-07-02T11:00:00.000Z',
      status: 'detected' as const,
      reason: 'Validated from home',
    };
    const state: AppState = {
      role: 'parent', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment], events: [historyEvent], routinesLoaded: true, routinesError: false,
    };
    const consumed = vi.fn();

    await act(async () => {
      root.render(<RoutinesScreen state={state} focusedEventId={historyEvent.id} onFocusedEventConsumed={consumed} t={(key) => translate('en', key)} />);
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    });

    expect(container.querySelector('.routine-tabs button[aria-current="page"]')?.textContent).toBe('Tracking');
    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Show all information"]')?.click());
    expect(container.querySelector('.history-detail-dialog')?.textContent).toContain('Validated from home');
    expect(consumed).toHaveBeenCalledOnce();
  });

  it('lets a responsible validate an uncertain check from its detail dialog', async () => {
    await import('./RoutineDetailScreen');
    const assignment = createDefaultRoutineAssignment('2026-07-02T08:00:00.000Z');
    const historyEvent = {
      id: 'history-review',
      routineId: assignment.routineId,
      sessionId: 'history-session',
      requestedAt: '2026-07-02T10:00:00.000Z',
      capturedAt: '2026-07-02T10:10:00.000Z',
      expiresAt: '2026-07-02T11:00:00.000Z',
      status: 'uncertain' as const,
      reviewStatus: 'pending' as const,
      proofImagePath: 'families/family/checks/history-review/proof.jpg',
    };
    const state: AppState = {
      role: 'parent', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment], events: [historyEvent], routinesLoaded: true, routinesError: false,
    };
    const reviewCheck = vi.fn().mockResolvedValue(undefined);
    let resolveProof!: (url: string) => void;
    const getProofImageUrl = vi.fn(() => new Promise<string>((resolve) => { resolveProof = resolve; }));

    await act(async () => {
      root.render(<RoutinesScreen state={state} edit focusedEventId={historyEvent.id} getProofImageUrl={getProofImageUrl} reviewCheck={reviewCheck} t={(key) => translate('en', key)} />);
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    });

    const dialog = container.querySelector('.history-detail-dialog');
    const proof = dialog?.querySelector('.history-detail-proof');
    const actions = dialog?.querySelector('.history-detail-review-actions');
    expect(proof?.nextElementSibling).toBe(actions);
    expect(proof?.querySelector('[role="status"]')?.textContent).toContain('Loading photo');
    expect(proof?.querySelector('.button-spinner')).not.toBeNull();
    expect(actions?.querySelector('button[aria-label="Validate"]')).not.toBeNull();
    expect(dialog?.querySelector('button[aria-label="Reject"]')).not.toBeNull();

    await act(async () => {
      resolveProof('data:image/png;base64,PROOF');
      await Promise.resolve();
    });
    expect(proof?.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,PROOF');

    await act(async () => {
      dialog?.querySelector<HTMLButtonElement>('button[aria-label="Validate"]')?.click();
      await Promise.resolve();
    });

    expect(reviewCheck).toHaveBeenCalledWith(historyEvent.id, 'detected');
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

    const addButton = document.body.querySelector('.routines-add-dock-button');
    act(() => addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(document.body.textContent).toContain('Choose a routine');
    expect(document.body.textContent).toContain('Hydration');
    expect(document.body.textContent).toContain('Dental care');
    expect(document.body.textContent).toContain('Proof example: Mouth photo');
    expect(Array.from(document.body.querySelectorAll('.routine-catalog-add')).some((button) => button.textContent === 'Added')).toBe(true);

    const hydrationButton = Array.from(document.body.querySelectorAll('.routine-catalog-item'))
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

  it('discovers, resolves and installs catalogue routine snapshots', async () => {
    vi.useFakeTimers();
    const routine = { ...createDefaultRoutineAssignment().routine, id: 'community-hydration', name: 'Community hydration', description: 'Shared hydration guidance' };
    const entry: RoutineCatalogEntry = {
      id: 'catalog-entry', routineId: routine.id, authorName: 'Alex Martin', visibility: 'listed', version: 3,
      package: { schemaVersion: 1, version: 3, defaultLocale: 'en', availableLocales: ['en', 'fr'], routine },
      publishedAt: '2026-07-15T08:00:00.000Z', sharedAt: '2026-07-16T08:00:00.000Z',
    };
    const state: AppState = {
      role: 'parent', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      participantAccess: [{ participant: { id: 'participant-1', displayName: 'Maya' }, membership: { role: 'owner', status: 'active' } }],
      activeParticipantId: 'participant-1', routineAssignments: [], events: [], routinesLoaded: true, routinesError: false,
    };
    const search = vi.fn().mockResolvedValue([entry]);
    const resolve = vi.fn().mockResolvedValue({ ...entry, visibility: 'unlisted' });
    const install = vi.fn().mockResolvedValue(undefined);
    act(() => root.render(<RoutinesScreen state={state} onAssignRoutine={async () => undefined} onSearchRoutineCatalog={search} onResolveSharedRoutine={resolve} onInstallCatalogRoutine={install} t={(key) => translate('en', key)} />));

    await act(async () => {
      Array.from(document.body.querySelectorAll<HTMLButtonElement>('.routine-catalog-tabs button')).find((button) => button.textContent === 'Community routines')?.click();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(250);
      await Promise.resolve();
    });
    expect(document.body.textContent).toContain('Alex Martin · v3 · EN, FR');
    expect(document.body.textContent).toContain('Community hydration');

    const codeInput = document.body.querySelector<HTMLInputElement>('input[aria-label="Private share code"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(codeInput, 'private-code');
      codeInput.dispatchEvent(new Event('input', { bubbles: true }));
      Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Open')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(resolve).toHaveBeenCalledWith('private-code');

    await act(async () => {
      Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent === 'Install')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(install).toHaveBeenCalledWith('participant-1', 'catalog-entry', 'private-code');
  });
});
