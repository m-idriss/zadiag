import { useState, type CSSProperties, type FormEvent } from 'react';
import type { Locale, Routine, RoutineCategory, RoutineResponseDefinition } from '../domain/models';
import { createBlankRoutinePackage, DEFAULT_PRIVATE_ROUTINE_ACCENT, prepareMinimalRoutinePackage, routinePackageInLocale, type RoutineDraft, type RoutinePackageV1 } from '../domain/routineDraft';
import { AppIcon, routineIconName } from '../components/Icon';
import { formatMessage, type MessageKey } from '../services/i18n';
import type { AiRoutineProposal, AiRoutineResponseKind } from '../services/contracts';

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
  approve,
  aiAvailable = false,
  quizAvailable = true,
  planSummary,
  propose,
  t,
}: {
  draft?: RoutineDraft;
  locale: Locale;
  online: boolean;
  save: (routinePackage: RoutinePackageV1) => Promise<RoutineDraft>;
  cancel: () => void;
  reload: () => void;
  approve?: (draft: RoutineDraft) => Promise<void>;
  aiAvailable?: boolean;
  quizAvailable?: boolean;
  planSummary?: string;
  propose?: (input: { intent: string; preferredResponseKind?: AiRoutineResponseKind; refinement?: string; currentProposal?: AiRoutineProposal }) => Promise<AiRoutineProposal>;
  t: (key: MessageKey) => string;
}) {
  const [routinePackage, setRoutinePackage] = useState<RoutinePackageV1>(() => routinePackageInLocale(draft?.package ?? createBlankRoutinePackage(locale), locale));
  const [saving, setSaving] = useState(false);
  const [savedRevision, setSavedRevision] = useState<number>();
  const [savedValidation, setSavedValidation] = useState<RoutineDraft['validation']>();
  const [errorKind, setErrorKind] = useState<'conflict' | 'limit' | 'invalid' | 'remote'>();
  const [advancedExpanded, setAdvancedExpanded] = useState(false);
  const [responseTouched, setResponseTouched] = useState(Boolean(draft));
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [aiReason, setAiReason] = useState<string>();
  const [uncertainties, setUncertainties] = useState<string[]>([]);
  const [refinement, setRefinement] = useState('');
  const [initialInstruction] = useState(routinePackage.routine.instructions ?? '');
  const routine = routinePackage.routine;
  const updateRoutine = (patch: Partial<Routine>) => setRoutinePackage((current) => ({ ...current, routine: { ...current.routine, ...patch } }));
  const updateIntent = (instructions: string) => setRoutinePackage((current) => {
    const previousInstructions = current.routine.instructions ?? '';
    const response = current.routine.response;
    const nextResponse = response && response.kind !== 'photo' && response.prompt === previousInstructions
      ? { ...response, prompt: instructions }
      : response;
    return { ...current, routine: { ...current.routine, instructions, response: nextResponse } };
  });
  const chooseResponse = (kind: 'photo' | 'confirmation' | 'quiz') => {
    const prompt = routine.instructions?.trim() || t('routineComposerResponsePrompt');
    const response: RoutineResponseDefinition = kind === 'photo'
      ? { kind: 'photo' }
      : kind === 'confirmation'
        ? { kind: 'confirmation', prompt }
        : { kind: 'quiz', prompt, topic: routine.instructions?.trim() || t('routineComposerQuizTopic'), mode: 'generated', questionCount: 3, choiceCount: 3 };
    updateRoutine({ response });
    setResponseTouched(true);
  };
  const currentAiProposal = (): AiRoutineProposal => ({
    name: routine.name || participantPreviewName,
    instructions: routine.instructions ?? '',
    description: routine.description ?? routine.instructions ?? '',
    category: routine.category ?? 'custom',
    response: routine.response?.kind === 'photo' || !routine.response
      ? { kind: 'photo', prompt: routine.instructions ?? '' }
      : routine.response.kind === 'quiz'
        ? { kind: 'quiz', prompt: routine.response.prompt, topic: routine.response.topic }
        : routine.response.kind === 'checklist'
          ? { kind: 'checklist', prompt: routine.response.prompt, items: routine.response.items }
          : { kind: 'confirmation', prompt: routine.response.prompt },
    responseReason: aiReason ?? '',
    uncertainties,
  });
  const applyAiProposal = (proposal: AiRoutineProposal) => {
    const response: RoutineResponseDefinition = proposal.response.kind === 'photo'
      ? { kind: 'photo' }
      : proposal.response.kind === 'confirmation'
        ? { kind: 'confirmation', prompt: proposal.response.prompt }
        : proposal.response.kind === 'checklist'
          ? { kind: 'checklist', prompt: proposal.response.prompt, items: proposal.response.items ?? [] }
          : { kind: 'quiz', prompt: proposal.response.prompt, topic: proposal.response.topic ?? proposal.instructions, mode: 'generated', questionCount: 3, choiceCount: 3 };
    setRoutinePackage((current) => ({ ...current, routine: { ...current.routine, name: proposal.name, instructions: proposal.instructions, description: proposal.description, category: proposal.category, icon: categoryIcons[proposal.category], response } }));
    setAiReason(proposal.responseReason);
    setUncertainties(proposal.uncertainties);
    setResponseTouched(true);
  };
  const requestAiProposal = async (isRefinement: boolean) => {
    if (!propose || !routine.instructions?.trim() || aiBusy) return;
    setAiBusy(true);
    setAiError(false);
    try {
      const proposal = await propose({
        intent: routine.instructions.trim(),
        ...(responseTouched || !quizAvailable ? { preferredResponseKind: responseKind as AiRoutineResponseKind } : {}),
        ...(isRefinement && refinement.trim() ? { refinement: refinement.trim(), currentProposal: currentAiProposal() } : {}),
      });
      applyAiProposal(proposal);
      if (isRefinement) setRefinement('');
    } catch (error) { console.error(error); setAiError(true); } finally { setAiBusy(false); }
  };
  const useChecklist = (enabled: boolean) => {
    const prompt = routine.response?.kind === 'confirmation' || routine.response?.kind === 'checklist'
      ? routine.response.prompt
      : routine.instructions?.trim() || t('routineComposerResponsePrompt');
    updateRoutine({ response: enabled
      ? { kind: 'checklist', prompt, items: [{ id: 'item-1', label: routine.instructions?.trim() || t('routineComposerChecklistItem') }] }
      : { kind: 'confirmation', prompt } });
  };
  const updateChecklistItem = (id: string, label: string) => {
    if (routine.response?.kind !== 'checklist') return;
    updateRoutine({ response: { ...routine.response, items: routine.response.items.map((item) => item.id === id ? { ...item, label } : item) } });
  };
  const addChecklistItem = () => {
    if (routine.response?.kind !== 'checklist' || routine.response.items.length >= 20) return;
    let index = routine.response.items.length + 1;
    while (routine.response.items.some((item) => item.id === `item-${index}`)) index += 1;
    updateRoutine({ response: { ...routine.response, items: [...routine.response.items, { id: `item-${index}`, label: '' }] } });
  };
  const removeChecklistItem = (id: string) => {
    if (routine.response?.kind !== 'checklist' || routine.response.items.length <= 1) return;
    updateRoutine({ response: { ...routine.response, items: routine.response.items.filter((item) => item.id !== id) } });
  };
  const updateCategory = (category: RoutineCategory) => updateRoutine({ category, icon: categoryIcons[category] });
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!online || saving) return;
    setSaving(true);
    setErrorKind(undefined);
    try {
      const normalized = structuredClone(routinePackage);
      const instruction = normalized.routine.instructions?.trim() ?? '';
      if (normalized.routine.response && normalized.routine.response.kind !== 'photo') {
        normalized.routine.response.prompt = normalized.routine.response.prompt.trim() || instruction;
        if (normalized.routine.response.kind === 'quiz') normalized.routine.response.topic = normalized.routine.response.topic.trim() || instruction;
      }
      const prepared = prepareMinimalRoutinePackage(normalized, routine.instructions !== initialInstruction);
      const saved = await save(prepared);
      setRoutinePackage(structuredClone(saved.package));
      setSavedRevision(saved.revision);
      setSavedValidation(saved.validation);
      if (approve) {
        await approve(saved);
        cancel();
      }
    } catch (error) {
      console.error(error);
      setErrorKind(saveErrorKind(error));
    } finally {
      setSaving(false);
    }
  };
  const accentColor = /^#[0-9a-f]{6}$/i.test(routine.accentColor ?? '') ? routine.accentColor! : DEFAULT_PRIVATE_ROUTINE_ACCENT;
  const responseKind = routine.response?.kind ?? 'photo';
  const participantPreviewName = routine.name.trim() || routine.instructions?.split(/[.!?\n]/)[0]?.trim() || t('routineDraftEditorTitle');
  const identityFields = <div className="routine-draft-customization routine-draft-customization-direct" style={{ '--routine-accent': accentColor } as CSSProperties}>
    <div className="routine-draft-name-row">
      <span className="settings-row-icon routine-icon" aria-hidden="true"><AppIcon name={routineIconName(routine.icon)} /></span>
      <label className="routine-draft-field"><span>{t('routineDraftName')}</span><input value={routine.name} maxLength={120} placeholder={t('routineDraftNamePlaceholder')} onChange={(event) => updateRoutine({ name: event.target.value })} /></label>
    </div>
    <div className="routine-draft-appearance-fields">
      <label className="routine-draft-field"><span>{t('routineDraftCategory')}</span><select value={routine.category ?? 'custom'} onChange={(event) => updateCategory(event.target.value as RoutineCategory)}>{routineCategories.map((category) => <option value={category} key={category}>{t(categoryLabels[category])}</option>)}</select></label>
      <label className="routine-draft-field routine-draft-color-field"><span>{t('routineDraftAccentColor')}</span><input type="color" value={accentColor} onChange={(event) => updateRoutine({ accentColor: event.target.value.toUpperCase() })} /></label>
    </div>
  </div>;
  return (
    <div className="content-screen routine-draft-editor-screen">
      <header className="screen-header routine-draft-editor-header">
        <button type="button" className="detail-back" onClick={cancel} aria-label={t('back')}><AppIcon name="chevron-back" /></button>
        <div><small>{t(draft ? 'routineDraftEditEyebrow' : 'routineDraftCreateEyebrow')}</small><h1>{t('routineDraftEditorTitle')}</h1></div>
      </header>
      <form className="routine-draft-form" onSubmit={(event) => { void submit(event); }}>
        <section className="card routine-draft-editor-section routine-draft-essential routine-composer-essential">
          <h2>{t('routineDraftEssentialTitle')}</h2>
          <textarea className="routine-draft-main-instruction" aria-label={t('routineDraftInstructions')} placeholder={t('routineDraftInstructionPlaceholder')} value={routine.instructions ?? ''} maxLength={2000} onChange={(event) => updateIntent(event.target.value)} />
          <div className="routine-composer-ai-actions">
            <button type="button" disabled={!aiAvailable || !online || aiBusy || !routine.instructions?.trim()} onClick={() => { void requestAiProposal(false); }}><AppIcon name="sparkles" />{aiBusy ? t('routineComposerAiWorking') : t('routineComposerAiPropose')}</button>
            {!aiAvailable ? <small>{t('routineComposerAiDisabled')}</small> : null}
            {aiError ? <small role="alert">{t('routineComposerAiError')}</small> : null}
          </div>
          <div className="routine-composer-response">
            <h2>{t('routineComposerResponseTitle')}</h2>
            <div className="routine-composer-response-options" role="group" aria-label={t('routineComposerResponseTitle')}>
              <button type="button" className={responseKind === 'photo' ? 'active' : ''} aria-pressed={responseKind === 'photo'} onClick={() => chooseResponse('photo')}><AppIcon name="camera" /><strong>{t('routineComposerPhoto')}</strong><span>{t('routineComposerPhotoHint')}</span></button>
              <button type="button" className={responseKind === 'confirmation' || responseKind === 'checklist' ? 'active' : ''} aria-pressed={responseKind === 'confirmation' || responseKind === 'checklist'} onClick={() => chooseResponse('confirmation')}><AppIcon name="check" /><strong>{t('routineComposerConfirmation')}</strong><span>{t('routineComposerConfirmationHint')}</span></button>
              <button type="button" disabled={!quizAvailable} className={responseKind === 'quiz' ? 'active' : ''} aria-pressed={responseKind === 'quiz'} onClick={() => chooseResponse('quiz')}><AppIcon name="sparkles" /><strong>{t('routineComposerQuiz')}</strong><span>{t('routineComposerQuizHint')}</span></button>
            </div>
            {!quizAvailable ? <small className="routine-composer-capability-note">{t('routineComposerQuizDisabled')}</small> : null}
            {responseKind === 'confirmation' || responseKind === 'checklist' ? <div className="routine-composer-confirmation-mode" role="group" aria-label={t('routineComposerConfirmationMode')}><button type="button" className={responseKind === 'confirmation' ? 'active' : ''} aria-pressed={responseKind === 'confirmation'} onClick={() => useChecklist(false)}>{t('routineComposerSingle')}</button><button type="button" className={responseKind === 'checklist' ? 'active' : ''} aria-pressed={responseKind === 'checklist'} onClick={() => useChecklist(true)}>{t('routineComposerList')}</button></div> : null}
            {routine.response?.kind === 'checklist' ? <div className="routine-composer-checklist-editor">{routine.response.items.map((item, index) => <div key={item.id}><label><span>{formatMessage(t('routineComposerItem'), { number: index + 1 })}</span><input value={item.label} maxLength={200} onChange={(event) => updateChecklistItem(item.id, event.target.value)} /></label><button type="button" disabled={routine.response?.kind !== 'checklist' || routine.response.items.length <= 1} onClick={() => removeChecklistItem(item.id)} aria-label={t('delete')}><AppIcon name="close" /></button></div>)}<button type="button" className="routine-composer-add-item" onClick={addChecklistItem}><AppIcon name="add" />{t('routineComposerAddItem')}</button></div> : null}
            {routine.response?.kind === 'quiz' ? <div className="routine-composer-quiz-summary"><b>{t('routineComposerQuizConfiguration')}</b><span>{formatMessage(t('routineComposerQuizCount'), { questions: routine.response.questionCount, choices: routine.response.choiceCount })}</span></div> : null}
            {aiReason ? <p className="routine-composer-ai-reason"><AppIcon name="sparkles" />{aiReason}</p> : null}
          </div>
          <article className="routine-composer-preview" aria-label={t('routineDraftParticipantPreview')}>
            <small>{t('routineDraftParticipantPreview')}</small>
            <h3>{participantPreviewName}</h3>
            <p>{routine.instructions || t('routineDraftInstructionPlaceholder')}</p>
            {responseKind === 'photo' ? <div className="routine-composer-preview-action"><AppIcon name="camera" />{t('sendProofShort')}</div> : null}
            {responseKind === 'confirmation' ? <div className="routine-composer-preview-choices"><span>{t('yes')}</span><span>{t('no')}</span></div> : null}
            {routine.response?.kind === 'checklist' ? <ul>{routine.response.items.map((item) => <li key={item.id}><span>{item.label || t('routineComposerChecklistItem')}</span><small>{t('yes')} / {t('no')}</small></li>)}</ul> : null}
            {routine.response?.kind === 'quiz' ? <div className="routine-composer-preview-action"><AppIcon name="sparkles" />{formatMessage(t('routineComposerQuizQuestions'), { count: routine.response.questionCount })}</div> : null}
            <div className="routine-composer-plan-summary"><AppIcon name="calendar" /><span><b>{t('routineComposerWhen')}</b>{planSummary ?? t('routineComposerDefaultPlan')}</span></div>
            {uncertainties.length ? <div className="routine-composer-uncertainties" role="status"><b>{t('routineComposerConfirm')}</b>{uncertainties.map((item) => <span key={item}>{item}</span>)}</div> : null}
          </article>
          <div className="routine-composer-refinement">
            <label><span>{t('routineComposerRefine')}</span><textarea value={refinement} maxLength={1000} placeholder={t('routineComposerRefinePlaceholder')} onChange={(event) => setRefinement(event.target.value)} /></label>
            <button type="button" disabled={!aiAvailable || !online || aiBusy || !aiReason || !refinement.trim()} onClick={() => { void requestAiProposal(true); }}>{t('routineComposerAdjustAi')}</button>
          </div>
          <button type="button" className="routine-composer-prescription" disabled aria-describedby="prescription-authoring-state"><AppIcon name="camera" />{t('routineComposerPrescription')}</button>
          <small id="prescription-authoring-state" className="routine-composer-capability-note">{t('routineComposerPrescriptionDisabled')}</small>
          <button type="button" className="routine-draft-customize" aria-expanded={advancedExpanded} onClick={() => setAdvancedExpanded((expanded) => !expanded)}>{t(advancedExpanded ? 'routineDraftHideAdvanced' : 'routineDraftCustomize')}<AppIcon name="chevron-down" className={advancedExpanded ? 'expanded' : undefined} /></button>
          {advancedExpanded ? identityFields : null}
        </section>
        {!online ? <p className="routine-draft-save-state" role="status">{t('routineDraftOffline')}</p> : null}
        {errorKind ? <div className="routine-draft-save-state error" role="alert"><p>{t(errorKind === 'conflict' ? 'routineDraftConflict' : errorKind === 'limit' ? 'routineDraftLimitError' : errorKind === 'invalid' ? 'routineDraftInvalidError' : 'routineDraftSaveError')}</p>{errorKind === 'conflict' ? <button type="button" onClick={reload}>{t('routineDraftReload')}</button> : null}</div> : null}
        {savedRevision ? <p className="routine-draft-save-state success" role="status">{formatMessage(t(savedValidation?.status === 'valid' ? 'routineDraftSavedValid' : 'routineDraftSavedIncomplete'), { revision: savedRevision, count: savedValidation?.issues.length ?? 0 })}</p> : null}
        <div className="routine-draft-editor-actions"><button type="button" onClick={cancel}>{t('cancel')}</button><button type="submit" className="primary-action-button" disabled={!online || saving}>{saving ? t('routineDraftSaving') : t(approve ? 'routineComposerCreate' : draft ? 'routineDraftSave' : 'routineDraftCreate')}</button></div>
      </form>
    </div>
  );
}
