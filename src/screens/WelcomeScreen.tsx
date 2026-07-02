import { IonButton } from '@ionic/react';
import type { Locale, Role } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { Disclaimer } from '../components/Disclaimer';

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
        <button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>EN</button>
        <button className={locale === 'fr' ? 'active' : ''} onClick={() => setLocale('fr')}>FR</button>
      </div>
      <div className="brand-icon"><img src="/icons/icon.svg" alt="" /></div>
      <div className="installed-badge"><span>✓</span>{t('setupInstalledBadge')}</div>
      <h1>Zadiag</h1>
      <p className="hero-copy">{t('tagline')}</p>
      <h2>{t('continueAs')}</h2>
      <p className="role-help">{t('setupRoleHelp')}</p>
      <div className="role-grid">
        <IonButton className="role-button" fill="clear" onClick={() => chooseRole('parent')}>
          <span className="role-symbol">⌂</span>
          <span><strong>{t('parent')}</strong><small>{t('parentRoleHint')}</small></span>
          <b>›</b>
        </IonButton>
        <IonButton className="role-button" fill="clear" onClick={() => chooseRole('child')}>
          <span className="role-symbol">☺</span>
          <span><strong>{t('child')}</strong><small>{t('childRoleHint')}</small></span>
          <b>›</b>
        </IonButton>
      </div>
      <Disclaimer t={t} />
      <small className="demo-label">{t('demo')}</small>
    </main>
  );
}
