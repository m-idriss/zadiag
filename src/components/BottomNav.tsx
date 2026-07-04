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
        { tab: 'home', icon: '▦', label: t('overview') },
        { tab: 'history', icon: '◌', label: t('history') },
        { tab: 'settings', icon: '⚙', label: t('settings') },
      ]
    : routineCentricEnabled ? [
        { tab: 'home', icon: '☼', label: t('today') },
        { tab: 'routines', icon: '□', label: t('routines') },
        { tab: 'settings', icon: '⚙', label: t('settings') },
      ] : [
        { tab: 'home', icon: '☼', label: t('today') },
        { tab: 'history', icon: '☷', label: t('progress') },
        { tab: 'settings', icon: '⚙', label: t('settings') },
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
            <span aria-hidden="true">{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>
    </>
  );
}
