import { useState } from 'react';
import { adherenceSummary } from '../domain/adherence';
import { primaryRoutineAssignment, type AppState } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { StatusPill } from '../components/StatusPill';
import { CodeBox } from '../components/CodeBox';

export function ParentDashboard({
  state,
  regenerateCode,
  requestCheck,
  t,
}: {
  state: AppState;
  regenerateCode: () => Promise<void>;
  requestCheck: () => Promise<void>;
  t: (key: MessageKey) => string;
}) {
  const summary = adherenceSummary(state.events);
  const assignment = primaryRoutineAssignment(state);
  const attention = state.events.filter((event) => ['uncertain', 'missed', 'expired', 'not_detected'].includes(event.status));
  const hasActiveCheck = state.events.some((event) => event.status === 'pending' && Date.parse(event.expiresAt) > Date.now());
  const [regenerating, setRegenerating] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'sent' | 'active' | 'error'>('idle');

  const regenerate = async () => {
    if (!window.confirm(t('regenerateCodeConfirm'))) return;
    setCodeError(false);
    setRegenerating(true);
    try { await regenerateCode(); }
    catch { setCodeError(true); }
    finally { setRegenerating(false); }
  };

  const requestNow = async () => {
    setRequesting(true);
    setRequestStatus('idle');
    try { await requestCheck(); setRequestStatus('sent'); }
    catch (error) {
      setRequestStatus(String(error).includes('active_check_exists') ? 'active' : 'error');
    } finally { setRequesting(false); }
  };
  return (
    <div className="content-screen">
      <header className="screen-header">
        <div><small>{t('overview')}</small><h1>{state.family.childName} · {t('routine')}</h1></div>
        <div className="avatar">{state.family.childName.charAt(0)}</div>
      </header>
      <section className="card summary-card">
        <div className="progress-ring" style={{ '--progress': `${summary.rate * 360}deg` } as React.CSSProperties}>
          <span>{Math.round(summary.rate * 100)}%</span>
        </div>
        <div><h2>{t('lastSeven')}</h2><p>{summary.successful} {t('clearChecks')} {summary.completed}</p><strong>{t('progressEncouragement')}</strong></div>
      </section>
      <section className="card plan-card">
        <div className="card-title"><h2>▣ {t('monitoringPlan')}</h2><button>{t('edit')}</button></div>
        {assignment && <p><b>{assignment.plan.checksPerDay}</b> {t('checksDay')} · <b>{assignment.plan.expiryMinutes}</b> {t('minutesRespond')}</p>}
        <div className="chips">{assignment?.plan.windows.map((window) => <span key={window.id}>◷ {window.start}–{window.end}</span>)}</div>
        <button className="request-check" disabled={requesting} onClick={() => { void requestNow(); }}>
          {requesting ? t('requestingCheck') : hasActiveCheck ? t('requestCheckAgain') : t('requestCheckNow')}
        </button>
        {hasActiveCheck && <p role="status" className="request-feedback">{t('requestCheckActive')}</p>}
        {requestStatus === 'sent' && <p role="status" aria-live="polite" className="request-feedback success">{t('requestCheckSent')}</p>}
        {requestStatus === 'active' && !hasActiveCheck && <p role="status" aria-live="polite" className="request-feedback">{t('requestCheckActive')}</p>}
        {requestStatus === 'error' && <p role="status" aria-live="polite" className="request-feedback error">{t('requestCheckError')}</p>}
      </section>
      {!state.family.childLinked && state.family.linkingCode ? (
        <CodeBox
          label={t('childLinkCode')}
          hint={t('childLinkCodeHint')}
          value={state.family.linkingCode}
          t={t}
          action={(
            <>
              <button type="button" className="regenerate-code" disabled={regenerating} onClick={() => { void regenerate(); }}>
                {regenerating ? t('regeneratingCode') : t('regenerateCode')}
              </button>
              {codeError ? <span className="form-error">{t('regenerateCodeError')}</span> : null}
            </>
          )}
        />
      ) : null}
      <div className="section-heading"><h2>{t('attention')}</h2><span>{attention.length}</span></div>
      {attention.map((event) => (
        <section className="card history-row" key={event.id}>
          <div>
            <strong>{new Intl.DateTimeFormat(state.locale === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.requestedAt))}</strong>
            <small>{event.reason}</small>
          </div>
          <StatusPill status={event.status} t={t} />
        </section>
      ))}
    </div>
  );
}
