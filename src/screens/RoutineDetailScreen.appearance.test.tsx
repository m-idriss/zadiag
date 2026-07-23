import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRoutineAssignment, type AppState } from '../domain/models';
import { translate } from '../services/i18n';
import { routineIconCatalog } from '../components/routineIconCatalog';
import { RoutineDetailScreen } from './RoutineDetailScreen';

describe('routine appearance editor', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

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
    expect(container.querySelector('.routine-appearance-top-editor')).not.toBeNull();
    const pickerTrigger = container.querySelector<HTMLButtonElement>('.routine-icon-picker-trigger');
    expect(pickerTrigger).not.toBeNull();
    await act(async () => {
      pickerTrigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(document.body.querySelectorAll('.routine-icon-catalog button')).toHaveLength(routineIconCatalog.length);

    const search = document.body.querySelector<HTMLInputElement>('.routine-icon-search input');
    act(() => {
      if (search) {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(search, 'dent');
        search.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    expect(document.body.querySelectorAll('.routine-icon-catalog button')).toHaveLength(1);
    act(() => document.body.querySelector<HTMLButtonElement>('.routine-icon-catalog button')?.click());

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.routine-appearance-actions .primary-action-button')?.click();
      await Promise.resolve();
    });

    expect(saveAppearance).toHaveBeenCalledOnce();
    expect(container.querySelector('.routine-appearance-editor')).toBeNull();
  });
});
