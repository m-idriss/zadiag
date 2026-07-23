import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { SplashScreen } from './SplashScreen';

describe('splash screen', () => {
  it('shows the running application version', () => {
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => root.render(<SplashScreen progress={50} message="Loading…" />));

    expect(container.querySelector('.app-splash-version')?.textContent).toBe(`v${import.meta.env.VITE_APP_VERSION}`);
    act(() => root.unmount());
  });
});
