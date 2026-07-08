import type { MessageKey } from '../services/i18n';
import { AppIcon, type AppIconName } from './Icon';

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
  const items: { tab: Tab; icon: AppIconName; label: string }[] = role === 'parent'
    ? [
        { tab: 'home', icon: 'home', label: t('homeNav') },
        { tab: 'routines', icon: 'routines', label: t('routines') },
        { tab: 'settings', icon: 'settings', label: t('settings') },
      ]
    : routineCentricEnabled ? [
        { tab: 'home', icon: 'today', label: t('homeNav') },
        { tab: 'routines', icon: 'routines', label: t('routines') },
        { tab: 'settings', icon: 'settings', label: t('settings') },
      ] : [
        { tab: 'home', icon: 'today', label: t('homeNav') },
        { tab: 'history', icon: 'stats', label: t('progress') },
        { tab: 'settings', icon: 'settings', label: t('settings') },
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
            <AppIcon name={item.icon} />{item.label}
          </button>
        ))}
      </nav>
    </>
  );
}
