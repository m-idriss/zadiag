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

  it('lists relationships and creates a self-managed participant', async () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const create = vi.fn().mockResolvedValue('jordan');
    act(() => root?.render(<RelationshipManager
      access={[{ participant: { id: 'alex', displayName: 'Alex' }, membership: { role: 'owner', status: 'active' } }]}
      activeParticipantId="alex"
      onCreate={create}
      t={(key) => translate('en', key)}
    />));
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
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === 'Generate invitation')!;
    await act(async () => button.click());
    expect(invite).toHaveBeenCalledWith('alex', 'caregiver');
    expect(container.textContent).toContain('ZI-654321');
  });
});
