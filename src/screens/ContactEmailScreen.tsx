import { useState, type FormEvent } from 'react';
import type { Locale } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { BrandMark } from '../components/BrandMark';

export function ContactEmailScreen({ locale, setLocale, submit, t }: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  submit: (email: string) => Promise<void>;
  t: (key: MessageKey) => string;
}) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try { await submit(email); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  return (
    <main className="page welcome-page">
      <div className="language-toggle" role="group" aria-label="Language">
        <button type="button" className={locale === 'en' ? 'active' : ''} aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
        <button type="button" className={locale === 'fr' ? 'active' : ''} aria-pressed={locale === 'fr'} onClick={() => setLocale('fr')}>FR</button>
      </div>
      <section className="card contact-email-card" aria-labelledby="contact-email-title">
        <BrandMark />
        <h1 id="contact-email-title">{t('contactEmailTitle')}</h1>
        <p>{t('contactEmailBody')}</p>
        <form onSubmit={(event) => { void onSubmit(event); }}>
          <label className="native-input-field">
            <span>{t('contactEmailLabel')}</span>
            <input type="email" inputMode="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          {error ? <p className="form-error" role="alert">{t('contactEmailError')}</p> : null}
          <button className="primary-action-button" type="submit" disabled={busy || !email.trim()}>{busy ? t('contactEmailSaving') : t('contactEmailContinue')}</button>
        </form>
        <small>{t('contactEmailNotice')}</small>
      </section>
    </main>
  );
}

export function SuspendedScreen({ t }: { t: (key: MessageKey) => string }) {
  return <main className="page welcome-page"><section className="card contact-email-card"><BrandMark /><h1>{t('accessSuspendedTitle')}</h1><p>{t('accessSuspendedBody')}</p></section></main>;
}
