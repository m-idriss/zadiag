import { useState } from 'react';
import type { Role } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { Disclaimer } from '../components/Disclaimer';
import { CodeBox } from '../components/CodeBox';
import { SetupProgress } from '../components/SetupProgress';
import { ActionButton } from '../components/ui';
import { AppIcon } from '../components/Icon';
import { linkErrorMessageKey } from './linkErrors';

export function LinkScreen({
  role,
  code,
  childName,
  onParentLink,
  onParentRecover,
  onChildLink,
  back,
  t,
}: {
  role: Role;
  code: string;
  childName: string;
  onParentLink: (name: string) => void | Promise<void>;
  onParentRecover: (code: string) => void | Promise<void>;
  onChildLink: (code: string) => void | Promise<void>;
  back: () => void;
  t: (key: MessageKey) => string;
}) {
  const parent = role === 'parent';
  const [mode, setMode] = useState<'create' | 'recover'>('create');
  const [value, setValue] = useState(parent ? childName : code);
  const [consent, setConsent] = useState(false);
  const [errorKey, setErrorKey] = useState<MessageKey>();
  const [busy, setBusy] = useState(false);
  const expectsCode = !parent || mode === 'recover';
  const canSubmit = Boolean(value.trim()) && (!parent || mode !== 'create' || consent) && !busy;

  const submit = async () => {
    setErrorKey(undefined);
    setBusy(true);
    try {
      if (parent && mode === 'recover') await onParentRecover(value.trim());
      else await (parent ? onParentLink(value.trim()) : onChildLink(value.trim()));
    } catch (error) {
      setErrorKey(linkErrorMessageKey(error, !parent && /^ZI-/i.test(value.trim())));
    } finally {
      setBusy(false);
    }
  };

  const updateValue = (nextValue: string) => setValue(expectsCode ? nextValue.toUpperCase() : nextValue);

  return (
    <main className="page link-page">
      <button type="button" className="back-button" onClick={back} aria-label={t('back')}><AppIcon name="chevron-back" /></button>
      <SetupProgress current={parent ? 1 : 2} role={role} t={t} />
      <div className="section-icon" aria-hidden="true"><AppIcon name={parent ? 'home' : 'link'} /></div>
      <p className="setup-eyebrow">{t(parent ? 'parentSetupStepOne' : 'setupStepTwo')}</p>
      <h1>{parent ? t('createLink') : t('joinFamily')}</h1>
      <p>{parent ? (mode === 'recover' ? t('parentRecoverHint') : t('parentLinkHint')) : t('childLinkHint')}</p>
      <section className="card link-card">
        <label className="native-input-field">
          <span>{parent ? (mode === 'recover' ? t('parentRecoveryCode') : t('childNickname')) : t('linkingCode')}</span>
          <input
            value={value}
            maxLength={expectsCode ? (parent ? 17 : 9) : 40}
            autoComplete={expectsCode ? 'one-time-code' : 'nickname'}
            autoCapitalize={expectsCode ? 'characters' : 'words'}
            enterKeyHint="done"
            spellCheck={!expectsCode}
            aria-invalid={Boolean(errorKey)}
            onChange={(event) => updateValue(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !canSubmit) return;
              event.preventDefault();
              void submit();
            }}
          />
        </label>
        {parent && (
          <>
            {mode === 'create' ? (
              <>
                {code && <CodeBox label={t('linkingCode')} hint={t('shareCodeHint')} value={code} t={t} />}
                <label className="consent-row">
                  <input className="native-checkbox" type="checkbox" checked={consent} onChange={(event) => setConsent(event.currentTarget.checked)} />
                  <span>{t('consent')}</span>
                </label>
              </>
            ) : (
              <p className="setup-help-text">{t('parentRecoverHelp')}</p>
            )}
          </>
        )}
        {errorKey && <p className="form-error" role="alert">{t(errorKey)}</p>}
      </section>
      {!parent ? <aside className="setup-help"><span aria-hidden="true"><AppIcon name="info" /></span><p>{t('setupLinkHelp')}</p></aside> : null}
      <Disclaimer t={t} />
      {parent ? <button className="regenerate-code" type="button" onClick={() => { setMode(mode === 'create' ? 'recover' : 'create'); setValue(''); setConsent(false); }}>
        {mode === 'create' ? t('recoverExistingFamily') : t('createNewFamily')}
      </button> : null}
      <ActionButton disabled={!canSubmit} aria-busy={busy} onClick={submit}>
        {busy ? <span className="button-spinner" aria-hidden="true" /> : null}
        {parent ? (mode === 'recover' ? t('recoverContinue') : t('createContinue')) : t('linkContinue')}
      </ActionButton>
      <small className="link-version">v{import.meta.env.VITE_APP_VERSION}</small>
    </main>
  );
}
