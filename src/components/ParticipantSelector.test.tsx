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
    ]} activeParticipantId="alex" label="Followed person" onSelect={onSelect} />));
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.text)).toEqual(['Alex', 'Sam']);
    select.value = 'sam';
    act(() => select.dispatchEvent(new Event('change', { bubbles: true })));
    expect(onSelect).toHaveBeenCalledWith('sam');
  });

  it('stays hidden for a single participant', () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(<ParticipantSelector access={[
      { participant: { id: 'alex', displayName: 'Alex' }, membership: { role: 'owner', status: 'active' } },
    ]} activeParticipantId="alex" label="Followed person" onSelect={vi.fn()} />));
    expect(container.innerHTML).toBe('');
  });
});

