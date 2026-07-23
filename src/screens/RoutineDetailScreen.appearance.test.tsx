import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRoutineAssignment, type AppState } from '../domain/models';
import { translate } from '../services/i18n';
import { RoutineDetailScreen } from './RoutineDetailScreen';

describe('routine appearance editor', () => {
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

  it('opens from the top routine block and is absent from the information content by default', async () => {
    const assignment = createDefaultRoutineAssignment();
    const state = {
      role: 'parent',
      locale: 'en',
      notificationsEnabled: true,
      family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
      routineAssignments: [assignment],
      events: [],
    } satisfies AppState;
    const saveAppearance = vi.fn().mockResolvedValue(undefined);

    act(() => root.render(<RoutineDetailScreen assignment={assignment} state={state} back={() => undefined} edit onSaveAppearance={saveAppearance} t={(key) => translate('en', key)} />));

    expect(container.querySelector('.routine-appearance-editor')).toBeNull();
    const trigger = container.querySelector<HTMLButtonElement>('.routine-appearance-trigger');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    act(() => trigger?.click());

    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelectorAll('.routine-icon-options button')).toHaveLength(16);
    expect(container.querySelector('.routine-appearance-top-editor')).not.toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.routine-appearance-actions .primary-action-button')?.click();
      await Promise.resolve();
    });

    expect(saveAppearance).toHaveBeenCalledOnce();
    expect(container.querySelector('.routine-appearance-editor')).toBeNull();
  });
});
