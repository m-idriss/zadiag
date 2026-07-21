import { useMemo, useState } from 'react';
import { AppIcon } from '../components/Icon';
import type { RoutineResponseSubmission, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';

type StructuredDefinition = Extract<NonNullable<VerificationEvent['challenge']>['response'], { kind: 'confirmation' | 'checklist' }>;

export function RoutineResponseScreen({
  event,
  submit,
  back,
  done,
  t,
}: {
  event: VerificationEvent & { challenge: NonNullable<VerificationEvent['challenge']> & { response: StructuredDefinition } };
  submit: (submission: RoutineResponseSubmission) => Promise<void>;
  back: () => void;
  done: () => void;
  t: (key: MessageKey) => string;
}) {
  const definition = event.challenge.response;
  const [confirmation, setConfirmation] = useState<boolean>();
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [complete, setComplete] = useState(false);
  const ready = definition.kind === 'confirmation'
    ? confirmation !== undefined
    : definition.items.every((item) => checklist[item.id] !== undefined);
  const submission = useMemo<RoutineResponseSubmission | undefined>(() => {
    if (!ready) return undefined;
    return definition.kind === 'confirmation'
      ? { kind: 'confirmation', value: Boolean(confirmation) }
      : { kind: 'checklist', items: definition.items.map((item) => ({ id: item.id, value: checklist[item.id] })) };
  }, [checklist, confirmation, definition, ready]);

  const handleSubmit = async () => {
    if (!submission || busy) return;
    setBusy(true);
    setError(false);
    try {
      await submit(submission);
      setComplete(true);
    } catch (submissionError) {
      console.error(submissionError);
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  if (complete) {
    return (
      <div className="content-screen routine-response-screen">
        <section className="card routine-response-success" role="status">
          <span aria-hidden="true"><AppIcon name="check" /></span>
          <h1>{t('routineResponseSavedTitle')}</h1>
          <p>{t('routineResponseSavedHint')}</p>
          <button type="button" className="primary-action-button" onClick={done}>{t('backToday')}</button>
        </section>
      </div>
    );
  }

  return (
    <div className="content-screen routine-response-screen">
      <header className="screen-header routine-response-header">
        <button type="button" className="detail-back" onClick={back} aria-label={t('back')}><AppIcon name="chevron-back" /></button>
        <div><small>{event.challenge.name}</small><h1>{definition.prompt}</h1></div>
      </header>
      <form className="routine-response-form" onSubmit={(formEvent) => { formEvent.preventDefault(); void handleSubmit(); }}>
        {definition.kind === 'confirmation' ? (
          <fieldset className="card routine-response-question">
            <legend>{t('routineResponseChoose')}</legend>
            <div className="routine-response-options">
              <button type="button" aria-pressed={confirmation === true} className={confirmation === true ? 'active' : ''} onClick={() => setConfirmation(true)}>{definition.positiveLabel ?? t('yes')}</button>
              <button type="button" aria-pressed={confirmation === false} className={confirmation === false ? 'active' : ''} onClick={() => setConfirmation(false)}>{definition.negativeLabel ?? t('no')}</button>
            </div>
          </fieldset>
        ) : (
          <div className="routine-response-checklist">
            {definition.items.map((item) => (
              <fieldset className="card routine-response-question" key={item.id}>
                <legend>{item.label}</legend>
                <div className="routine-response-options">
                  <button type="button" aria-pressed={checklist[item.id] === true} className={checklist[item.id] === true ? 'active' : ''} onClick={() => setChecklist((current) => ({ ...current, [item.id]: true }))}>{t('yes')}</button>
                  <button type="button" aria-pressed={checklist[item.id] === false} className={checklist[item.id] === false ? 'active' : ''} onClick={() => setChecklist((current) => ({ ...current, [item.id]: false }))}>{t('no')}</button>
                </div>
              </fieldset>
            ))}
          </div>
        )}
        {error ? <p className="form-error" role="alert">{t('routineResponseSaveError')}</p> : null}
        <button type="submit" className="primary-action-button routine-response-submit" disabled={!ready || busy} aria-busy={busy}>{busy ? t('saving') : t('routineResponseSubmit')}</button>
      </form>
    </div>
  );
}
