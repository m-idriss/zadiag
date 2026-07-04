import { useState } from 'react';
import { adherenceSummary } from '../domain/adherence';
import type { AppState } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { AppIcon } from '../components/Icon';
import { CodeBox } from '../components/CodeBox';
import { RoutineHistoryPanel } from '../components/RoutineHistoryPanel';

export function ParentDashboard({
  state,
  regenerateCode,
  onCreateRoutine,
  t,
}: {
  state: AppState;
  regenerateCode: () => Promise<void>;
  onCreateRoutine?: () => void;
  t: (key: MessageKey) => string;
}) {
  const [regenerating, setRegenerating] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const summary = adherenceSummary(state.events);

  const regenerate = async () => {
    if (!window.confirm(t('regenerateCodeConfirm'))) return;
    setCodeError(false);
    setRegenerating(true);
    try {
      await regenerateCode();
    } catch {
      setCodeError(true);
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="content-screen parent-overview-screen">
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

      {!state.routineAssignments.length && onCreateRoutine ? (
        <section className="card parent-create-routine-card">
          <div className="parent-create-routine-icon" aria-hidden="true">
            <AppIcon name="add" />
          </div>
          <div className="parent-create-routine-copy">
            <div>
              <small>{t('routineSetupEyebrow')}</small>
              <h2>{t('createFirstRoutine')}</h2>
            </div>
            <p>{t('createFirstRoutineHint')}</p>
          </div>
          <button type="button" className="request-check" onClick={onCreateRoutine}>{t('chooseRoutine')}</button>
        </section>
      ) : null}

      <RoutineHistoryPanel assignments={state.routineAssignments} events={state.events} locale={state.locale} t={t} />
    </div>
  );
}
