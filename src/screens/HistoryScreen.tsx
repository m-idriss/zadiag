import type { VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { StatusPill } from '../components/StatusPill';

export function HistoryScreen({ events, t }: { events: VerificationEvent[]; t: (key: MessageKey) => string }) {
  const closed = events.filter((event) => event.status !== 'pending' && event.status !== 'analyzing');
  return (
    <div className="content-screen">
      <header className="screen-header"><div><small>{t('progress')}</small><h1>{t('history')}</h1><p>A calm look at the recent routine.</p></div></header>
      <div className="history-list">
        {closed.map((event) => (
          <section className="card history-row" key={event.id}>
            <div className="history-icon">◎</div>
            <div><strong>{new Date(event.requestedAt).toLocaleDateString()}</strong><small>{event.imageQuality ? `Image quality ${Math.round(event.imageQuality * 100)}%` : ''}</small></div>
            <StatusPill status={event.status} t={t} />
          </section>
        ))}
      </div>
    </div>
  );
}
