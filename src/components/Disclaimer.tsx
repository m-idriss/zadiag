import type { MessageKey } from '../services/i18n';

export function Disclaimer({ t }: { t: (key: MessageKey) => string }) {
  return <div className="disclaimer"><span>ⓘ</span><p>{t('disclaimer')}</p></div>;
}
