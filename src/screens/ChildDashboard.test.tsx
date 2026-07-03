import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRoutineAssignment, type AppState, type VerificationEvent } from '../domain/models';
import { translate } from '../services/i18n';
import { ChildDashboard } from './ChildDashboard';

const atToday = (hours: number) => {
  const date = new Date();
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
};

const event = (id: string, status: VerificationEvent['status'], requestedAt: string): VerificationEvent => ({
  id,
  routineId: 'orthodontic-elastics',
  sessionId: `session-${id}`,
  requestedAt,
  expiresAt: atToday(20),
  capturedAt: status === 'detected' ? atToday(8) : undefined,
  status,
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

    const complete = Array.from(container.querySelectorAll('ion-button')).find((button) => button.textContent?.includes('Send proof'));
    act(() => complete?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(start).toHaveBeenCalledOnce();
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
});
