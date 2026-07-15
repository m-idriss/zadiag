import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRoutineAssignment, createRoutineAssignment, type AppState } from '../domain/models';
import { routineFromCatalog } from '../domain/routineCatalog';
import { translate } from '../services/i18n';
import { ParentDashboard } from './ParentDashboard';

describe('ParentDashboard', () => {
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
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const selectDashboardStatus = (label: string) => {
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>('.dashboard-status-summary button'))
      .find((item) => item.textContent?.includes(label));
    act(() => button?.click());
  };

  it('keeps the parent overview blocks and replaces needs attention with filterable history', () => {
    const requestedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();
    const assignment = createDefaultRoutineAssignment(requestedAt);
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: false, childName: 'Maya', linkingCode: 'ZD-123456', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment],
      events: [
        { id: 'event', routineId: assignment.routineId, sessionId: 'one', requestedAt, expiresAt, status: 'detected' },
      ],
    };

    act(() => root.render(<ParentDashboard state={state} regenerateCode={vi.fn()} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('Active checks');
    expect(container.textContent).toContain('Finish setting up Zadiag');
    const setupSteps = Array.from(container.querySelectorAll('.parent-onboarding-card .setup-progress li'));
    expect(setupSteps.map((step) => step.textContent?.replace(/\d/g, ''))).toEqual(['Create', 'Link', 'Routine']);
    expect(setupSteps[0]?.classList.contains('complete')).toBe(true);
    expect(setupSteps[1]?.classList.contains('active')).toBe(true);
    expect(container.textContent).toContain('Participant phone not linked');
    expect(container.textContent).toContain('Participant linking code');
    expect(container.textContent).toContain('Recent history');
    expect(container.textContent).toContain('Status');
    expect(container.textContent).not.toContain('StatusAll');
    expect(container.textContent).not.toContain('Monitoring plan');
    expect(container.textContent).not.toContain('Needs attention');
    const detailedReport = container.querySelector<HTMLDetailsElement>('.detailed-reporting');
    expect(detailedReport?.open).toBe(false);
    expect(detailedReport?.querySelector('summary')?.textContent).toBe('Detailed report');
    const reportButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Download PDF'));
    const csvReportButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Download CSV'));
    expect(detailedReport?.contains(reportButton ?? null)).toBe(true);
    expect(detailedReport?.contains(csvReportButton ?? null)).toBe(true);
    expect(reportButton?.disabled).toBe(false);
    expect(csvReportButton?.disabled).toBe(false);
    expect(container.querySelector('.printable-report')).toBeNull();
  });

  it('opens history details over the dashboard without navigating to routines', () => {
    const requestedAt = new Date().toISOString();
    const assignment = createDefaultRoutineAssignment(requestedAt);
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment],
      events: [{ id: 'dashboard-detail', routineId: assignment.routineId, sessionId: 'one', requestedAt, expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(), status: 'detected', reason: 'Visible from dashboard' }],
    };

    act(() => root.render(<ParentDashboard state={state} regenerateCode={vi.fn()} t={(key) => translate('en', key)} />));
    const openDetails = container.querySelector<HTMLButtonElement>('.history-row-open-button');
    act(() => openDetails?.click());

    expect(container.querySelector('.history-detail-dialog')?.textContent).toContain('Visible from dashboard');
    expect(container.querySelector('.parent-overview-screen')).not.toBeNull();
    expect(container.querySelector('.screen-header h1')?.textContent).toBe('Activity');
  });

  it('shows upcoming checks when no responsible check is active', () => {
    const assignment = createDefaultRoutineAssignment();
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment],
      events: [],
    };

    act(() => root.render(<ParentDashboard state={state} regenerateCode={vi.fn()} t={(key) => translate('en', key)} />));

    expect(container.textContent).not.toContain('Upcoming checks');
    selectDashboardStatus('Next');
    expect(container.textContent).toContain('Upcoming checks');
    expect(container.textContent).not.toContain('Finish setting up Zadiag');
    expect(container.textContent).toContain('Orthodontic Elastics');
    expect(container.textContent).not.toContain('Active checks');
    expect(container.textContent).not.toContain('No active check yet');
    const reportButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Download PDF'));
    expect(reportButton?.disabled).toBe(true);
    expect(container.textContent).toContain('Complete a check in this period to create a report.');
    expect(container.querySelector('.printable-report')).toBeNull();
  });

  it('combines routine and status filter push buttons without all buttons', () => {
    const hydration = routineFromCatalog('daily-hydration');
    if (!hydration) throw new Error('missing_hydration_routine');
    const elastics = createDefaultRoutineAssignment();
    const hydrationAssignment = createRoutineAssignment(hydration);
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60_000).toISOString();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60_000).toISOString();
    const inThirtyMinutes = new Date(now.getTime() + 30 * 60_000).toISOString();
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [elastics, hydrationAssignment],
      events: [
        {
          id: 'elastics-ok',
          routineId: elastics.routineId,
          sessionId: 'one',
          requestedAt: oneHourAgo,
          expiresAt: inThirtyMinutes,
          capturedAt: thirtyMinutesAgo,
          status: 'detected',
        },
        {
          id: 'hydration-missed',
          routineId: hydrationAssignment.routineId,
          sessionId: 'two',
          requestedAt: thirtyMinutesAgo,
          expiresAt: inThirtyMinutes,
          status: 'missed',
        },
      ],
    };

    // This scenario may cross midnight, so include both calendar days.
    act(() => root.render(<ParentDashboard state={state} regenerateCode={vi.fn()} summaryRange="twoDays" t={(key) => translate('en', key)} />));

    expect(Array.from(container.querySelectorAll('.filter-chips button')).some((button) => button.textContent === 'All')).toBe(false);
    expect(container.querySelectorAll('.parent-history-row')).toHaveLength(2);

    const elasticsButton = Array.from(container.querySelectorAll('.filter-chips button')).find((button) => button.textContent === 'Orthodontic Elastics');
    const hydrationButton = Array.from(container.querySelectorAll('.filter-chips button')).find((button) => button.textContent === 'Hydration');
    const missedButton = Array.from(container.querySelectorAll('.filter-chips button')).find((button) => button.textContent === 'Missed');
    const validatedButton = Array.from(container.querySelectorAll('.filter-chips button')).find((button) => button.textContent === 'Validated');

    expect(elasticsButton?.getAttribute('aria-pressed')).toBe('true');
    expect(hydrationButton?.getAttribute('aria-pressed')).toBe('true');
    expect(missedButton?.getAttribute('aria-pressed')).toBe('true');
    expect(validatedButton?.getAttribute('aria-pressed')).toBe('true');

    act(() => hydrationButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => missedButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(elasticsButton?.getAttribute('aria-pressed')).toBe('true');
    expect(hydrationButton?.getAttribute('aria-pressed')).toBe('false');
    expect(missedButton?.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelectorAll('.parent-history-row')).toHaveLength(1);

    act(() => missedButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => validatedButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(missedButton?.getAttribute('aria-pressed')).toBe('true');
    expect(validatedButton?.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelectorAll('.parent-history-row')).toHaveLength(0);

    act(() => root.render(<div />));
    act(() => root.render(<ParentDashboard state={state} regenerateCode={vi.fn()} summaryRange="twoDays" t={(key) => translate('en', key)} />));

    const restoredHydrationButton = Array.from(container.querySelectorAll('.filter-chips button')).find((button) => button.textContent === 'Hydration');
    const restoredMissedButton = Array.from(container.querySelectorAll('.filter-chips button')).find((button) => button.textContent === 'Missed');
    const restoredValidatedButton = Array.from(container.querySelectorAll('.filter-chips button')).find((button) => button.textContent === 'Validated');
    expect(restoredHydrationButton?.getAttribute('aria-pressed')).toBe('false');
    expect(restoredMissedButton?.getAttribute('aria-pressed')).toBe('true');
    expect(restoredValidatedButton?.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelectorAll('.parent-history-row')).toHaveLength(0);
  });

  it('shows a first routine creation block when no routine exists', () => {
    const openRoutines = vi.fn();
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [],
      events: [],
    };

    act(() => root.render(<ParentDashboard state={state} regenerateCode={vi.fn()} onCreateRoutine={openRoutines} t={(key) => translate('en', key)} />));

    expect(container.textContent).not.toContain('Create the first routine');
    expect(container.textContent).toContain('No routine assigned');
    expect(container.querySelectorAll('.responsible-state-card')).toHaveLength(1);
    expect(container.textContent).toContain('No history yet');
    expect(container.textContent).not.toContain('StatusAll');
    act(() => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Choose a routine')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(openRoutines).toHaveBeenCalled();
  });

  it('hides the participant linking code once the participant is linked', () => {
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: 'ZD-123456', parentRecoveryCode: '', consented: true },
      routineAssignments: [createDefaultRoutineAssignment()],
      events: [],
    };

    act(() => root.render(<ParentDashboard state={state} regenerateCode={vi.fn()} t={(key) => translate('en', key)} />));

    expect(container.textContent).not.toContain('Participant linking code');
    expect(container.textContent).not.toContain('ZD-123456');
  });

  it('distinguishes upcoming checks from an active check to complete', () => {
    const assignment = createDefaultRoutineAssignment();
    const baseState: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment],
      events: [],
    };

    act(() => root.render(<ParentDashboard state={baseState} regenerateCode={vi.fn()} t={(key) => translate('en', key)} />));

    expect(container.textContent).not.toContain('Upcoming checks');
    selectDashboardStatus('Next');
    expect(container.textContent).toContain('Upcoming checks');
    expect(container.textContent).not.toContain('Active checks');

    act(() => root.render(
      <ParentDashboard
        state={{
          ...baseState,
          events: [{
            id: 'pending',
            routineId: assignment.routineId,
            sessionId: 'one',
            requestedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
            status: 'pending',
          }],
        }}
        regenerateCode={vi.fn()}
        requestCheck={vi.fn()}
        t={(key) => translate('en', key)}
      />,
    ));

    selectDashboardStatus('Active');
    expect(container.textContent).toContain('1 check to complete');
    expect(container.textContent).toContain('Orthodontic Elastics');
    expect(container.textContent).toContain('Expected proof: Mouth photo');
    expect(container.textContent).toContain('Remind');
    expect(container.textContent).not.toContain('Waiting for participant proof');
  });

  it('lets the responsible person resend active pending checks from current checks', async () => {
    const assignment = createDefaultRoutineAssignment();
    const requestCheck = vi.fn().mockResolvedValue(undefined);
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment],
      events: [{
        id: 'pending',
        routineId: assignment.routineId,
        sessionId: 'one',
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
        status: 'pending',
      }],
    };

    act(() => root.render(<ParentDashboard state={state} regenerateCode={vi.fn()} requestCheck={requestCheck} t={(key) => translate('en', key)} />));

    selectDashboardStatus('Active');
    const resend = Array.from(container.querySelectorAll('button')).find((button) => button.getAttribute('aria-label') === 'Resend reminder');
    expect(resend).toBeTruthy();
    expect(resend?.textContent).toContain('Remind');

    await act(async () => {
      resend?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(requestCheck).toHaveBeenCalledWith(assignment.routineId);
    expect(container.textContent).toContain('The check is ready on the participant’s phone.');
  });

  it('shows only the latest active check when a relance left duplicate pending checks for one routine', () => {
    const assignment = createDefaultRoutineAssignment();
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment],
      events: [
        {
          id: 'older-pending',
          routineId: assignment.routineId,
          sessionId: 'one',
          requestedAt: new Date(Date.now() - 3 * 60_000).toISOString(),
          expiresAt: new Date(Date.now() + 90 * 60_000).toISOString(),
          status: 'pending',
        },
        {
          id: 'relanced-pending',
          routineId: assignment.routineId,
          sessionId: 'two',
          requestedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 90 * 60_000).toISOString(),
          status: 'pending',
        },
      ],
    };

    act(() => root.render(<ParentDashboard state={state} regenerateCode={vi.fn()} requestCheck={vi.fn()} t={(key) => translate('en', key)} />));

    selectDashboardStatus('Active');
    expect(container.textContent).toContain('1 check to complete');
    expect(container.querySelectorAll('.parent-active-check-card')).toHaveLength(1);
    expect(container.querySelectorAll('.parent-history-row')).toHaveLength(1);
  });

  it('shows expired pending checks as missed in recent history', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-07T08:04:00.000Z'));
    const assignment = createDefaultRoutineAssignment();
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment],
      events: [{
        id: 'expired-pending',
        routineId: assignment.routineId,
        sessionId: 'one',
        requestedAt: '2026-07-07T05:30:00.000Z',
        expiresAt: '2026-07-07T06:16:00.000Z',
        status: 'pending',
      }],
    };

    act(() => root.render(<ParentDashboard state={state} regenerateCode={vi.fn()} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('Missed');
    expect(container.textContent).toContain('Expired before proof was sent');
    expect(container.textContent).not.toContain('Pending');
    vi.useRealTimers();
  });

  it('explains pending checks whose routine is no longer assigned', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-07T08:04:00.000Z'));
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [],
      events: [{
        id: 'orphaned-pending',
        routineId: 'deleted-routine',
        sessionId: 'one',
        requestedAt: '2026-07-07T07:30:00.000Z',
        expiresAt: '2026-07-07T08:30:00.000Z',
        status: 'pending',
      }],
    };

    act(() => root.render(<ParentDashboard state={state} regenerateCode={vi.fn()} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('Routine no longer assigned');
    vi.useRealTimers();
  });

  it('lets the responsible person resend the latest missed check for each routine from history', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-07T12:45:00.000Z'));
    const assignment = createDefaultRoutineAssignment();
    const requestCheck = vi.fn().mockResolvedValue(undefined);
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment],
      events: [
        {
          id: 'latest-missed',
          routineId: assignment.routineId,
          sessionId: 'two',
          requestedAt: '2026-07-07T10:31:00.000Z',
          expiresAt: '2026-07-07T10:45:00.000Z',
          status: 'pending',
        },
        {
          id: 'older-missed',
          routineId: assignment.routineId,
          sessionId: 'one',
          requestedAt: '2026-07-07T08:30:00.000Z',
          expiresAt: '2026-07-07T08:45:00.000Z',
          status: 'pending',
        },
      ],
    };

    act(() => root.render(<ParentDashboard state={state} regenerateCode={vi.fn()} requestCheck={requestCheck} t={(key) => translate('en', key)} />));

    const resendButtons = Array.from(container.querySelectorAll('button')).filter((button) => button.getAttribute('aria-label') === 'Resend reminder');
    expect(resendButtons).toHaveLength(1);

    await act(async () => {
      resendButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(requestCheck).toHaveBeenCalledWith(assignment.routineId);
    expect(Array.from(container.querySelectorAll('button')).filter((button) => button.getAttribute('aria-label') === 'Resend reminder')).toHaveLength(0);
    vi.useRealTimers();
  });

  it('hides resend actions for older missed checks after a newer check succeeds', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-07T12:45:00.000Z'));
    const assignment = createDefaultRoutineAssignment();
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment],
      events: [
        {
          id: 'successful-relance',
          routineId: assignment.routineId,
          sessionId: 'two',
          requestedAt: '2026-07-07T10:50:00.000Z',
          expiresAt: '2026-07-07T11:30:00.000Z',
          capturedAt: '2026-07-07T11:02:00.000Z',
          status: 'detected',
        },
        {
          id: 'older-missed',
          routineId: assignment.routineId,
          sessionId: 'one',
          requestedAt: '2026-07-07T10:31:00.000Z',
          expiresAt: '2026-07-07T10:45:00.000Z',
          status: 'pending',
        },
      ],
    };

    act(() => root.render(<ParentDashboard state={state} regenerateCode={vi.fn()} requestCheck={vi.fn()} t={(key) => translate('en', key)} />));

    const resendButtons = Array.from(container.querySelectorAll('button')).filter((button) => button.getAttribute('aria-label') === 'Resend reminder');
    expect(resendButtons).toHaveLength(0);
    vi.useRealTimers();
  });

  it('lets the responsible person review an uncertain proof', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15, 15, 0));
    const assignment = createDefaultRoutineAssignment();
    const getProofImageUrl = vi.fn().mockResolvedValue('data:image/png;base64,TEST');
    const reviewCheck = vi.fn().mockResolvedValue(undefined);
    const notificationConsumed = vi.fn();
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment],
      events: [{
        id: 'review',
        routineId: assignment.routineId,
        sessionId: 'one',
        requestedAt: '2026-07-02T08:00:00.000Z',
        expiresAt: '2026-07-02T09:00:00.000Z',
        capturedAt: '2026-07-02T08:04:00.000Z',
        status: 'uncertain',
        analysisSource: 'ai',
        automatedStatus: 'not_detected',
        confidence: 0.67,
        imageQuality: 0.82,
        proofImagePath: 'families/family/checks/review/proof.jpg',
        reviewStatus: 'pending',
        reason: 'The proof is unclear.',
      }],
    };

    await act(async () => {
      root.render(
        <ParentDashboard
          state={state}
          regenerateCode={vi.fn()}
          getProofImageUrl={getProofImageUrl}
          reviewCheck={reviewCheck}
          notificationEventId="review"
          onNotificationEventConsumed={notificationConsumed}
          t={(key) => translate('en', key)}
        />,
      );
      await Promise.resolve();
    });

    expect(container.querySelector('.dashboard-status-summary button[aria-pressed="true"]')?.textContent).toContain('To review');
    expect(notificationConsumed).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('Checks to verify');
    expect(Array.from(container.querySelectorAll('.dashboard-status-summary strong')).map((item) => item.textContent)).toEqual(['0', '1', '1']);
    const reviewSection = container.querySelector('.parent-review-section');
    expect(reviewSection).not.toBeNull();
    expect(container.querySelector('.upcoming-checks-section')).toBeNull();
    expect(container.textContent).toContain('Expected proof: Mouth photo');
    expect(container.textContent).toContain('Source: AI');
    expect(container.textContent).toContain('AI result: Not detected');
    expect(container.textContent).toContain('Confidence 67%');
    expect(container.textContent).toContain('Estimated quality 82%');
    expect(getProofImageUrl).toHaveBeenCalledWith('review');
    vi.useRealTimers();
    const validate = Array.from(container.querySelectorAll('button')).find((button) => button.getAttribute('aria-label') === 'Validate');

    await act(async () => {
      validate?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(reviewCheck).toHaveBeenCalledWith('review', 'detected');
  });

  it('tries to recover proof images for legacy uncertain checks without proof metadata', async () => {
    const assignment = createDefaultRoutineAssignment();
    const getProofImageUrl = vi.fn().mockResolvedValue('data:image/png;base64,RESTORED');
    const reviewCheck = vi.fn().mockResolvedValue(undefined);
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment],
      events: [{
        id: 'legacy-review',
        routineId: assignment.routineId,
        sessionId: 'one',
        requestedAt: '2026-07-02T08:00:00.000Z',
        expiresAt: '2026-07-02T09:00:00.000Z',
        capturedAt: '2026-07-02T08:04:00.000Z',
        status: 'uncertain',
        reason: 'The proof is unclear.',
      }],
    };

    await act(async () => {
      root.render(
        <ParentDashboard
          state={state}
          regenerateCode={vi.fn()}
          getProofImageUrl={getProofImageUrl}
          reviewCheck={reviewCheck}
          t={(key) => translate('en', key)}
        />,
      );
      await Promise.resolve();
    });

    selectDashboardStatus('To review');
    expect(container.textContent).toContain('Checks to verify');
    expect(getProofImageUrl).toHaveBeenCalledWith('legacy-review');
    const reject = Array.from(container.querySelectorAll('button')).find((button) => button.getAttribute('aria-label') === 'Reject');

    await act(async () => {
      reject?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(reviewCheck).toHaveBeenCalledWith('legacy-review', 'not_detected');
  });

  it('reviews a proof with a horizontal swipe on the review block', async () => {
    const assignment = createDefaultRoutineAssignment();
    const reviewCheck = vi.fn().mockResolvedValue(undefined);
    const state: AppState = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment],
      events: [
        {
          id: 'swipe-approve',
          routineId: assignment.routineId,
          sessionId: 'one',
          requestedAt: '2026-07-02T08:00:00.000Z',
          expiresAt: '2026-07-02T09:00:00.000Z',
          capturedAt: '2026-07-02T08:04:00.000Z',
          status: 'uncertain',
          reviewStatus: 'pending',
        },
        {
          id: 'swipe-reject',
          routineId: assignment.routineId,
          sessionId: 'two',
          requestedAt: '2026-07-02T07:00:00.000Z',
          expiresAt: '2026-07-02T08:00:00.000Z',
          capturedAt: '2026-07-02T07:04:00.000Z',
          status: 'uncertain',
          reviewStatus: 'pending',
        },
      ],
    };
    act(() => {
      root.render(
        <ParentDashboard
          state={state}
          regenerateCode={vi.fn()}
          reviewCheck={reviewCheck}
          t={(key) => translate('en', key)}
        />,
      );
    });

    selectDashboardStatus('To review');
    const cards = Array.from(container.querySelectorAll<HTMLElement>('.parent-review-card'));
    await act(async () => {
      cards[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 20, clientY: 24 }));
      cards[0].dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 112, clientY: 28 }));
      cards[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 112, clientY: 28 }));
      cards[1].dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 20, clientY: 24 }));
      await Promise.resolve();
    });

    expect(reviewCheck).toHaveBeenCalledWith('swipe-approve', 'detected');
    expect(reviewCheck).toHaveBeenCalledWith('swipe-reject', 'not_detected');
  });
});
