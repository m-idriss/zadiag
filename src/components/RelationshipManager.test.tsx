import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translate } from '../services/i18n';
import { RelationshipManager } from './RelationshipManager';

describe('RelationshipManager', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
  });

  const expandManager = () => {
    const toggle = container?.querySelector('.relationship-manager-toggle') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    act(() => toggle.click());
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  };

  it('lists relationships and creates a self-managed participant', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const create = vi.fn().mockResolvedValue('jordan');
    const invite = vi.fn().mockResolvedValue({ code: 'ZI-123456', expiresAt: new Date().toISOString() });
    act(() => root?.render(<RelationshipManager
      access={[{ participant: { id: 'alex', displayName: 'Alex' }, membership: { role: 'owner', status: 'active' } }]}
      activeParticipantId="alex"
      onCreate={create}
      onInvite={invite}
      t={(key) => translate('en', key)}
    />));
    expect(container.querySelector('input[aria-label="Name"]')).toBeNull();
    expandManager();
    expect(container.querySelector('.relationship-access-list')).not.toBeNull();
    const name = container.querySelector('input[aria-label="Name"]') as HTMLInputElement;
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(name, 'Jordan');
      name.dispatchEvent(new Event('input', { bubbles: true }));
      checkbox.click();
    });
    const form = name.closest('form')!;
    await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(container.textContent).toContain('Alex');
    expect(create).toHaveBeenCalledWith('Jordan', true);
    expect(invite).not.toHaveBeenCalled();
  });

  it('creates an access code immediately for a new participant profile', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const create = vi.fn().mockResolvedValue('yoan');
    const invite = vi.fn().mockResolvedValue({ code: 'ZI-123456', expiresAt: new Date().toISOString() });
    act(() => root?.render(<RelationshipManager
      access={[]}
      onCreate={create}
      onInvite={invite}
      t={(key) => translate('en', key)}
    />));
    expandManager();
    const name = container.querySelector('input[aria-label="Name"]') as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(name, 'Yoan');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => name.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(create).toHaveBeenCalledWith('Yoan', false);
    expect(invite).toHaveBeenCalledWith('yoan', 'participant');
    expect(container.textContent).toContain('ZI-123456');
  });

  it('generates a scoped caregiver invitation', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const invite = vi.fn().mockResolvedValue({ code: 'ZI-654321', expiresAt: new Date().toISOString() });
    act(() => root?.render(<RelationshipManager
      access={[{ participant: { id: 'alex', displayName: 'Alex' }, membership: { role: 'owner', status: 'active' } }]}
      activeParticipantId="alex"
      onInvite={invite}
      t={(key) => translate('en', key)}
    />));
    expandManager();
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'Generate access code')!;
    await act(async () => button.click());
    expect(invite).toHaveBeenCalledWith('alex', 'caregiver');
    expect(container.textContent).toContain('ZI-654321');
  });

  it('targets the visible participant when a stale legacy id is still active', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const invite = vi.fn().mockResolvedValue({ code: 'ZI-654321', expiresAt: new Date().toISOString() });
    act(() => root?.render(<RelationshipManager
      access={[{ participant: { id: 'alex', displayName: 'Alex' }, membership: { role: 'owner', status: 'active' } }]}
      activeParticipantId="legacy-family"
      onInvite={invite}
      t={(key) => translate('en', key)}
    />));
    expandManager();
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'Generate access code')!;
    await act(async () => button.click());
    expect(invite).toHaveBeenCalledWith('alex', 'caregiver');
  });

  it('generates a scoped recovery code', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const createRecovery = vi.fn().mockResolvedValue({ recoveryCode: 'PR-2345-6789-ABCD', expiresAt: new Date().toISOString() });
    act(() => root?.render(<RelationshipManager
      access={[{ participant: { id: 'alex', displayName: 'Alex' }, membership: { role: 'owner', status: 'active' } }]}
      activeParticipantId="alex"
      onCreateRecovery={createRecovery}
      t={(key) => translate('en', key)}
    />));
    expandManager();
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'Generate recovery code')!;
    await act(async () => button.click());
    expect(createRecovery).toHaveBeenCalledWith('alex');
    expect(container.textContent).toContain('PR-2345-6789-ABCD');
  });

  it('leaves a secondary relationship and closes the manager', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const leave = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    act(() => root?.render(<RelationshipManager
      access={[{ participant: { id: 'alex', displayName: 'Alex' }, membership: { role: 'caregiver', status: 'active' } }]}
      activeParticipantId="alex"
      onLeave={leave}
      t={(key) => translate('en', key)}
    />));
    expandManager();
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'Remove my access to this profile') as HTMLButtonElement;
    await act(async () => button.click());
    expect(leave).toHaveBeenCalledWith('alex');
    expect((container.querySelector('.relationship-manager-toggle') as HTMLButtonElement).getAttribute('aria-expanded')).toBe('false');
  });

  it('lets an owner remove an assistant without leaving the profile', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const removeMember = vi.fn().mockResolvedValue([]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    act(() => root?.render(<RelationshipManager
      access={[{
        participant: { id: 'alex', displayName: 'Alex' },
        membership: { role: 'owner', status: 'active' },
        members: [
          { uid: 'owner', role: 'owner', status: 'active', isCurrentUser: true },
          { uid: 'assistant', role: 'caregiver', status: 'active' },
        ],
      }]}
      activeParticipantId="alex"
      onRemoveMember={removeMember}
      t={(key) => translate('en', key)}
    />));
    expandManager();
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'Remove') as HTMLButtonElement;
    await act(async () => button.click());
    expect(removeMember).toHaveBeenCalledWith('alex', 'assistant');
  });

  it('replaces the impossible last-owner exit with profile deletion', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const leave = vi.fn();
    const deleteParticipant = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    act(() => root?.render(<RelationshipManager
      access={[{
        participant: { id: 'alex', displayName: 'Alex' },
        membership: { role: 'owner', status: 'active' },
        members: [{ uid: 'owner', role: 'owner', status: 'active', isCurrentUser: true }],
      }]}
      activeParticipantId="alex"
      onLeave={leave}
      onDeleteParticipant={deleteParticipant}
      t={(key) => translate('en', key)}
    />));
    expandManager();
    expect(container.textContent).not.toContain('Remove my access to this profile');
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'Delete this profile permanently') as HTMLButtonElement;
    await act(async () => button.click());
    expect(leave).not.toHaveBeenCalled();
    expect(deleteParticipant).toHaveBeenCalledWith('alex');
  });
});
