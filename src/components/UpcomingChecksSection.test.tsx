import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultRoutineAssignment } from '../domain/models';
import { presentedUpcomingRoutineChecks } from '../domain/dashboardChecks';
import { translate } from '../services/i18n';
import { UpcomingChecksSection } from './UpcomingChecksSection';

describe('UpcomingChecksSection', () => {
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
    vi.restoreAllMocks();
  });

  it('offers immediate, one-off, and recurring actions from an accessible menu', async () => {
    const assignment = createDefaultRoutineAssignment();
    const now = new Date('2026-08-03T05:00:00.000Z');
    const checks = presentedUpcomingRoutineChecks([assignment], 'en', now);
    const request = vi.fn().mockResolvedValue(undefined);
    const skip = vi.fn().mockResolvedValue(undefined);
    const edit = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await act(async () => root.render(<UpcomingChecksSection checks={checks} now={now} locale="en" titleId="upcoming" onRequest={request} onSkip={skip} onEditPlan={edit} t={(key) => translate('en', key)} />));
    const trigger = container.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]')!;
    const actions = trigger.closest<HTMLElement>('.upcoming-check-actions')!;
    vi.spyOn(actions, 'getBoundingClientRect').mockReturnValue({ top: 700, bottom: 736 } as DOMRect);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await act(async () => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(actions.classList.contains('open-up')).toBe(true);
    expect(container.querySelectorAll('[role="menuitem"]')).toHaveLength(3);
    const skipButton = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find((button) => button.textContent?.includes('Skip this occurrence'))!;
    await act(async () => skipButton.click());
    expect(skip).toHaveBeenCalledWith(assignment.routineId, checks[0].planned.start, checks[0].planned.end);
    expect(window.confirm).toHaveBeenCalled();
  });
});
