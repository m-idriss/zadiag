import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRoutineAssignment, type VerificationEvent } from '../domain/models';
import { translate } from '../services/i18n';
import { NotificationCenter } from './NotificationCenter';

describe('NotificationCenter', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('persists read state per profile after opening the relevant event', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const now = Date.now();
    const ready: VerificationEvent = {
      id: 'ready',
      routineId: 'orthodontic-elastics',
      sessionId: 'session-ready',
      requestedAt: new Date(now - 60_000).toISOString(),
      expiresAt: new Date(now + 60 * 60_000).toISOString(),
      status: 'pending',
    };
    const onOpenEvent = vi.fn();

    act(() => root.render(
      <NotificationCenter
        role="child"
        events={[ready]}
        assignments={[createDefaultRoutineAssignment()]}
        locale="en"
        contextId="maya"
        onOpenEvent={onOpenEvent}
        t={(key) => translate('en', key)}
      />,
    ));

    const trigger = container.querySelector<HTMLButtonElement>('.notification-center-trigger');
    expect(trigger?.textContent).toBe('1');
    act(() => trigger?.click());
    expect(container.textContent).toContain('Check ready');
    const notification = container.querySelector<HTMLButtonElement>('.notification-center-list > button');
    act(() => notification?.click());

    expect(onOpenEvent).toHaveBeenCalledWith(ready);
    expect(container.querySelector('.notification-center-trigger')?.textContent).toBe('');
    expect(localStorage.getItem('zadiag.notificationCenter.read.child.maya')).toBe('["check_ready:ready"]');

    act(() => root.unmount());
    container.remove();
  });
});
