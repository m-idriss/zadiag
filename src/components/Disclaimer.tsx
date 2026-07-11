import type { MessageKey } from '../services/i18n';
import { AppIcon } from './Icon';

export function Disclaimer({ t }: { t: (key: MessageKey) => string }) {
  return <div className="disclaimer"><span aria-hidden="true"><AppIcon name="info" /></span><p>{t('disclaimer')}</p></div>;
}
