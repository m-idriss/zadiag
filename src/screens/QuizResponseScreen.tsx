import { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '../components/Icon';
import type { RoutineQuizResult, VerificationEvent } from '../domain/models';
import { formatMessage, type MessageKey } from '../services/i18n';

type QuizEvent = VerificationEvent & { challenge: NonNullable<VerificationEvent['challenge']> & { response: Extract<NonNullable<VerificationEvent['challenge']>['response'], { kind: 'quiz' }> } };

export function QuizResponseScreen({ event, prepare, submit, report, back, done, t }: {
  event: QuizEvent;
  prepare: () => Promise<void>;
  submit: (answers: Array<{ questionId: string; choiceId: string }>) => Promise<RoutineQuizResult | undefined>;
  report?: (questionId: string) => Promise<void>;
  back: () => void;
  done: () => void;
  t: (key: MessageKey) => string;
}) {
  const [preparing, setPreparing] = useState(!event.challenge.quiz);
  const [prepareError, setPrepareError] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [result, setResult] = useState<RoutineQuizResult>();
  const [reported, setReported] = useState<Set<string>>(new Set());
  const questions = event.challenge.quiz?.questions ?? [];
  const ready = questions.length > 0 && questions.every((question) => Boolean(answers[question.id]));
  const correctionByQuestion = useMemo(() => new Map(result?.corrections.map((correction) => [correction.questionId, correction]) ?? []), [result]);

  const prepareQuiz = async () => {
    setPreparing(true);
    setPrepareError(false);
    try { await prepare(); } catch (error) { console.error(error); setPrepareError(true); } finally { setPreparing(false); }
  };

  useEffect(() => {
    if (!event.challenge.quiz) void prepareQuiz();
    // Preparation is idempotent for this immutable check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const send = async () => {
    if (!ready || submitting) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      const next = await submit(questions.map((question) => ({ questionId: question.id, choiceId: answers[question.id] })));
      if (next) setResult(next);
    } catch (error) { console.error(error); setSubmitError(true); } finally { setSubmitting(false); }
  };

  return (
    <div className="content-screen quiz-response-screen">
      <header className="screen-header routine-response-header">
        <button type="button" className="detail-back" onClick={back} aria-label={t('back')}><AppIcon name="chevron-back" /></button>
        <div><small>{event.challenge.name}</small><h1>{result ? t('quizResultTitle') : event.challenge.response.prompt}</h1></div>
      </header>
      {preparing ? <section className="card quiz-preparing" role="status"><span className="button-spinner" aria-hidden="true" /><h2>{t('quizPreparing')}</h2><p>{t('quizPreparingHint')}</p></section> : null}
      {prepareError ? <section className="card quiz-preparing" role="alert"><h2>{t('quizUnavailable')}</h2><p>{t('quizUnavailableHint')}</p><button type="button" className="primary-action-button" onClick={() => { void prepareQuiz(); }}>{t('retryNow')}</button></section> : null}
      {!preparing && !prepareError && questions.length ? <form className="quiz-response-form" onSubmit={(formEvent) => { formEvent.preventDefault(); void send(); }}>
        {result ? <section className="card quiz-score" role="status"><strong>{Math.round(result.score * 100)}%</strong><div><h2>{formatMessage(t('quizScore'), { correct: result.correctCount, total: result.totalCount })}</h2><p>{t('quizScoreHint')}</p></div></section> : null}
        {questions.map((question, index) => {
          const correction = correctionByQuestion.get(question.id);
          return <fieldset className="card quiz-question" key={question.id}><legend>{formatMessage(t('quizQuestion'), { number: index + 1, total: questions.length })}</legend><h2>{question.prompt}</h2><div>{question.choices.map((choice) => {
            const selected = answers[question.id] === choice.id;
            const correct = correction?.correctChoiceId === choice.id;
            return <button type="button" key={choice.id} disabled={Boolean(result)} aria-pressed={selected} className={[selected ? 'selected' : '', correction && correct ? 'correct' : '', correction && selected && !correct ? 'incorrect' : ''].filter(Boolean).join(' ')} onClick={() => setAnswers((current) => ({ ...current, [question.id]: choice.id }))}>{choice.label}{correction && correct ? <AppIcon name="check" /> : null}</button>;
          })}</div>{correction ? <p className={correction.correct ? 'quiz-explanation correct' : 'quiz-explanation'}>{correction.explanation}</p> : null}{correction && report ? <button type="button" className="quiz-report" disabled={reported.has(question.id)} onClick={() => { void report(question.id).then(() => setReported((current) => new Set(current).add(question.id))); }}>{t(reported.has(question.id) ? 'quizReported' : 'quizReport')}</button> : null}</fieldset>;
        })}
        {submitError ? <p className="form-error" role="alert">{t('quizSubmitError')}</p> : null}
        {result ? <button type="button" className="primary-action-button quiz-submit" onClick={done}>{t('backToday')}</button> : <button type="submit" className="primary-action-button quiz-submit" disabled={!ready || submitting} aria-busy={submitting}>{submitting ? t('saving') : t('quizSubmit')}</button>}
      </form> : null}
    </div>
  );
}
