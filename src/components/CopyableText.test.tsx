import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { translate } from '../services/i18n';
import { CopyableText } from './CopyableText';

describe('CopyableText', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
    else Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('copies the complete displayed value and confirms the action', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<CopyableText value="ZI-862051" t={(key) => translate('en', key)} />));

    const button = container.querySelector('button') as HTMLButtonElement;
    await act(async () => button.click());

    expect(writeText).toHaveBeenCalledWith('ZI-862051');
    expect(button.getAttribute('aria-label')).toBe('Copied');
    expect(button.textContent).toBe('');
    expect(container.querySelector('strong')?.textContent).toBe('ZI-862051');
  });
});
