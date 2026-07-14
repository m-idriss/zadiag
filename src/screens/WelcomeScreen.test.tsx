import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translate } from '../services/i18n';
import { WelcomeScreen } from './WelcomeScreen';

describe('WelcomeScreen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('explains that role selection applies to this device', () => {
    act(() => root.render(
      <WelcomeScreen
        locale="en"
        setLocale={vi.fn()}
        chooseRole={vi.fn()}
        t={(key) => translate('en', key)}
      />,
    ));

    expect(container.textContent).toContain('Choose how this device will be used');
    expect(container.textContent).toContain('Shared routines, clearer days');
    expect(container.querySelector('.brand-mark img')?.getAttribute('src')).toBe('/icons/icon.svg');
    expect(container.querySelectorAll('.brand-mark-dots i')).toHaveLength(3);
    expect(container.textContent).toContain('Manage routines, link the participant phone');
    expect(container.textContent).toContain('Receive proof requests, send checks');
    expect(container.textContent).toContain('without changing the role on another phone');
  });
});
