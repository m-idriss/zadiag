import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { translate } from '../services/i18n';
import { CameraScreen } from './CameraScreen';
import type { VerificationEvent } from '../domain/models';

const checklistEvent: VerificationEvent = {
  id: 'checklist-check',
  routineId: 'routine',
  sessionId: 'session',
  requestedAt: '2026-07-23T10:00:00.000Z',
  expiresAt: '2026-07-23T10:20:00.000Z',
  status: 'pending',
  challenge: {
    routineId: 'routine',
    name: 'Morning setup',
    instructions: 'Prepare the setup.',
    response: {
      kind: 'photo_checklist',
      prompt: 'Show the complete morning setup.',
      criteria: [
        { id: 'bottle', label: 'Filled water bottle', criterion: 'A filled bottle is visible.', required: true },
        { id: 'case', label: 'Storage case', criterion: 'The storage case is visible.', required: false },
      ],
    },
  },
};

describe('CameraScreen privacy notice', () => {
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

  it('states access, deletion, and export boundaries before submission', () => {
    act(() => root.render(<CameraScreen busy={false} back={() => undefined} submit={async () => undefined} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('used only to verify this routine');
    expect(container.textContent).toContain('within 30 days at the latest');
    expect(container.textContent).toContain('never included in reports or diagnostics');
  });

  it('shows the exact frozen checklist before opening the live camera', () => {
    act(() => root.render(<CameraScreen event={checklistEvent} busy={false} back={() => undefined} submit={async () => undefined} t={(key) => translate('en', key)} />));

    expect(container.textContent).toContain('Show the complete morning setup.');
    expect(container.textContent).toContain('Filled water bottle');
    expect(container.textContent).toContain('Storage case');
    expect(container.textContent).toContain('One live photo covers the whole list.');
  });
});
