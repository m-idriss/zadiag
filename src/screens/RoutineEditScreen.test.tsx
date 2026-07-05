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
      />,
    ));

    const addSlot = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add slot'));
    const addPeriod = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Add period'));

    expect(addSlot).toBeInstanceOf(HTMLButtonElement);
    expect(addPeriod).toBeInstanceOf(HTMLButtonElement);
    expect((addSlot as HTMLButtonElement).disabled).toBe(true);
    expect((addPeriod as HTMLButtonElement).disabled).toBe(true);
  });
});
