import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { DisclosureToggle } from './DisclosureToggle';

describe('DisclosureToggle', () => {
  it('exposes the current state and action to assistive technology', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onToggle = vi.fn();
    act(() => root.render(<DisclosureToggle expanded={false} showLabel="Show" hideLabel="Hide" onToggle={onToggle} />));
    const button = container.querySelector('button');

    expect(button?.getAttribute('aria-expanded')).toBe('false');
    expect(button?.getAttribute('aria-label')).toBe('Show');
    act(() => button?.click());
    expect(onToggle).toHaveBeenCalledOnce();

    act(() => root.render(<DisclosureToggle expanded showLabel="Show" hideLabel="Hide" onToggle={onToggle} />));
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(button?.getAttribute('aria-label')).toBe('Hide');
    expect(container.querySelector('.app-icon')?.classList.contains('expanded')).toBe(true);
    act(() => root.unmount());
  });
});
