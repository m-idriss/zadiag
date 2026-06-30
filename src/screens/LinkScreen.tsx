import { useState } from 'react';
import { IonButton, IonCheckbox, IonInput } from '@ionic/react';
import type { Role } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { Disclaimer } from '../components/Disclaimer';

export function LinkScreen({
  role,
  code,
  childName,
  onParentLink,
  onChildLink,
  back,
  t,
}: {
  role: Role;
  code: string;
  childName: string;
  onParentLink: (name: string) => void;
  onChildLink: (code: string) => void;
  back: () => void;
  t: (key: MessageKey) => string;
}) {
  const parent = role === 'parent';
  const [value, setValue] = useState(parent ? childName : code);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState(false);

  const submit = () => {
    setError(false);
    try {
      parent ? onParentLink(value.trim()) : onChildLink(value.trim());
    } catch {
      setError(true);
    }
  };

  return (
    <main className="page link-page">
      <button className="back-button" onClick={back}>‹</button>
      <div className="section-icon">{parent ? '⌂' : '⌁'}</div>
      <h1>{parent ? t('createLink') : t('joinFamily')}</h1>
      <p>{parent ? 'One parent · one child · one private routine.' : 'Use the private code shown on your parent’s phone.'}</p>
      <section className="card link-card">
        <IonInput
          label={parent ? t('childNickname') : t('linkingCode')}
          labelPlacement="stacked"
          fill="outline"
          value={value}
          onIonInput={(event) => setValue(String(event.detail.value ?? ''))}
        />
        {parent && (
          <>
            <div className="code-box"><small>{t('linkingCode')}</small><strong>{code}</strong><span>Share privately · expires after linking</span></div>
            <label className="consent-row">
              <IonCheckbox checked={consent} onIonChange={(event) => setConsent(event.detail.checked)} />
              <span>{t('consent')}</span>
            </label>
          </>
        )}
        {error && <p className="form-error">{t('invalidCode')}</p>}
      </section>
      <Disclaimer t={t} />
      <IonButton expand="block" disabled={!value.trim() || (parent && !consent)} onClick={submit}>
        {parent ? t('createContinue') : t('linkContinue')}
      </IonButton>
    </main>
  );
}
