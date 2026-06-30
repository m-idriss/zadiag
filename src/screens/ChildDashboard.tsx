import { IonButton } from '@ionic/react';
import { adherenceSummary } from '../domain/adherence';
import type { AppState, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { Disclaimer } from '../components/Disclaimer';

export function ChildDashboard({
  state,
  active,
  start,
  t,
}: {
  state: AppState;
  active?: VerificationEvent;
  start: () => void;
  t: (key: MessageKey) => string;
}) {
  const summary = adherenceSummary(state.events);
  return (
    <div className="content-screen child-home">
      <header className="screen-header"><div><h1>{t('hi')} {state.family.childName} 👋</h1><p>{t('smallCheck')}</p></div></header>
      <section className="check-card">
        <span className="eyebrow">{active ? t('checkReady') : 'ALL DONE FOR NOW'}</span>
        <h2>{active ? t('quickPhoto') : 'Nice work!'}</h2>
        <p>{active ? t('cameraHint') : 'We’ll let you know when it is time for the next check.'}</p>
        {active && <IonButton expand="block" color="light" onClick={start}>◉&nbsp; {t('startCheck')}</IonButton>}
        {active && <small>About 18 minutes left</small>}
      </section>
      <section className="card week-card"><h2>{t('thisWeek')}</h2><progress max="1" value={summary.rate} /><p>{summary.successful} clear checks so far. Every check helps build the routine.</p></section>
      <Disclaimer t={t} />
    </div>
  );
}
