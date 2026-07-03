import { IonIcon } from '@ionic/react';
import { timeOutline } from 'ionicons/icons';
import type { Locale, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { StatusPill } from '../components/StatusPill';

export function HistoryScreen({ events, locale, t }: { events: VerificationEvent[]; locale: Locale; t: (key: MessageKey) => string }) {
  const closed = events.filter((event) => event.status !== 'pending' && event.status !== 'analyzing');
  const formatDateTime = (value: string) => new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
  return (
    <div className="content-screen">
      <header className="screen-header"><div><small>{t('progress')}</small><h1>{t('history')}</h1><p>{t('historyHint')}</p></div></header>
      <div className="history-list">
        {closed.map((event) => (
          <section className="card history-row" key={event.id}>
            <div className="history-icon"><IonIcon icon={timeOutline} aria-hidden="true" /></div>
            <div><strong>{formatDateTime(event.requestedAt)}</strong><small>{event.imageQuality != null ? `${t('imageQuality')} ${Math.round(event.imageQuality * 100)}%` : ''}</small></div>
            <StatusPill status={event.status} t={t} />
          </section>
        ))}
      </div>
    </div>
  );
}
