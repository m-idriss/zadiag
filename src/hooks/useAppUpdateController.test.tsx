import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { useAppUpdateController } from './useAppUpdateController';

describe('useAppUpdateController', () => {
  it('does not announce a waiting worker when the deployed version is current', async () => {
    const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
    const registration = {
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
      waiting: { postMessage: vi.fn() },
    } as unknown as ServiceWorkerRegistration;
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: vi.fn(),
        getRegistration: vi.fn().mockResolvedValue(registration),
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ version: import.meta.env.VITE_APP_VERSION }),
      ok: true,
    }));

    const container = document.createElement('div');
    const root = createRoot(container);
    let controller: ReturnType<typeof useAppUpdateController> | undefined;
    const Harness = () => {
      controller = useAppUpdateController(true);
      return null;
    };

    try {
      act(() => root.render(<Harness />));
      await act(async () => {
        await controller?.refreshAppUpdateInfo();
      });

      expect(controller?.appUpdateInfo).toMatchObject({
        available: false,
        currentVersion: import.meta.env.VITE_APP_VERSION,
        latestVersion: import.meta.env.VITE_APP_VERSION,
        severity: 'unknown',
      });
      expect(controller?.showUpdateSnackbar).toBe(false);
    } finally {
      act(() => root.unmount());
      vi.unstubAllGlobals();
      if (originalServiceWorker) {
        Object.defineProperty(navigator, 'serviceWorker', originalServiceWorker);
      } else {
        Reflect.deleteProperty(navigator, 'serviceWorker');
      }
    }
  });
});
