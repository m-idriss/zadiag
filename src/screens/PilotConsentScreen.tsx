import { useState } from 'react';
import type { PilotParticipation, Role } from '../domain/models';
import { PILOT_CONSENT_VERSION } from '../domain/pilotParticipation';
import type { MessageKey } from '../services/i18n';
import { AppIcon } from '../components/Icon';
import { ActionButton } from '../components/ui';

export function PilotConsentScreen({ role, decide, t }: {
  role: Role;
  decide: (status: Extract<PilotParticipation['status'], 'accepted' | 'declined'>) => Promise<void>;
  t: (key: MessageKey) => string;
}) {
  const [busy, setBusy] = useState<PilotParticipation['status']>();
  const [error, setError] = useState(false);
  const choose = async (status: Extract<PilotParticipation['status'], 'accepted' | 'declined'>) => {
    setBusy(status);
    setError(false);
    try { await decide(status); }
    catch (reason) { console.error(reason); setError(true); }
    finally { setBusy(undefined); }
  };
  return (
    <main className="page pilot-consent-page">
      <div className="section-icon" aria-hidden="true"><AppIcon name="stats" /></div>
      <p className="setup-eyebrow">{t('pilotConsentEyebrow')}</p>
      <h1>{t('pilotConsentTitle')}</h1>
      <p>{t('pilotConsentIntro')}</p>
      <section className="card pilot-consent-card">
        <h2>{t('pilotConsentMeasuredTitle')}</h2>
        <ul><li>{t('pilotConsentMeasuredApp')}</li><li>{t('pilotConsentMeasuredNotifications')}</li><li>{t('pilotConsentMeasuredChecks')}</li></ul>
        <h2>{t('pilotConsentExcludedTitle')}</h2>
        <p>{t('pilotConsentExcludedDetail')}</p>
        <small>{t('pilotConsentRetention')} · {t('pilotConsentRole')} {t(role)} · v{PILOT_CONSENT_VERSION}</small>
      </section>
      {error ? <p className="form-error" role="alert">{t('pilotConsentError')}</p> : null}
      <ActionButton disabled={Boolean(busy)} aria-busy={busy === 'accepted'} onClick={() => { void choose('accepted'); }}>{busy === 'accepted' ? <span className="button-spinner" aria-hidden="true" /> : null}{t('pilotConsentAccept')}</ActionButton>
      <button type="button" className="regenerate-code" disabled={Boolean(busy)} onClick={() => { void choose('declined'); }}>{t('pilotConsentDecline')}</button>
      <small className="pilot-consent-note">{t('pilotConsentOptional')}</small>
    </main>
  );
}
