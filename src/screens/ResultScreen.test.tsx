import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VerificationEvent } from '../domain/models';
import { translate } from '../services/i18n';
import { ResultScreen } from './ResultScreen';

const event = (status: VerificationEvent['status']): VerificationEvent => ({
  id: 'check-1',
  routineId: 'orthodontic-elastics',
  sessionId: 'session-1',
  requestedAt: '2026-07-04T10:00:00.000Z',
  expiresAt: '2026-07-04T10:20:00.000Z',
  capturedAt: '2026-07-04T10:03:00.000Z',
  status,
});

describe('ResultScreen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-04T10:05:00.000Z'));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('offers to retake proof when a non-positive result can be retried', () => {
    const retake = vi.fn();
    const done = vi.fn();
    act(() => root.render(<ResultScreen event={event('not_detected')} retake={retake} done={done} t={(key) => translate('en', key)} />));

    const retakeButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Retake proof');
    expect(retakeButton).not.toBeUndefined();
    act(() => retakeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(retake).toHaveBeenCalled();

    const sendAsIsButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Send as is');
    expect(sendAsIsButton).not.toBeUndefined();
    expect(container.textContent).toContain('expected proof is clearly visible');
    act(() => sendAsIsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(done).toHaveBeenCalled();
  });

  it('does not show a retake action on successful results', () => {
    act(() => root.render(<ResultScreen event={event('detected')} done={() => undefined} t={(key) => translate('en', key)} />));

    expect(container.textContent).not.toContain('Retake proof');
    expect(container.textContent).toContain('Back to today');
    expect(container.textContent).not.toContain('Send as is');
    expect(container.textContent).not.toContain('expected proof is clearly visible');
  });
});
