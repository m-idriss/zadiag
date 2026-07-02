import { useState } from 'react';
import { IonButton, IonCheckbox, IonInput } from '@ionic/react';
import type { Role } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { Disclaimer } from '../components/Disclaimer';
import { CodeBox } from '../components/CodeBox';
import { SetupProgress } from '../components/SetupProgress';

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
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(false);
    setBusy(true);
    try {
      if (parent && mode === 'recover') await onParentRecover(value.trim());
      else await (parent ? onParentLink(value.trim()) : onChildLink(value.trim()));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page link-page">
      <button type="button" className="back-button" onClick={back}>‹</button>
      {!parent ? <SetupProgress current={2} t={t} /> : null}
      <div className="section-icon">{parent ? '⌂' : '⌁'}</div>
      {!parent ? <p className="setup-eyebrow">{t('setupStepTwo')}</p> : null}
      <h1>{parent ? t('createLink') : t('joinFamily')}</h1>
      <p>{parent ? (mode === 'recover' ? t('parentRecoverHint') : t('parentLinkHint')) : t('childLinkHint')}</p>
      <section className="card link-card">
        <IonInput
          label={parent ? (mode === 'recover' ? t('parentRecoveryCode') : t('childNickname')) : t('linkingCode')}
          labelPlacement="stacked"
          fill="outline"
          value={value}
          onIonInput={(event) => setValue(String(event.detail.value ?? ''))}
        />
        {parent && (
          <>
            {mode === 'create' ? (
              <>
                {code && <CodeBox label={t('linkingCode')} hint={t('shareCodeHint')} value={code} t={t} />}
                <label className="consent-row">
                  <IonCheckbox checked={consent} onIonChange={(event) => setConsent(event.detail.checked)} />
                  <span>{t('consent')}</span>
                </label>
              </>
            ) : (
              <p className="setup-help-text">{t('parentRecoverHelp')}</p>
            )}
          </>
        )}
        {error && <p className="form-error" role="alert">{t('invalidCode')}</p>}
      </section>
      {!parent ? <aside className="setup-help"><span aria-hidden="true">ⓘ</span><p>{t('setupLinkHelp')}</p></aside> : null}
      <Disclaimer t={t} />
      {parent ? <button className="regenerate-code" type="button" onClick={() => { setMode(mode === 'create' ? 'recover' : 'create'); setValue(''); setConsent(false); }}>
        {mode === 'create' ? t('recoverExistingFamily') : t('createNewFamily')}
      </button> : null}
      <IonButton expand="block" disabled={busy || !value.trim() || (parent && mode === 'create' && !consent)} onClick={submit}>
        {parent ? (mode === 'recover' ? t('recoverContinue') : t('createContinue')) : t('linkContinue')}
      </IonButton>
    </main>
  );
}
