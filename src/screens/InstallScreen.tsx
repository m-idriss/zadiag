import { addOutline } from 'ionicons/icons';
import type { Locale } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { SetupProgress } from '../components/SetupProgress';
import { SvgIcon } from '../components/SvgIcon';
import { AppIcon } from '../components/Icon';

export function InstallScreen({
  locale,
  setLocale,
  t,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
}) {
  return (
    <main className="page setup-page install-setup-page">
      <div className="language-toggle" role="group" aria-label="Language">
        <button type="button" className={locale === 'en' ? 'active' : ''} aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
        <button type="button" className={locale === 'fr' ? 'active' : ''} aria-pressed={locale === 'fr'} onClick={() => setLocale('fr')}>FR</button>
      </div>
      <SetupProgress current={1} t={t} />
      <div className="setup-hero-icon" aria-hidden="true"><AppIcon name="download" /></div>
      <p className="setup-eyebrow">{t('setupStepOne')}</p>
      <h1>{t('setupInstallTitle')}</h1>
      <p className="setup-intro">{t('setupInstallIntro')}</p>

      <section className="card setup-summary">
        <div>
          <strong>{t('setupInstallSummaryTitle')}</strong>
          <p>{t('setupInstallSummaryBody')}</p>
        </div>
        <span aria-hidden="true"><AppIcon name="download" /></span>
      </section>

      <section className="card instruction-card">
        <div className="instruction-row">
          <span className="instruction-number">1</span>
          <div><strong>{t('setupInstallShareTitle')}</strong><p>{t('setupInstallShareBody')}</p></div>
          <span className="instruction-symbol" aria-hidden="true"><AppIcon name="share" /></span>
        </div>
        <div className="instruction-row">
          <span className="instruction-number">2</span>
          <div><strong>{t('setupInstallHomeTitle')}</strong><p>{t('setupInstallHomeBody')}</p></div>
          <span className="instruction-symbol" aria-hidden="true"><SvgIcon icon={addOutline} /></span>
        </div>
        <div className="instruction-row">
          <span className="instruction-number">3</span>
          <div><strong>{t('setupInstallOpenTitle')}</strong><p>{t('setupInstallOpenBody')}</p></div>
          <img className="instruction-app-icon" src="/icons/icon-192.png" alt="" />
        </div>
      </section>

      <aside className="setup-help"><span aria-hidden="true"><AppIcon name="info" /></span><p>{t('setupInstallRequired')}</p></aside>
    </main>
  );
}
