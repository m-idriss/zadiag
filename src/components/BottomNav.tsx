import type { CSSProperties } from 'react';
import type { MessageKey } from '../services/i18n';
import { AppIcon, type AppIconName } from './Icon';

export type Tab = 'home' | 'history' | 'routines' | 'settings';

export const navigationTabs = (role: 'parent' | 'child', routineCentricEnabled = true): Tab[] => (
  role === 'parent' || routineCentricEnabled
    ? ['home', 'routines', 'settings']
    : ['home', 'history', 'settings']
);

export const tabAfterSwipe = (tabs: Tab[], current: Tab, direction: 'left' | 'right'): Tab => {
  const currentIndex = tabs.indexOf(current);
  if (currentIndex < 0) return tabs[0] ?? current;
  const nextIndex = currentIndex + (direction === 'left' ? 1 : -1);
  return tabs[nextIndex] ?? current;
};

export function BottomNav({
  tab,
  role,
  routineCentricEnabled = true,
  profileColor,
  onChange,
  t,
}: {
  tab: Tab;
  role: 'parent' | 'child';
  routineCentricEnabled?: boolean;
  profileColor?: string;
  onChange: (tab: Tab) => void;
  t: (key: MessageKey) => string;
}) {
  const icons: Record<Tab, AppIconName> = {
    home: role === 'parent' ? 'home' : 'today',
    history: 'stats',
    routines: 'routines',
    settings: 'settings',
  };
  const labels: Record<Tab, string> = {
    home: t('homeNav'),
    history: t('progress'),
    routines: t('routines'),
    settings: t('settings'),
  };
  const items = navigationTabs(role, routineCentricEnabled).map((itemTab) => ({
    tab: itemTab,
    icon: icons[itemTab],
    label: labels[itemTab],
  }));
  return (
    <>
      <div className="bottom-nav-backdrop" aria-hidden="true" />
      <nav
        className="bottom-nav"
        aria-label={t('primaryNavigation')}
        style={profileColor ? { '--profile-color': profileColor } as CSSProperties : undefined}
      >
        {items.map((item) => (
          <button
            type="button"
            key={item.tab}
            className={tab === item.tab ? 'active' : ''}
            aria-current={tab === item.tab ? 'page' : undefined}
            onClick={() => onChange(item.tab)}
          >
            <AppIcon name={item.icon} />{item.label}
          </button>
        ))}
      </nav>
    </>
  );
}
