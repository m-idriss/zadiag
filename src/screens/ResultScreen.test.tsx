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
  proofImagePath: status === 'uncertain' ? 'participants/profile/checks/check-1/proof.jpg' : undefined,
});

const checklistEvent = (status: 'detected' | 'not_detected' | 'uncertain'): VerificationEvent => ({
  ...event(status),
  reviewStatus: status === 'uncertain' ? 'pending' : undefined,
  challenge: {
    routineId: 'orthodontic-elastics',
    name: 'Visual setup',
    instructions: 'Show the setup.',
    response: {
      kind: 'photo_checklist',
      prompt: 'Show both items.',
      criteria: [
        { id: 'required', label: 'Required elastic', criterion: 'The elastic is visible.', required: true },
        { id: 'optional', label: 'Storage case', criterion: 'The case is visible.', required: false },
      ],
    },
  },
  photoChecklistItems: [
    { criterionId: 'required', status, confidence: 0.8, reason: 'Result.', decision: { source: 'ai' } },
    { criterionId: 'optional', status: 'detected', confidence: 0.9, reason: 'Visible.', decision: { source: 'ai' } },
  ],
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

  it('explains temporary proof access when a responsible review is required', () => {
    act(() => root.render(<ResultScreen event={event('uncertain')} retake={() => undefined} done={() => undefined} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('temporarily available to authorized responsible people');
    expect(container.textContent).toContain('deleted after their decision');
  });

  it('explains every checklist item and the derived successful result without model details', () => {
    act(() => root.render(<ResultScreen event={{ ...checklistEvent('detected'), analysisSource: 'ai', analysisModel: 'gemini-internal' }} done={() => undefined} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('Everything is clearly visible');
    expect(container.textContent).toContain('Required elastic');
    expect(container.textContent).toContain('Clearly visible');
    expect(container.querySelector('[aria-label="Required elastic: Clearly visible"]')).not.toBeNull();
    expect(container.textContent).not.toContain('gemini-internal');
    expect(container.textContent).not.toContain('Source:');
  });

  it('gives calm next actions for missing and uncertain checklist results', () => {
    act(() => root.render(<ResultScreen event={checklistEvent('not_detected')} retake={() => undefined} done={() => undefined} t={(key) => translate('en', key)} />));
    expect(container.textContent).toContain('Some items need another photo');
    expect(container.textContent).toContain('Required elasticNot clearly visible');
    expect(container.textContent).toContain('Retake proof');

    act(() => root.render(<ResultScreen event={checklistEvent('uncertain')} retake={() => undefined} done={() => undefined} t={(key) => translate('fr', key)} />));
    expect(container.textContent).toContain('Un responsable va vérifier');
    expect(container.textContent).toContain('Required elasticÀ vérifier par un responsable');
  });
});
