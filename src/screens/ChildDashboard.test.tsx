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

    expect(container.textContent).toContain("Today's tasks1");
    expect(container.textContent).toContain('Completed today1');
    expect(container.textContent).not.toContain('This week');
    expect(container.querySelectorAll('.today-task')).toHaveLength(2);

    const complete = Array.from(container.querySelectorAll('ion-button')).find((button) => button.textContent?.includes('Complete'));
    act(() => complete?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(start).toHaveBeenCalledOnce();
  });
});
