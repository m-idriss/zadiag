import { useState, type CSSProperties, type FormEvent } from 'react';
import type { Locale, Routine, RoutineCategory } from '../domain/models';
import { createBlankRoutinePackage, DEFAULT_PRIVATE_ROUTINE_ACCENT, prepareMinimalRoutinePackage, routinePackageInLocale, type RoutineDraft, type RoutinePackageV1 } from '../domain/routineDraft';
import { AppIcon, routineIconName } from '../components/Icon';
import { formatMessage, type MessageKey } from '../services/i18n';
import type { RoutineContentEditTarget } from './routineContentEditTarget';

const routineCategories = ['dental', 'wellness', 'medication', 'activity', 'custom'] as const;
const categoryIcons: Record<RoutineCategory, string> = { dental: 'tooth', wellness: 'water', medication: 'medical', activity: 'fitness', custom: 'sparkles' };
const categoryLabels: Record<RoutineCategory, MessageKey> = { dental: 'routineCategoryDental', wellness: 'routineCategoryWellness', medication: 'routineCategoryMedication', activity: 'routineCategoryActivity', custom: 'routineCategoryCustom' };

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
  target,
  t,
}: {
  draft?: RoutineDraft;
  locale: Locale;
  online: boolean;
  save: (routinePackage: RoutinePackageV1) => Promise<RoutineDraft>;
  cancel: () => void;
  reload: () => void;
  target?: RoutineContentEditTarget;
  t: (key: MessageKey) => string;
}) {
  const [routinePackage, setRoutinePackage] = useState<RoutinePackageV1>(() => routinePackageInLocale(draft?.package ?? createBlankRoutinePackage(locale), locale));
  const [saving, setSaving] = useState(false);
  const [savedRevision, setSavedRevision] = useState<number>();
  const [savedValidation, setSavedValidation] = useState<RoutineDraft['validation']>();
  const [errorKind, setErrorKind] = useState<'conflict' | 'limit' | 'invalid' | 'remote'>();
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [initialInstruction] = useState(routinePackage.routine.instructions ?? '');
  const routine = routinePackage.routine;
  const updateRoutine = (patch: Partial<Routine>) => setRoutinePackage((current) => ({ ...current, routine: { ...current.routine, ...patch } }));
  const updateCategory = (category: RoutineCategory) => updateRoutine({ category, icon: categoryIcons[category] });
  const targetStepIndex = target?.kind === 'step' ? routine.instructionSteps?.findIndex((step) => step.id === target.stepId) ?? -1 : -1;
  const targetStep = targetStepIndex >= 0 ? routine.instructionSteps?.[targetStepIndex] : undefined;
  const updateTargetStep = (patch: Partial<NonNullable<Routine['instructionSteps']>[number]>) => {
    if (targetStepIndex < 0) return;
    updateRoutine({ instructionSteps: routine.instructionSteps?.map((step, index) => index === targetStepIndex ? { ...step, ...patch } : step) });
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!online || saving) return;
    setSaving(true);
    setErrorKind(undefined);
    try {
      const prepared = prepareMinimalRoutinePackage(routinePackage, routine.instructions !== initialInstruction);
      const saved = await save(prepared);
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
  const accentColor = /^#[0-9a-f]{6}$/i.test(routine.accentColor ?? '') ? routine.accentColor! : DEFAULT_PRIVATE_ROUTINE_ACCENT;
  const field = (label: MessageKey, value: string | undefined, maximum: number, onChange: (value: string) => void, multiline = false, autoFocus = false) => (
    <label className="routine-draft-field">
      <span>{t(label)}</span>
      {multiline
        ? <textarea autoFocus={autoFocus} value={value ?? ''} maxLength={maximum} onChange={(event) => onChange(event.target.value)} />
        : <input autoFocus={autoFocus} value={value ?? ''} maxLength={maximum} onChange={(event) => onChange(event.target.value)} />}
    </label>
  );
  const identityFields = <div className="routine-draft-customization routine-draft-customization-direct" style={{ '--routine-accent': accentColor } as CSSProperties}>
    <div className="routine-draft-name-row">
      <span className="settings-row-icon routine-icon" aria-hidden="true"><AppIcon name={routineIconName(routine.icon)} /></span>
      <label className="routine-draft-field"><span>{t('routineDraftName')}</span><input autoFocus={target?.kind === 'identity'} value={routine.name} maxLength={120} placeholder={t('routineDraftNamePlaceholder')} onChange={(event) => updateRoutine({ name: event.target.value })} /></label>
    </div>
    <div className="routine-draft-appearance-fields">
      <label className="routine-draft-field"><span>{t('routineDraftCategory')}</span><select value={routine.category ?? 'custom'} onChange={(event) => updateCategory(event.target.value as RoutineCategory)}>{routineCategories.map((category) => <option value={category} key={category}>{t(categoryLabels[category])}</option>)}</select></label>
      <label className="routine-draft-field routine-draft-color-field"><span>{t('routineDraftAccentColor')}</span><input type="color" value={accentColor} onChange={(event) => updateRoutine({ accentColor: event.target.value.toUpperCase() })} /></label>
    </div>
  </div>;
  const targetTitle = target?.kind === 'identity'
    ? t('routineDraftCustomize')
    : target?.kind === 'description'
      ? t('routineSummary')
      : target?.kind === 'proof'
        ? t('expectedProof')
        : target?.kind === 'responsible'
          ? t('responsible')
          : target?.kind === 'step'
            ? formatMessage(t('routineDraftEditStep'), { number: targetStepIndex + 1 })
            : t('instructions');
  const targetedFields = target?.kind === 'identity'
    ? identityFields
    : target?.kind === 'description'
      ? field('routineDraftDescription', routine.description, 500, (value) => updateRoutine({ description: value }), true, true)
      : target?.kind === 'proof'
        ? <div className="routine-draft-target-fields">{field('routineDraftProofType', routine.proofType, 50, (value) => updateRoutine({ proofType: value }), false, true)}{field('routineCatalogProofExample', routine.proofExample, 500, (value) => updateRoutine({ proofExample: value }), true)}</div>
        : target?.kind === 'responsible'
          ? field('responsible', routine.responsibleName, 120, (value) => updateRoutine({ responsibleName: value }), false, true)
          : target?.kind === 'step'
            ? <div className="routine-draft-target-fields">{field('routineDraftStepTitle', targetStep?.title, 120, (value) => updateTargetStep({ title: value }), false, true)}{field('routineDraftStepDescription', targetStep?.description, 500, (value) => updateTargetStep({ description: value }), true)}</div>
            : field('routineDraftInstructions', routine.instructions, 2000, (value) => updateRoutine({ instructions: value }), true, true);

  return (
    <div className="content-screen routine-draft-editor-screen">
      <header className="screen-header routine-draft-editor-header">
        <button type="button" className="detail-back" onClick={cancel} aria-label={t('back')}><AppIcon name="chevron-back" /></button>
        <div><small>{t(target ? 'routineContentEdit' : draft ? 'routineDraftEditEyebrow' : 'routineDraftCreateEyebrow')}</small><h1>{target ? targetTitle : t('routineDraftEditorTitle')}</h1></div>
      </header>
      <form className="routine-draft-form" onSubmit={(event) => { void submit(event); }}>
        {target ? <section className="card routine-draft-editor-section routine-draft-targeted">{targetedFields}</section> : <section className="card routine-draft-editor-section routine-draft-essential">
          <h2>{t('routineDraftEssentialTitle')}</h2>
          <textarea className="routine-draft-main-instruction" aria-label={t('routineDraftInstructions')} placeholder={t('routineDraftInstructionPlaceholder')} value={routine.instructions ?? ''} maxLength={2000} onChange={(event) => updateRoutine({ instructions: event.target.value })} />
          <button type="button" className="routine-draft-customize" aria-expanded={advancedExpanded} onClick={() => setAdvancedExpanded((expanded) => !expanded)}>{t(advancedExpanded ? 'routineDraftHideAdvanced' : 'routineDraftCustomize')}<AppIcon name="chevron-down" className={advancedExpanded ? 'expanded' : undefined} /></button>
          {advancedExpanded ? identityFields : null}
        </section>}
        {!online ? <p className="routine-draft-save-state" role="status">{t('routineDraftOffline')}</p> : null}
        {errorKind ? <div className="routine-draft-save-state error" role="alert"><p>{t(errorKind === 'conflict' ? 'routineDraftConflict' : errorKind === 'limit' ? 'routineDraftLimitError' : errorKind === 'invalid' ? 'routineDraftInvalidError' : 'routineDraftSaveError')}</p>{errorKind === 'conflict' ? <button type="button" onClick={reload}>{t('routineDraftReload')}</button> : null}</div> : null}
        {savedRevision ? <p className="routine-draft-save-state success" role="status">{formatMessage(t(savedValidation?.status === 'valid' ? 'routineDraftSavedValid' : 'routineDraftSavedIncomplete'), { revision: savedRevision, count: savedValidation?.issues.length ?? 0 })}</p> : null}
        <div className="routine-draft-editor-actions"><button type="button" onClick={cancel}>{t('cancel')}</button><button type="submit" className="primary-action-button" disabled={!online || saving}>{saving ? t('routineDraftSaving') : t(draft ? 'routineDraftSave' : 'routineDraftCreate')}</button></div>
      </form>
    </div>
  );
}
