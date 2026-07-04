import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRoutineAssignment, createRoutineAssignment, type AppState, type VerificationEvent } from '../domain/models';
import { routineFromCatalog } from '../domain/routineCatalog';
import { translate } from '../services/i18n';
import { ChildDashboard } from './ChildDashboard';

const atToday = (hours: number) => {
  const date = new Date();
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
};

const event = (id: string, status: VerificationEvent['status'], requestedAt: string, expiresAt = atToday(20)): VerificationEvent => ({
  id,
  routineId: 'orthodontic-elastics',
  sessionId: `session-${id}`,
  requestedAt,
  expiresAt,
  capturedAt: status === 'detected' ? atToday(8) : undefined,
  status,
});

const routineEvent = (
  id: string,
  routineId: string,
  status: VerificationEvent['status'],
  requestedAt: string,
  expiresAt = atToday(20),
): VerificationEvent => ({
  ...event(id, status, requestedAt, expiresAt),
  routineId,
});

describe('participant Today screen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => root.unmount());
    container.remove();
  });

  it('shows only today pending and completed tasks with an action for the active task', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pending = event('pending', 'pending', atToday(18));
    const state: AppState = {
      role: 'child',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: false },
      routineAssignments: [createDefaultRoutineAssignment()],
      events: [pending, event('completed', 'detected', atToday(8)), event('old', 'missed', yesterday.toISOString())],
    };
    const start = vi.fn();

    act(() => root.render(<ChildDashboard state={state} active={pending} start={start} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('1 check to complete');
    expect(container.textContent).toContain('Completed today1');
    expect(container.textContent).not.toContain('This week');
    expect(container.querySelectorAll('.today-task')).toHaveLength(2);

    const complete = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Send proof'));
    act(() => complete?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(start).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledWith(pending);
  });

  it('lets the participant send proof for any currently available routine', () => {
    const hydration = routineFromCatalog('daily-hydration');
    if (!hydration) throw new Error('missing_hydration_routine');
    const elasticsPending = routineEvent('elastics-pending', 'orthodontic-elastics', 'pending', atToday(13), atToday(16));
    const hydrationPending = routineEvent('hydration-pending', 'daily-hydration', 'pending', atToday(13), atToday(16));
    const state: AppState = {
      role: 'child',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: false },
      routineAssignments: [createDefaultRoutineAssignment(), createRoutineAssignment(hydration)],
      events: [elasticsPending, hydrationPending],
    };
    const start = vi.fn();

    act(() => root.render(<ChildDashboard state={state} active={elasticsPending} start={start} t={(key) => translate('en', key)} />));

    const actions = Array.from(container.querySelectorAll('button')).filter((button) => button.textContent?.includes('Send proof'));
    expect(actions).toHaveLength(2);
    act(() => actions[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(start).toHaveBeenCalledWith(hydrationPending);
  });

  it('keeps task state correct after synchronization and reload reconstruction', () => {
    const pending = event('task', 'pending', atToday(9));
    const base: AppState = {
      role: 'child', locale: 'en', notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: false },
      routineAssignments: [createDefaultRoutineAssignment()], events: [pending],
    };

    act(() => root.render(<ChildDashboard state={base} active={pending} start={() => undefined} t={(key) => translate('en', key)} />));
    expect(container.textContent).toContain('1 check to complete');

    const analyzing = { ...pending, status: 'analyzing' as const };
    act(() => root.render(<ChildDashboard state={{ ...base, events: [analyzing] }} start={() => undefined} t={(key) => translate('en', key)} />));
    expect(container.textContent).toContain('Checking the photo');

    const reloadedState = structuredClone({
      ...base,
      events: [
        { ...pending, status: 'detected' as const, capturedAt: atToday(9) },
        event('missed', 'missed', atToday(12)),
        event('expired', 'expired', atToday(15)),
      ],
    });
    act(() => root.render(<ChildDashboard state={reloadedState} start={() => undefined} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('0 checks to complete');
    expect(container.textContent).toContain('Completed today3');
    expect(container.textContent).toContain('Missed');
    expect(container.textContent).toContain('Expired');
  });

  it('labels morning checks without calling them evening', () => {
    vi.useFakeTimers();
    const now = new Date();
    now.setHours(4, 30, 0, 0);
    vi.setSystemTime(now);
    const pending = event('pending', 'pending', atToday(4), atToday(5));
    const state: AppState = {
      role: 'child',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: false },
      routineAssignments: [createDefaultRoutineAssignment()],
      events: [pending],
    };

    act(() => root.render(<ChildDashboard state={state} active={pending} start={() => undefined} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('This morning');
    expect(container.textContent).not.toContain('This evening');
    vi.useRealTimers();
  });

  it('shows completed checks before expired pending checks when no action is available', () => {
    const expiredPending = event('expired-pending', 'pending', atToday(8), atToday(9));
    const state: AppState = {
      role: 'child',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: false },
      routineAssignments: [createDefaultRoutineAssignment()],
      events: [expiredPending, event('completed', 'detected', atToday(10))],
    };

    act(() => root.render(<ChildDashboard state={state} start={() => undefined} t={(key) => translate('en', key)} />));

    const content = container.textContent ?? '';
    expect(content).toContain('0 checks to complete');
    expect(content.indexOf('Completed today1')).toBeLessThan(content.indexOf('Recent history'));
    expect(content.indexOf('Validated')).toBeLessThan(content.indexOf('Expired'));
  });
});
