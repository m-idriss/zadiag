import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonitoringPlan } from '../domain/models';
import { translate } from '../services/i18n';
import { RoutineEditScreen } from './RoutineEditScreen';

const planWithWindows = (count: number): MonitoringPlan => ({
  checksPerDay: count,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  windows: Array.from({ length: count }, (_, index) => ({
    id: `g1_w${index + 1}`,
    start: '09:00',
    end: '17:00',
  })),
  scheduleGroups: [{
    id: 'g1',
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    windows: Array.from({ length: count }, (_, index) => ({
      id: `w${index + 1}`,
      start: '09:00',
      end: '17:00',
    })),
  }],
  expiryMinutes: 20,
  timeZone: 'Europe/Paris',
});

describe('RoutineEditScreen', () => {
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

  it('blocks adding more slots than the server accepts', () => {
    act(() => root.render(
      <RoutineEditScreen
        plan={planWithWindows(12)}
        routineId="daily-hydration"
        onSave={vi.fn()}
        onCancel={vi.fn()}
        busy={false}
        embedded
        t={(key) => translate('en', key)}
      />
    ));

    const addSlot = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add slot'));
    const addPeriod = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add period'));

    expect(addSlot).toBeInstanceOf(HTMLButtonElement);
    expect(addPeriod).toBeInstanceOf(HTMLButtonElement);
    expect((addSlot as HTMLButtonElement).disabled).toBe(true);
    expect((addPeriod as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves legacy plans with required backend fields restored', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const legacyPlan = {
      checksPerDay: 1,
      weekdays: [1],
      windows: [{ id: 'morning', start: '07:30', end: '09:30' }],
    } as MonitoringPlan;

    act(() => root.render(
      <RoutineEditScreen
        plan={legacyPlan}
        routineId="daily-hydration"
        onSave={save}
        onCancel={vi.fn()}
        busy={false}
        embedded
        t={(key) => translate('en', key)}
      />
    ));

    const addSlot = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add slot'));

    act(() => addSlot?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save');
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toMatchObject({
      expiryMinutes: 0,
      windows: [
        { id: 'g1_morning', start: '07:30', end: '09:30' },
        { id: 'g1_w2', start: '09:00', end: '17:00' },
      ],
      scheduleGroups: [{
        id: 'g1',
        weekdays: [1],
        windows: [
          { id: 'morning', start: '07:30', end: '09:30' },
          { id: 'w2', start: '09:00', end: '17:00' },
        ],
      }],
    });
    expect(save.mock.calls[0][0].timeZone).toBeTruthy();
  });

  it('lets legacy 20 minute response windows be saved as the full slot', async () => {
    const save = vi.fn().mockResolvedValue(undefined);

    act(() => root.render(
      <RoutineEditScreen
        plan={planWithWindows(1)}
        routineId="daily-hydration"
        onSave={save}
        onCancel={vi.fn()}
        busy={false}
        embedded
        t={(key) => translate('en', key)}
      />
    ));

    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save') as HTMLButtonElement | undefined;
    expect(saveButton?.disabled).toBe(false);

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].expiryMinutes).toBe(0);
  });

  it('saves response window changes', async () => {
    const save = vi.fn().mockResolvedValue(undefined);

    act(() => root.render(
      <RoutineEditScreen
        plan={planWithWindows(1)}
        routineId="daily-hydration"
        onSave={save}
        onCancel={vi.fn()}
        busy={false}
        embedded
        t={(key) => translate('en', key)}
      />
    ));

    const sixtyMinutes = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === '60m');
    act(() => sixtyMinutes?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save');

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].expiryMinutes).toBe(60);
  });

  it('saves full active window as response window', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    act(() => root.render((
      <RoutineEditScreen
        plan={{ ...planWithWindows(1), expiryMinutes: 60 }}
        routineId="daily-hydration"
        onSave={save}
        onCancel={vi.fn()}
        busy={false}
        embedded
        t={(key) => translate('en', key)}
      />
    )));

    const fullWindow = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Full window');
    act(() => fullWindow?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save');

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].expiryMinutes).toBe(0);
  });
});
