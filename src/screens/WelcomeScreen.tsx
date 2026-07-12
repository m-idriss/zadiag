import type { Locale, Role } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { Disclaimer } from '../components/Disclaimer';
import { AppIcon } from '../components/Icon';

export function WelcomeScreen({
  locale,
  setLocale,
  chooseRole,
  t,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  chooseRole: (role: Role) => void;
  t: (key: MessageKey) => string;
}) {
  return (
    <main className="page welcome-page">
      <div className="language-toggle" role="group" aria-label="Language">
        <button type="button" className={locale === 'en' ? 'active' : ''} aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
        <button type="button" className={locale === 'fr' ? 'active' : ''} aria-pressed={locale === 'fr'} onClick={() => setLocale('fr')}>FR</button>
      </div>
      <section className="card welcome-hero" aria-labelledby="welcome-title">
        <div className="brand-icon"><img src="/icons/icon.svg" alt="" /></div>
        <h1 id="welcome-title">Zadiag</h1>
        <p className="hero-copy">{t('tagline')}</p>
      </section>
      <section className="role-section" aria-labelledby="role-title">
        <div className="role-section-heading">
          <h2 id="role-title">{t('continueAs')}</h2>
          <p className="role-help">{t('setupRoleHelp')}</p>
        </div>
        <div className="role-grid">
          <button type="button" className="role-button" onClick={() => chooseRole('parent')}>
            <span className="role-symbol"><AppIcon name="home" /></span>
            <span className="role-copy"><strong>{t('parent')}</strong><small>{t('parentRoleHint')}</small></span>
            <b aria-hidden="true"><AppIcon name="chevron-forward" /></b>
          </button>
          <button type="button" className="role-button" onClick={() => chooseRole('child')}>
            <span className="role-symbol"><AppIcon name="today" /></span>
            <span className="role-copy"><strong>{t('child')}</strong><small>{t('childRoleHint')}</small></span>
            <b aria-hidden="true"><AppIcon name="chevron-forward" /></b>
          </button>
        </div>
        <p className="role-device-note">{t('roleDeviceNote')}</p>
      </section>
      <Disclaimer t={t} />
      <small className="demo-label">{t('demo')}</small>
    </main>
  );
}
