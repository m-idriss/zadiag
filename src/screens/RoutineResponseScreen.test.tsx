import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VerificationEvent } from '../domain/models';
import { translate } from '../services/i18n';
import { RoutineResponseScreen } from './RoutineResponseScreen';

const eventWith = (response: NonNullable<VerificationEvent['challenge']>['response']) => ({
  id: 'check-1', routineId: 'routine-1', sessionId: 'session-1', requestedAt: '2026-07-21T08:00:00.000Z', expiresAt: '2026-07-21T10:00:00.000Z', status: 'pending' as const,
  challenge: { routineId: 'routine-1', name: 'Morning routine', instructions: 'Complete the routine', response },
});

describe('structured routine response screen', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('stores an honest no response without presenting it as an error', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const event = eventWith({ kind: 'confirmation', prompt: 'Did you take it?' });
    act(() => root.render(<RoutineResponseScreen event={event} submit={submit} back={() => undefined} done={() => undefined} t={(key) => translate('en', key)} />));
    const save = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Save my response');
    expect(save?.disabled).toBe(true);
    act(() => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'No')?.click());
    expect(save?.disabled).toBe(false);
    await act(async () => { save?.click(); await Promise.resolve(); });
    expect(submit).toHaveBeenCalledWith({ kind: 'confirmation', value: false });
    expect(container.textContent).toContain('Response saved');
  });

  it('requires every checklist item and preserves each boolean', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    const event = eventWith({ kind: 'checklist', prompt: 'Taken?', items: [{ id: 'a', label: 'Medicine A' }, { id: 'b', label: 'Medicine B' }] });
    act(() => root.render(<RoutineResponseScreen event={event} submit={submit} back={() => undefined} done={() => undefined} t={(key) => translate('en', key)} />));
    const groups = container.querySelectorAll('.routine-response-question');
    const save = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Save my response');
    act(() => groups[0]?.querySelectorAll('button')[0]?.click());
    expect(save?.disabled).toBe(true);
    act(() => groups[1]?.querySelectorAll('button')[1]?.click());
    expect(save?.disabled).toBe(false);
    await act(async () => { save?.click(); await Promise.resolve(); });
    expect(submit).toHaveBeenCalledWith({ kind: 'checklist', items: [{ id: 'a', value: true }, { id: 'b', value: false }] });
  });
});
