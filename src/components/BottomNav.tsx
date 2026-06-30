import type { MessageKey } from '../services/i18n';

export type Tab = 'home' | 'history' | 'settings';

export function BottomNav({
  tab,
  role,
  onChange,
  t,
}: {
  tab: Tab;
  role: 'parent' | 'child';
  onChange: (tab: Tab) => void;
  t: (key: MessageKey) => string;
}) {
  const items: { tab: Tab; icon: string; label: string }[] = [
    { tab: 'home', icon: role === 'parent' ? '▦' : '☀', label: role === 'parent' ? t('overview') : t('today') },
    { tab: 'history', icon: '◷', label: role === 'parent' ? t('history') : t('progress') },
    { tab: 'settings', icon: '⚙', label: t('settings') },
  ];
  return (
    <nav className="bottom-nav" aria-label="Primary navigation">
      {items.map((item) => (
        <button
          key={item.tab}
          className={tab === item.tab ? 'active' : ''}
          onClick={() => onChange(item.tab)}
        >
          <span>{item.icon}</span>{item.label}
        </button>
      ))}
    </nav>
  );
}
