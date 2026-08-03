import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParticipantSelector } from './ParticipantSelector';

describe('ParticipantSelector', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
  });

  it('shows active participants and selects another one', () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const onSelect = vi.fn();
    act(() => root?.render(<ParticipantSelector access={[
      { participant: { id: 'alex', displayName: 'Alex' }, membership: { role: 'owner', status: 'active' } },
      { participant: { id: 'sam', displayName: 'Sam' }, membership: { role: 'caregiver', status: 'active' } },
      { participant: { id: 'hidden', displayName: 'Hidden' }, membership: { role: 'caregiver', status: 'suspended' } },
    ]} activeParticipantId="alex" label="Followed person" title="Following Alex" actionLabel="Switch" onSelect={onSelect} />));
    const summary = container.querySelector('summary') as HTMLElement;
    expect(summary.getAttribute('aria-label')).toBe('Switch : Alex');
    expect(summary.textContent).not.toContain('Switch');
    const buttons = Array.from(container.querySelectorAll('.participant-switcher-menu button')) as HTMLButtonElement[];
    expect(buttons.map((button) => button.querySelectorAll('span')[1]?.textContent)).toEqual(['Alex', 'Sam']);
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    const sam = buttons[1];
    act(() => sam.click());
    expect(onSelect).toHaveBeenCalledWith('sam');
  });

  it('shows the followed person for a single participant', () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(<ParticipantSelector access={[
      { participant: { id: 'alex', displayName: 'Alex' }, membership: { role: 'owner', status: 'active' } },
    ]} activeParticipantId="alex" label="Followed person" onSelect={vi.fn()} />));
    expect(container.textContent).toBe('Followed person Alex');
  });

  it('selects an overview without invalidating the active participant', () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const onSelectOverview = vi.fn();
    act(() => root?.render(<ParticipantSelector access={[
      { participant: { id: 'alex', displayName: 'Alex' }, membership: { role: 'owner', status: 'active' } },
      { participant: { id: 'sam', displayName: 'Sam' }, membership: { role: 'caregiver', status: 'active' } },
    ]} activeParticipantId="alex" label="Followed person" overviewLabel="All participants" onSelect={vi.fn()} onSelectOverview={onSelectOverview} />));

    const overview = container.querySelector<HTMLButtonElement>('.participant-switcher-menu button');
    act(() => overview?.click());
    expect(onSelectOverview).toHaveBeenCalledOnce();
    expect(overview?.getAttribute('aria-pressed')).toBe('false');
  });

  it('applies a non-empty participant subset from the overview menu', () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const onApplyParticipantSelection = vi.fn();
    act(() => root?.render(<ParticipantSelector access={[
      { participant: { id: 'alex', displayName: 'Alex' }, membership: { role: 'owner', status: 'active' } },
      { participant: { id: 'sam', displayName: 'Sam' }, membership: { role: 'caregiver', status: 'active' } },
    ]} activeParticipantId="alex" label="Followed person" overviewLabel="All participants" overviewSelected selectedParticipantIds={['alex', 'sam']} applyLabel="Apply" onSelect={vi.fn()} onApplyParticipantSelection={onApplyParticipantSelection} />));

    const options = Array.from(container.querySelectorAll<HTMLButtonElement>('.participant-switcher-menu > button'));
    act(() => options.find((button) => button.textContent?.includes('Sam'))?.click());
    act(() => options.find((button) => button.textContent?.includes('Alex'))?.click());
    expect(options.find((button) => button.textContent?.includes('Alex'))?.getAttribute('aria-pressed')).toBe('true');
    act(() => container.querySelector<HTMLButtonElement>('.participant-switcher-apply')?.click());

    expect(onApplyParticipantSelection).toHaveBeenCalledWith(['alex']);
  });
});
