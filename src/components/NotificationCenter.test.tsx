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

  it('shows the bell without a badge when there are no notifications', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => root.render(
      <NotificationCenter
        role="child"
        sources={[]}
        locale="en"
        contextId="maya"
        onOpenEvent={vi.fn()}
        t={(key) => translate('en', key)}
      />,
    ));

    expect(container.querySelector('.notification-center-trigger > .app-icon')).not.toBeNull();
    expect(container.querySelector('.notification-center-badge')).toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('clears the unread badge when the notification center is opened', () => {
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
        sources={[{
          participant: { id: 'maya', displayName: 'Maya' },
          role: 'child',
          events: [ready],
          assignments: [createDefaultRoutineAssignment()],
        }]}
        locale="en"
        contextId="maya"
        onOpenEvent={onOpenEvent}
        t={(key) => translate('en', key)}
      />,
    ));

    const trigger = container.querySelector<HTMLButtonElement>('.notification-center-trigger');
    expect(trigger?.textContent).toBe('1');
    expect(trigger?.querySelector('.notification-center-badge')?.textContent).toBe('1');
    act(() => trigger?.click());
    expect(container.textContent).toContain('Check ready');
    expect(container.querySelector('.notification-center-trigger')?.textContent).toBe('');
    expect(localStorage.getItem('zadiag.notificationCenter.read.child.maya')).toBe('["maya:check_ready:ready"]');
    const notification = container.querySelector<HTMLButtonElement>('.notification-center-list > button');
    act(() => notification?.click());

    expect(onOpenEvent).toHaveBeenCalledWith('maya', ready);

    act(() => root.unmount());
    container.remove();
  });

  it('shows notifications from every profile and identifies their participant', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const now = Date.now();
    const eventFor = (id: string): VerificationEvent => ({
      id,
      routineId: 'orthodontic-elastics',
      sessionId: `session-${id}`,
      requestedAt: new Date(now - 60_000).toISOString(),
      expiresAt: new Date(now + 60 * 60_000).toISOString(),
      status: 'pending',
    });
    const mayaEvent = eventFor('maya-ready');
    const leoEvent = eventFor('leo-ready');
    const onOpenEvent = vi.fn();

    act(() => root.render(
      <NotificationCenter
        role="child"
        sources={[
          { participant: { id: 'maya', displayName: 'Maya' }, role: 'child', events: [mayaEvent], assignments: [createDefaultRoutineAssignment()] },
          { participant: { id: 'leo', displayName: 'Léo Martin' }, role: 'child', events: [leoEvent], assignments: [createDefaultRoutineAssignment()] },
        ]}
        locale="fr"
        contextId="account"
        onOpenEvent={onOpenEvent}
        t={(key) => translate('fr', key)}
      />,
    ));

    act(() => container.querySelector<HTMLButtonElement>('.notification-center-trigger')?.click());
    expect(Array.from(container.querySelectorAll('.notification-center-profile')).map((item) => item.textContent)).toEqual(['MA', 'LM']);
    expect(container.textContent).toContain('Maya');
    expect(container.textContent).toContain('Léo Martin');
    act(() => container.querySelectorAll<HTMLButtonElement>('.notification-center-list > button')[1]?.click());
    expect(onOpenEvent).toHaveBeenCalledWith('leo', leoEvent);

    act(() => root.unmount());
    container.remove();
  });
});
