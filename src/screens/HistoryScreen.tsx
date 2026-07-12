import type { Locale, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { StatusPill } from '../components/StatusPill';
import { withResolvedEventStatuses } from '../domain/adherence';
import { ListRow } from '../components/ui';
import { languageTag } from '../services/locale';

export function HistoryScreen({ events, locale, t }: { events: VerificationEvent[]; locale: Locale; t: (key: MessageKey) => string }) {
  const closed = withResolvedEventStatuses(events).filter((event) => event.status !== 'pending' && event.status !== 'analyzing');
  const formatDateTime = (value: string) => new Intl.DateTimeFormat(languageTag(locale), {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
  return (
    <div className="content-screen">
      <header className="screen-header"><div><small>{t('progress')}</small><h1>{t('history')}</h1><p>{t('historyHint')}</p></div></header>
      <div className="history-list">
        {closed.map((event) => (
          <ListRow
            as="section"
            className="card history-row"
            variant="bare"
            icon="time"
            iconClassName="history-icon"
            title={formatDateTime(event.requestedAt)}
            detail={event.imageQuality != null ? `${t('imageQuality')} ${Math.round(event.imageQuality * 100)}%` : ''}
            trailing={<StatusPill status={event.status} t={t} />}
            key={event.id}
          />
        ))}
      </div>
    </div>
  );
}
