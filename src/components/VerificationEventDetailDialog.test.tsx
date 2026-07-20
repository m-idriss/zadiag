import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { VerificationEvent } from '../domain/models';
import { translate } from '../services/i18n';
import { VerificationEventDetailDialog } from './VerificationEventDetailDialog';

const reviewedEvent: VerificationEvent = {
  id: 'reviewed',
  routineId: 'routine',
  sessionId: 'session',
  requestedAt: '2026-07-20T12:03:00.000Z',
  capturedAt: '2026-07-20T12:17:00.000Z',
  expiresAt: '2026-07-20T14:00:00.000Z',
  status: 'detected',
  reviewStatus: 'approved',
  reviewedAt: '2026-07-20T12:18:00.000Z',
  reviewReason: 'responsible_review',
};

describe('VerificationEventDetailDialog', () => {
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

  it('opens reviewed information by default without exposing its legacy system marker', () => {
    act(() => root.render(<VerificationEventDetailDialog event={reviewedEvent} locale="en" onClose={() => undefined} t={(key) => translate('en', key)} />));

    expect(container.querySelector('dl')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Hide information"]')?.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).not.toContain('responsible_review');
    expect(container.textContent).not.toContain('Review comment');
  });

  it('keeps information collapsed while a check is still waiting for review', () => {
    act(() => root.render(<VerificationEventDetailDialog event={{ ...reviewedEvent, status: 'uncertain', reviewStatus: 'pending', reviewedAt: undefined, reviewReason: undefined }} locale="en" onClose={() => undefined} t={(key) => translate('en', key)} />));

    expect(container.querySelector('dl')).toBeNull();
    expect(container.querySelector('button[aria-label="Show all information"]')?.getAttribute('aria-expanded')).toBe('false');
  });
});
