import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { translate } from '../services/i18n';
import { CameraScreen } from './CameraScreen';

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
});
