import { useState, type FormEvent } from 'react';
import { AppIcon } from '../components/Icon';
import { Disclaimer } from '../components/Disclaimer';
import { ActionButton } from '../components/ui';
import type { MessageKey } from '../services/i18n';
import { linkErrorMessageKey } from './linkErrors';

export function InvitationScreen({ code, accountNameRequired, accept, saveAccountName, cancel, t }: {
  code: string;
  accountNameRequired: boolean;
  accept: () => Promise<void>;
  saveAccountName: (name: string) => Promise<void>;
  cancel: () => void;
  t: (key: MessageKey) => string;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey>();

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setErrorKey(undefined);
    try { await action(); }
    catch (error) { setErrorKey(linkErrorMessageKey(error, true)); }
    finally { setBusy(false); }
  };
  const submitName = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    void run(() => saveAccountName(name.trim()));
  };

  return (
    <main className="page invitation-page">
      <button type="button" className="back-button" onClick={cancel} aria-label={t('back')}><AppIcon name="chevron-back" /></button>
      <div className="section-icon" aria-hidden="true"><AppIcon name="link" /></div>
      <p className="setup-eyebrow">{t('relationshipInvitationEyebrow')}</p>
      <h1>{t(accountNameRequired ? 'relationshipInvitationNameTitle' : 'relationshipInvitationOpenTitle')}</h1>
      <p>{t(accountNameRequired ? 'relationshipInvitationNameHint' : 'relationshipInvitationOpenHint')}</p>
      <section className="card invitation-card">
        {accountNameRequired ? (
          <form onSubmit={submitName}>
            <label className="native-input-field">
              <span>{t('accountProfileNameLabel')}</span>
              <input value={name} maxLength={40} autoComplete="name" autoCapitalize="words" enterKeyHint="done" onChange={(event) => setName(event.currentTarget.value)} />
            </label>
            <ActionButton type="submit" disabled={busy || !name.trim()} aria-busy={busy}>
              {busy ? <span className="button-spinner" aria-hidden="true" /> : null}
              {busy ? t('relationshipWorking') : t('relationshipInvitationFinishAction')}
            </ActionButton>
          </form>
        ) : (
          <>
            <span className="invitation-code-label">{t('relationshipInvitationCode')}</span>
            <strong>{code}</strong>
            <ActionButton disabled={busy} aria-busy={busy} onClick={() => { void run(accept); }}>
              {busy ? <span className="button-spinner" aria-hidden="true" /> : null}
              {busy ? t('relationshipWorking') : t('relationshipInvitationAcceptAction')}
            </ActionButton>
          </>
        )}
        {errorKey ? <p className="form-error" role="alert">{t(errorKey)}</p> : null}
      </section>
      <Disclaimer t={t} />
    </main>
  );
}
