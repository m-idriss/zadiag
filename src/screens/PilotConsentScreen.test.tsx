import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../services/i18n';
import { PilotConsentScreen } from './PilotConsentScreen';

describe('PilotConsentScreen', () => {
  const renderScreen = (decide: (status: 'accepted' | 'declined') => Promise<void>, role: 'parent' | 'child' = 'parent') => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<PilotConsentScreen role={role} decide={decide} t={createTranslator('en')} />));
    return { container, root };
  };

  it('records an explicit optional choice', async () => {
    const decide = vi.fn().mockResolvedValue(undefined);
    const { container, root } = renderScreen(decide);

    expect(container.textContent).toContain('No photo, name, email, routine content, AI comment or medical information.');
    const decline = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Continue without participating');
    await act(async () => { decline?.click(); });

    expect(decide).toHaveBeenCalledWith('declined');
    act(() => root.unmount());
  });

  it('can opt into the pilot', async () => {
    const decide = vi.fn().mockResolvedValue(undefined);
    const { container, root } = renderScreen(decide, 'child');

    const accept = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Join the pilot');
    await act(async () => { accept?.click(); });

    expect(decide).toHaveBeenCalledWith('accepted');
    act(() => root.unmount());
  });
});
