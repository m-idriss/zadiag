import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Locale } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { AppIcon, type AppIconName } from './Icon';
import { routineIconCatalog, routineIconCategories, type RoutineIconCategory } from './routineIconCatalog';

const RECENT_ICONS_KEY = 'zadiag.routineIcons.recent';
const categoryKeys: Record<RoutineIconCategory, MessageKey> = {
  health: 'routineIconCategoryHealth',
  activity: 'routineIconCategoryActivity',
  home: 'routineIconCategoryHome',
  food: 'routineIconCategoryFood',
  time: 'routineIconCategoryTime',
  communication: 'routineIconCategoryCommunication',
  symbol: 'routineIconCategorySymbol',
};
const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase();
const readRecentIcons = (): AppIconName[] => {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_ICONS_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((name): name is AppIconName => routineIconCatalog.some((entry) => entry.name === name)).slice(0, 8) : [];
  } catch {
    return [];
  }
};

export function RoutineIconPicker({ selected, locale, close, select, t }: {
  selected: AppIconName;
  locale: Locale;
  close: () => void;
  select: (icon: AppIconName) => void;
  t: (key: MessageKey) => string;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<RoutineIconCategory | 'all' | 'recent'>('all');
  const [recent, setRecent] = useState(readRecentIcons);
  const language = locale === 'fr' ? 'fr' : 'en';
  const entries = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    const recentOrder = new Map(recent.map((name, index) => [name, index]));
    return routineIconCatalog
      .filter((entry) => category === 'all' || (category === 'recent' ? recentOrder.has(entry.name) : entry.category === category))
      .filter((entry) => !normalizedQuery || normalize(`${entry.en} ${entry.fr} ${entry.keywords ?? ''}`).includes(normalizedQuery))
      .sort((a, b) => category === 'recent' ? (recentOrder.get(a.name) ?? 99) - (recentOrder.get(b.name) ?? 99) : 0);
  }, [category, query, recent]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [close]);

  const choose = (icon: AppIconName) => {
    const nextRecent = [icon, ...recent.filter((name) => name !== icon)].slice(0, 8);
    setRecent(nextRecent);
    try {
      localStorage.setItem(RECENT_ICONS_KEY, JSON.stringify(nextRecent));
    } catch {
      // Recent choices are optional.
    }
    select(icon);
    close();
  };

  return createPortal(
    <div className="routine-icon-picker-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="routine-icon-picker" role="dialog" aria-modal="true" aria-labelledby="routine-icon-picker-title">
        <header><div><small>{t('routineIcon')}</small><h2 id="routine-icon-picker-title">{t('routineIconPickerTitle')}</h2></div><button type="button" aria-label={t('close')} onClick={close}><AppIcon name="close" /></button></header>
        <label className="routine-icon-search"><AppIcon name="search" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('routineIconSearchPlaceholder')} /></label>
        <div className="routine-icon-categories" role="tablist" aria-label={t('routineIconCategories')}>
          <button type="button" className={category === 'all' ? 'active' : ''} onClick={() => setCategory('all')}>{t('all')}</button>
          {recent.length ? <button type="button" className={category === 'recent' ? 'active' : ''} onClick={() => setCategory('recent')}>{t('routineIconRecent')}</button> : null}
          {routineIconCategories.map((item) => <button type="button" className={category === item ? 'active' : ''} key={item} onClick={() => setCategory(item)}>{t(categoryKeys[item])}</button>)}
        </div>
        <div className="routine-icon-catalog">
          {entries.map((entry) => <button type="button" key={entry.name} className={selected === entry.name ? 'selected' : ''} aria-pressed={selected === entry.name} aria-label={entry[language]} title={entry[language]} onClick={() => choose(entry.name)}><AppIcon name={entry.name} /><span>{entry[language]}</span></button>)}
          {!entries.length ? <p>{t('routineIconNoResults')}</p> : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}
