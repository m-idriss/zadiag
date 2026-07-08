import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { ReactNode } from 'react';
import { defaultAppPreferences, type VerificationEvent } from '../domain/models';
import { translate } from '../services/i18n';
import { SettingsScreen } from './SettingsScreen';

vi.mock('@ionic/react', () => ({
  IonButton: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
  IonIcon: () => null,
}));

const renderSettings = () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <SettingsScreen
        t={(key) => translate('en', key)}
        locale="en"
        setLocale={async () => undefined}
        updateInfo={{ available: false, currentVersion: '0.3.182', severity: 'unknown' }}
        forceAppUpdate={async () => false}
        reset={() => undefined}
        role="parent"
        notificationsEnabled={false}
        pushHealth={{
          permission: 'granted',
          endpointPresent: true,
          lastSuccessfulSaveAt: '2026-07-07T19:40:00.000Z',
          lastDispatchResult: 'success',
          lastDispatchAt: '2026-07-07T19:42:00.000Z',
        }}
        preferences={defaultAppPreferences}
        setPreferences={async () => undefined}
        sendTestPushNotification={async () => undefined}
        childInstalled
        familyId="family-1"
        events={[] as VerificationEvent[]}
        childLinkingCode="ZD-123456"
        parentRecoveryCode="PR-1234"
        pendingChecks={0}
        totalChecks={0}
        serviceWorkerStatus="registered"
        lastSyncAt="2026-07-07T19:45:00.000Z"
        regenerateLinkCode={async () => undefined}
      />,
    );
  });
  return { container, root };
};

describe('SettingsScreen recovery diagnostics', () => {
  it('shows recovery diagnostics needed by support', () => {
    const { container, root } = renderSettings();

    expect(container.textContent).toContain('Recovery diagnostics');
    const diagnosticsToggle = Array.from(container.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === 'Recovery diagnostics',
    );
    act(() => diagnosticsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.textContent).toContain('Family ID');
    expect(container.textContent).toContain('family-1');
    expect(container.textContent).toContain('Role');
    expect(container.textContent).toContain('Responsible');
    expect(container.textContent).toContain('Participant linked');
    expect(container.textContent).toContain('Completed');
    expect(container.textContent).toContain('Notifications');
    expect(container.textContent).toContain('Not enabled');
    expect(container.textContent).toContain('Push permission');
    expect(container.textContent).toContain('granted');
    expect(container.textContent).toContain('Push endpoint');
    expect(container.textContent).toContain('Yes');
    expect(container.textContent).toContain('Last push result');
    expect(container.textContent).toContain('success');
    expect(container.textContent).toContain('Test notification');
    expect(container.textContent).toContain('Enable notifications on this device first.');
    expect(container.textContent).toContain('App version');
    expect(container.textContent).toContain('Service worker');
    expect(container.textContent).toContain('Registered');
    expect(container.textContent).toContain('Last sync');

    act(() => root.unmount());
    container.remove();
  });
});
