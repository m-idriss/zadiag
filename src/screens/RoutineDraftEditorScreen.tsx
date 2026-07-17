import { useState, type FormEvent } from 'react';
import type { Locale, Routine, RoutineCategory, RoutineValidationMode } from '../domain/models';
import { createBlankRoutinePackage, DEFAULT_PRIVATE_ROUTINE_ACCENT, type RoutineDraft, type RoutinePackageV1 } from '../domain/routineDraft';
import { AppIcon } from '../components/Icon';
import { formatMessage, type MessageKey } from '../services/i18n';

type RoutineStep = NonNullable<Routine['instructionSteps']>[number];

const blankStep = (index: number): RoutineStep => ({ id: `step-${index + 1}`, icon: 'sparkles', title: '', description: '' });

const saveErrorKind = (error: unknown) => {
  const value = String(error).toLowerCase();
  if (value.includes('aborted') || value.includes('stale') || value.includes('changed on another device')) return 'conflict';
  if (value.includes('package_too_large')) return 'limit';
  if (value.includes('invalid-argument') || value.includes('invalid_package')) return 'invalid';
  return 'remote';
};

export function RoutineDraftEditorScreen({
  draft,
  locale,
  online,
  save,
  cancel,
  reload,
  t,
}: {
  draft?: RoutineDraft;
  locale: Locale;
  online: boolean;
  save: (routinePackage: RoutinePackageV1) => Promise<RoutineDraft>;
  cancel: () => void;
  reload: () => void;
  t: (key: MessageKey) => string;
}) {
  const [routinePackage, setRoutinePackage] = useState<RoutinePackageV1>(() => structuredClone(draft?.package ?? createBlankRoutinePackage(locale)));
  const [saving, setSaving] = useState(false);
  const [savedRevision, setSavedRevision] = useState<number>();
  const [savedValidation, setSavedValidation] = useState<RoutineDraft['validation']>();
  const [errorKind, setErrorKind] = useState<'conflict' | 'limit' | 'invalid' | 'remote'>();
  const routine = routinePackage.routine;
  const updateRoutine = (patch: Partial<Routine>) => setRoutinePackage((current) => ({ ...current, routine: { ...current.routine, ...patch } }));
  const updateAnalysis = (field: keyof NonNullable<Routine['analysis']>, value: string) => updateRoutine({ analysis: { expectedEvidence: '', detectedCriteria: '', notDetectedCriteria: '', uncertaintyCriteria: '', ...routine.analysis, [field]: value } });
  const updateStep = (index: number, patch: Partial<RoutineStep>) => updateRoutine({ instructionSteps: (routine.instructionSteps ?? []).map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step) });
  const changePrimaryLocale = (defaultLocale: Locale) => setRoutinePackage((current) => ({ ...current, defaultLocale, availableLocales: [defaultLocale] }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!online || saving) return;
    setSaving(true);
    setErrorKind(undefined);
    try {
      const saved = await save(routinePackage);
      setRoutinePackage(structuredClone(saved.package));
      setSavedRevision(saved.revision);
      setSavedValidation(saved.validation);
    } catch (error) {
      console.error(error);
      setErrorKind(saveErrorKind(error));
    } finally {
      setSaving(false);
    }
  };
  const field = (label: MessageKey, value: string | undefined, onChange: (value: string) => void, maximum: number, multiline = false) => (
    <label className="routine-draft-field">
      <span>{t(label)}</span>
      {multiline
        ? <textarea value={value ?? ''} maxLength={maximum} onChange={(event) => onChange(event.target.value)} />
        : <input value={value ?? ''} maxLength={maximum} onChange={(event) => onChange(event.target.value)} />}
      <small>{formatMessage(t('routineDraftCharacterCount'), { count: value?.length ?? 0, maximum })}</small>
    </label>
  );

  return (
    <div className="content-screen routine-draft-editor-screen">
      <header className="screen-header routine-draft-editor-header">
        <button type="button" className="detail-back" onClick={cancel} aria-label={t('back')}><AppIcon name="chevron-back" /></button>
        <div><small>{t(draft ? 'routineDraftEditEyebrow' : 'routineDraftCreateEyebrow')}</small><h1>{t('routineDraftEditorTitle')}</h1></div>
      </header>
      <form className="routine-draft-form" onSubmit={(event) => { void submit(event); }}>
        <section className="card routine-draft-editor-section">
          <h2>{t('routineDraftMetadata')}</h2>
          <label className="routine-draft-field"><span>{t('routineDraftPrimaryLocale')}</span><select value={routinePackage.defaultLocale} onChange={(event) => changePrimaryLocale(event.target.value as Locale)}><option value="en">English</option><option value="fr">Français</option></select></label>
          {field('routineDraftName', routine.name, (value) => updateRoutine({ name: value }), 120)}
          {field('routineDraftDescription', routine.description, (value) => updateRoutine({ description: value }), 500, true)}
          {field('routineDraftResponsibleName', routine.responsibleName, (value) => updateRoutine({ responsibleName: value }), 120)}
        </section>
        <section className="card routine-draft-editor-section">
          <h2>{t('routineDraftAppearance')}</h2>
          {field('routineDraftIcon', routine.icon, (value) => updateRoutine({ icon: value }), 32)}
          <label className="routine-draft-field"><span>{t('routineDraftAccentColor')}</span><input type="color" value={routine.accentColor ?? DEFAULT_PRIVATE_ROUTINE_ACCENT} onChange={(event) => updateRoutine({ accentColor: event.target.value.toUpperCase() })} /></label>
          <label className="routine-draft-field"><span>{t('routineDraftCategory')}</span><select value={routine.category ?? 'custom'} onChange={(event) => updateRoutine({ category: event.target.value as RoutineCategory })}>{(['dental', 'wellness', 'medication', 'activity', 'custom'] as const).map((category) => <option value={category} key={category}>{t(category === 'dental' ? 'routineCategoryDental' : category === 'wellness' ? 'routineCategoryWellness' : category === 'medication' ? 'routineCategoryMedication' : category === 'activity' ? 'routineCategoryActivity' : 'routineCategoryCustom')}</option>)}</select></label>
        </section>
        <section className="card routine-draft-editor-section">
          <h2>{t('routineDraftInstructions')}</h2>
          {field('routineDraftInstructions', routine.instructions, (value) => updateRoutine({ instructions: value }), 2000, true)}
          {(routine.instructionSteps ?? []).map((step, index) => <fieldset className="routine-draft-step" key={step.id}><legend>{formatMessage(t('routineDraftStep'), { number: index + 1 })}</legend>{field('routineDraftStepIcon', step.icon, (value) => updateStep(index, { icon: value }), 32)}{field('routineDraftStepTitle', step.title, (value) => updateStep(index, { title: value }), 120)}{field('routineDraftStepDescription', step.description, (value) => updateStep(index, { description: value }), 500, true)}{(routine.instructionSteps?.length ?? 0) > 2 ? <button type="button" onClick={() => updateRoutine({ instructionSteps: routine.instructionSteps?.filter((_, stepIndex) => stepIndex !== index) })}>{t('routineDraftRemoveStep')}</button> : null}</fieldset>)}
          {(routine.instructionSteps?.length ?? 0) < 4 ? <button type="button" className="routine-draft-secondary-action" onClick={() => updateRoutine({ instructionSteps: [...(routine.instructionSteps ?? []), blankStep(routine.instructionSteps?.length ?? 0)] })}>{t('routineDraftAddStep')}</button> : null}
        </section>
        <section className="card routine-draft-editor-section">
          <h2>{t('routineDraftExpectedProof')}</h2>
          {field('routineDraftProofType', routine.proofType, (value) => updateRoutine({ proofType: value }), 50)}
          {field('routineDraftProofExample', routine.proofExample, (value) => updateRoutine({ proofExample: value }), 500, true)}
          {field('routineDraftExpectedEvidence', routine.analysis?.expectedEvidence, (value) => updateAnalysis('expectedEvidence', value), 2000, true)}
          {field('routineDraftDetectedCriteria', routine.analysis?.detectedCriteria, (value) => updateAnalysis('detectedCriteria', value), 2000, true)}
          {field('routineDraftNotDetectedCriteria', routine.analysis?.notDetectedCriteria, (value) => updateAnalysis('notDetectedCriteria', value), 2000, true)}
          {field('routineDraftUncertaintyCriteria', routine.analysis?.uncertaintyCriteria, (value) => updateAnalysis('uncertaintyCriteria', value), 2000, true)}
          <label className="routine-draft-field"><span>{t('routineDraftValidationMode')}</span><select value={routine.recommendedValidationMode ?? 'ai'} onChange={(event) => updateRoutine({ recommendedValidationMode: event.target.value as RoutineValidationMode })}><option value="ai">{t('validationAi')}</option><option value="auto">{t('validationAuto')}</option></select></label>
        </section>
        {!online ? <p className="routine-draft-save-state" role="status">{t('routineDraftOffline')}</p> : null}
        {errorKind ? <div className="routine-draft-save-state error" role="alert"><p>{t(errorKind === 'conflict' ? 'routineDraftConflict' : errorKind === 'limit' ? 'routineDraftLimitError' : errorKind === 'invalid' ? 'routineDraftInvalidError' : 'routineDraftSaveError')}</p>{errorKind === 'conflict' ? <button type="button" onClick={reload}>{t('routineDraftReload')}</button> : null}</div> : null}
        {savedRevision ? <p className="routine-draft-save-state success" role="status">{formatMessage(t(savedValidation?.status === 'valid' ? 'routineDraftSavedValid' : 'routineDraftSavedIncomplete'), { revision: savedRevision, count: savedValidation?.issues.length ?? 0 })}</p> : null}
        <div className="routine-draft-editor-actions"><button type="button" onClick={cancel}>{t('cancel')}</button><button type="submit" className="primary-action-button" disabled={!online || saving}>{saving ? t('routineDraftSaving') : t(draft ? 'routineDraftSave' : 'routineDraftCreate')}</button></div>
      </form>
    </div>
  );
}
