import { IonIcon } from '@ionic/react';
import { calendarClearOutline, gridOutline, listOutline, pulseOutline, settingsOutline, sunnyOutline } from 'ionicons/icons';
import type { MessageKey } from '../services/i18n';

export type Tab = 'home' | 'history' | 'routines' | 'settings';

export function BottomNav({
  tab,
  role,
  routineCentricEnabled = true,
  onChange,
  t,
}: {
  tab: Tab;
  role: 'parent' | 'child';
  routineCentricEnabled?: boolean;
  onChange: (tab: Tab) => void;
  t: (key: MessageKey) => string;
}) {
  const items: { tab: Tab; icon: string; label: string }[] = role === 'parent'
    ? [
        { tab: 'home', icon: gridOutline, label: t('overview') },
        { tab: 'history', icon: pulseOutline, label: t('history') },
        { tab: 'settings', icon: settingsOutline, label: t('settings') },
      ]
    : routineCentricEnabled ? [
        { tab: 'home', icon: sunnyOutline, label: t('today') },
        { tab: 'routines', icon: calendarClearOutline, label: t('routines') },
        { tab: 'settings', icon: settingsOutline, label: t('settings') },
      ] : [
        { tab: 'home', icon: sunnyOutline, label: t('today') },
        { tab: 'history', icon: listOutline, label: t('progress') },
        { tab: 'settings', icon: settingsOutline, label: t('settings') },
      ];
  return (
    <>
      <div className="bottom-nav-backdrop" aria-hidden="true" />
      <nav className="bottom-nav" aria-label={t('primaryNavigation')}>
        {items.map((item) => (
          <button
            type="button"
            key={item.tab}
            className={tab === item.tab ? 'active' : ''}
            aria-current={tab === item.tab ? 'page' : undefined}
            onClick={() => onChange(item.tab)}
          >
            <IonIcon icon={item.icon} aria-hidden="true" />{item.label}
          </button>
        ))}
      </nav>
    </>
  );
}
