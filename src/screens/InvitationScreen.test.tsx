import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translate } from '../services/i18n';
import { InvitationScreen } from './InvitationScreen';

describe('InvitationScreen', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('confirms the invitation carried by the link', async () => {
    const accept = vi.fn().mockResolvedValue(undefined);
    act(() => root.render(<InvitationScreen code="ZI-123456" accountNameRequired={false} accept={accept} saveAccountName={vi.fn()} cancel={vi.fn()} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('ZI-123456');
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.includes('Accept invitation'));
    await act(async () => button?.click());

    expect(accept).toHaveBeenCalledOnce();
  });

  it('collects a missing account name after acceptance', async () => {
    const saveAccountName = vi.fn().mockResolvedValue(undefined);
    act(() => root.render(<InvitationScreen code="ZI-123456" accountNameRequired accept={vi.fn()} saveAccountName={saveAccountName} cancel={vi.fn()} t={(key) => translate('en', key)} />));

    const input = container.querySelector('input') as HTMLInputElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'Idriss');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => input.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

    expect(saveAccountName).toHaveBeenCalledWith('Idriss');
  });
});
