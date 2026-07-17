import { describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { defaultAppPreferences, type PushSubscriptionHealth, type VerificationEvent } from '../domain/models';
import { translate } from '../services/i18n';
import { SettingsScreen } from './SettingsScreen';
import type { SyncStatus } from '../services/contracts';

const renderSettings = ({
  notificationsEnabled = false,
  pushHealth = {
    permission: 'granted',
    endpointPresent: true,
    lastSuccessfulSaveAt: '2026-07-07T19:40:00.000Z',
    lastDispatchResult: 'success',
    lastDispatchAt: '2026-07-07T19:42:00.000Z',
  },
  sendTestPushNotification = async () => undefined,
  reset = async () => undefined,
  syncStatus = 'synced',
}: {
  notificationsEnabled?: boolean;
  pushHealth?: PushSubscriptionHealth;
  sendTestPushNotification?: () => Promise<void>;
  reset?: () => Promise<void>;
  syncStatus?: SyncStatus;
} = {}) => {
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
        reset={reset}
        role="parent"
        notificationsEnabled={notificationsEnabled}
        pushHealth={pushHealth}
        preferences={defaultAppPreferences}
        setPreferences={async () => undefined}
        enableNotifications={async () => undefined}
        sendTestPushNotification={sendTestPushNotification}
        childInstalled
        familyId="family-1"
        events={[] as VerificationEvent[]}
        pendingChecks={0}
        totalChecks={0}
        serviceWorkerStatus="registered"
        lastSyncAt="2026-07-07T19:45:00.000Z"
        syncStatus={syncStatus}
        participantAccess={[
          { participant: { id: 'maya', displayName: 'Maya' }, membership: { role: 'caregiver', status: 'active' } },
          { participant: { id: 'leo', displayName: 'Leo' }, membership: { role: 'owner', status: 'active' } },
        ]}
        activeParticipantId="leo"
      />,
    );
  });
  return { container, root };
};

describe('SettingsScreen recovery diagnostics', () => {
  it('shows recovery diagnostics needed by support', () => {
    const { container, root } = renderSettings();

    expect(container.textContent).toContain('Recovery diagnostics');
    expect(container.textContent).not.toContain('Sensitive area');
    expect(container.textContent).not.toContain('Install & notifications');
    expect(container.querySelectorAll('.relationship-manager')).toHaveLength(1);
    expect(container.querySelectorAll('.settings-contact-button')).toHaveLength(0);
    expect(container.querySelector('.relationship-manager .profile-context-summary')?.textContent).toContain('Leo');
    const managerToggle = container.querySelector('.relationship-manager-toggle') as HTMLButtonElement;
    act(() => managerToggle.click());
    expect(container.querySelector('.relationship-profile-list')?.textContent).toContain('Leo');
    expect(container.querySelector('.relationship-profile-list')?.textContent).toContain('Owner');
    const diagnosticsToggle = Array.from(container.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === 'Recovery diagnostics',
    );
    act(() => diagnosticsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.textContent).toContain('Family ID');
    expect(container.textContent).toContain('family-1');
    expect(container.querySelector('.settings-diagnostics-list')?.textContent).not.toContain('Followed profile');
    expect(container.querySelector('.settings-diagnostics-list')?.textContent).not.toContain('Role');
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

describe('SettingsScreen help and reliability', () => {
  it('keeps connection health visible without opening diagnostics', () => {
    const { container, root } = renderSettings();

    expect(container.textContent).toContain('Connection & sync');
    expect(container.textContent).toContain('Online · Last sync');
    expect(container.querySelector('.settings-health-badge')?.textContent).toBe('Ready');

    act(() => root.unmount());
    container.remove();
  });

  it('shows connection health when the app reports the device offline', () => {
    const { container, root } = renderSettings({ syncStatus: 'offline' });

    expect(container.textContent).toContain('Offline. Zadiag will refresh when the connection returns.');
    expect(container.querySelector('.settings-health-badge')?.textContent).toBe('Waiting');

    act(() => root.unmount());
    container.remove();
  });

  it('opens contextual help for the core product questions', () => {
    const { container, root } = renderSettings();
    const help = container.querySelector<HTMLDetailsElement>('.settings-help-center');

    expect(help?.open).toBe(false);
    act(() => help?.querySelector('summary')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(help?.open).toBe(true);
    expect(help?.textContent).toContain('How do I install Zadiag?');
    expect(help?.textContent).toContain('Why am I not receiving notifications?');
    expect(help?.textContent).toContain('How does automatic analysis work?');
    expect(help?.textContent).toContain('What happens when a result is uncertain?');

    act(() => root.unmount());
    container.remove();
  });
});

describe('SettingsScreen privacy and data', () => {
  it('explains retention and access and exposes data actions', () => {
    const { container, root } = renderSettings();

    const trustCenter = container.querySelector('[aria-labelledby="settings-trust-heading"]');
    expect(trustCenter?.textContent).toContain('Privacy & data');
    expect(trustCenter?.textContent).toContain('automatically deleted after at most 30 days');
    expect(trustCenter?.textContent).toContain('Diagnostic logs stay on this device for up to 7 days');
    expect(trustCenter?.textContent).toContain('No photo, name, email, routine content, or medical information is included');
    expect(trustCenter?.textContent).toContain('deleted after 35 days');
    expect(trustCenter?.textContent).toContain('Who has access');
    expect(trustCenter?.textContent).toContain('Your data copy');
    expect(container.textContent).toContain('Delete account data');
    expect(container.textContent).not.toContain('Immediate deletion by default');

    act(() => root.unmount());
    container.remove();
  });

  it('keeps the user in settings and explains a refused deletion', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container, root } = renderSettings({ reset: async () => { throw new Error('failed-precondition'); } });
    const deleteButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Delete account data'),
    );

    await act(async () => deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.textContent).toContain('The data could not be deleted');
    expect(deleteButton?.disabled).toBe(false);

    act(() => root.unmount());
    container.remove();
  });
});

describe('SettingsScreen push diagnostics', () => {
  it('treats a successful test push as endpoint evidence', async () => {
    const { container, root } = renderSettings({
      notificationsEnabled: true,
      pushHealth: {
        permission: 'granted',
        endpointPresent: false,
      },
      sendTestPushNotification: async () => undefined,
    });

    const diagnosticsToggle = Array.from(container.querySelectorAll('button')).find(
      (button) => button.getAttribute('aria-label') === 'Recovery diagnostics',
    );
    act(() => diagnosticsToggle?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('Push endpoint');
    expect(container.textContent).toContain('No');

    const testButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Send test',
    );
    await act(async () => testButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.textContent).toContain('Test notification sent to this device.');
    expect(container.textContent).toContain('Yes');
    expect(container.textContent).toContain('Last push result');
    expect(container.textContent).toContain('success');
    expect(container.textContent).toContain('Last push at');
    expect(container.textContent).not.toContain('Last push atMissing');

    act(() => root.unmount());
    container.remove();
  });
});
