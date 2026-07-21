import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RoutineDraft } from '../domain/routineDraft';
import { translate } from '../services/i18n';
import { RoutineDraftEditorScreen } from './RoutineDraftEditorScreen';

const savedDraft = (name = 'Saved routine'): RoutineDraft => ({
  id: 'draft-1', ownerId: 'owner-1', revision: 1, state: 'active',
  package: { schemaVersion: 1, version: 1, defaultLocale: 'en', availableLocales: ['en'], routine: { id: 'private-routine', name, description: '', instructions: '', icon: 'sparkles', accentColor: '#2563EB', category: 'custom', proofType: 'photo', proofExample: '', recommendedValidationMode: 'ai', responsibleName: '', instructionSteps: [{ id: 'step-1', icon: 'sparkles', title: '', description: '' }, { id: 'step-2', icon: 'sparkles', title: '', description: '' }], analysis: { expectedEvidence: '', detectedCriteria: '', notDetectedCriteria: '', uncertaintyCriteria: '' } } },
  validation: { status: 'incomplete', issues: [{ code: 'required_field', path: 'routine.description' }] }, createdAt: '2026-07-17T12:00:00.000Z', updatedAt: '2026-07-17T12:00:00.000Z',
});

describe('private routine draft editor', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('uses the current user language and creates a complete draft from one instruction', async () => {
    const save = vi.fn().mockImplementation(async (routinePackage) => ({ ...savedDraft(routinePackage.routine.name), package: routinePackage, validation: { status: 'valid', issues: [] } }));
    act(() => root.render(<RoutineDraftEditorScreen locale="fr" online save={save} cancel={() => undefined} reload={() => undefined} t={(key) => translate('fr', key)} />));
    expect(container.querySelector('.routine-draft-main-instruction')).not.toBeNull();
    expect(container.querySelector('select')).toBeNull();
    expect(container.textContent).not.toContain('Métadonnées');
    const instruction = container.querySelector<HTMLTextAreaElement>('.routine-draft-main-instruction');
    act(() => { if (instruction) { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(instruction, 'Mettre les élastiques orthodontiques après le dîner.'); instruction.dispatchEvent(new Event('input', { bubbles: true })); } });
    await act(async () => { container.querySelector<HTMLFormElement>('form')?.requestSubmit(); await Promise.resolve(); });
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0].defaultLocale).toBe('fr');
    expect(save.mock.calls[0][0].availableLocales).toEqual(['fr']);
    expect(save.mock.calls[0][0].routine.name).toBe('Mettre les élastiques orthodontiques après le dîner');
    expect(save.mock.calls[0][0].routine.instructionSteps).toHaveLength(2);
    expect(save.mock.calls[0][0].routine.analysis.detectedCriteria).toContain('élastiques orthodontiques');
    expect(save.mock.calls[0][0].routine.translations).toBeUndefined();
    expect(Object.hasOwn(save.mock.calls[0][0].routine, 'translations')).toBe(false);
    expect(container.textContent).toContain('Brouillon enregistré · révision 1 · prêt');
  });

  it('reveals only useful customization and derives the icon from the category', async () => {
    const save = vi.fn().mockImplementation(async (routinePackage) => ({ ...savedDraft(routinePackage.routine.name), package: routinePackage, validation: { status: 'valid', issues: [] } }));
    act(() => root.render(<RoutineDraftEditorScreen locale="en" online save={save} cancel={() => undefined} reload={() => undefined} t={(key) => translate('en', key)} />));
    const customize = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Customize'));

    expect(customize?.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('input')).toBeNull();
    act(() => customize?.click());
    expect(customize?.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelectorAll('input')).toHaveLength(2);
    expect(container.querySelectorAll('select')).toHaveLength(1);
    expect(container.textContent).not.toContain('Expected proof');
    const category = container.querySelector<HTMLSelectElement>('select');
    act(() => { if (category) { category.value = 'medication'; category.dispatchEvent(new Event('change', { bubbles: true })); } });
    await act(async () => { container.querySelector<HTMLFormElement>('form')?.requestSubmit(); await Promise.resolve(); });
    expect(save.mock.calls[0][0].routine).toMatchObject({ category: 'medication', icon: 'medical' });
  });

  it('asks only for the intent and response mode, then previews the participant interaction', async () => {
    const save = vi.fn().mockImplementation(async (routinePackage) => ({ ...savedDraft(routinePackage.routine.name), package: routinePackage, validation: { status: 'valid', issues: [] } }));
    act(() => root.render(<RoutineDraftEditorScreen locale="fr" online save={save} cancel={() => undefined} reload={() => undefined} t={(key) => translate('fr', key)} />));
    expect(container.textContent).toContain('Que faut-il vérifier ?');
    expect(container.textContent).toContain('Comment le participant répond-il ?');
    const instruction = container.querySelector<HTMLTextAreaElement>('.routine-draft-main-instruction');
    act(() => { if (instruction) { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(instruction, 'Le participant met bien ses élastiques.'); instruction.dispatchEvent(new Event('input', { bubbles: true })); } });
    act(() => Array.from(container.querySelectorAll('button')).find((button) => button.querySelector('strong')?.textContent === 'Confirmation')?.click());
    expect(container.querySelector('.routine-composer-preview-choices')?.textContent).toContain('Oui');
    await act(async () => { container.querySelector<HTMLFormElement>('form')?.requestSubmit(); await Promise.resolve(); });
    expect(save.mock.calls[0][0].routine.response).toEqual({ kind: 'confirmation', prompt: 'Le participant met bien ses élastiques.' });
    expect(save.mock.calls[0][0].routine.recommendedValidationMode).toBe('auto');
    expect(save.mock.calls[0][0].routine.instructionSteps[1].icon).toBe('check');
  });

  it('applies an AI proposal locally and still requires explicit creation approval', async () => {
    const save = vi.fn().mockImplementation(async (routinePackage) => ({ ...savedDraft(routinePackage.routine.name), package: routinePackage, validation: { status: 'valid', issues: [] } }));
    const approve = vi.fn().mockResolvedValue(undefined);
    const propose = vi.fn().mockResolvedValue({ name: 'Java progress', instructions: 'Answer three Java questions.', description: 'Track Java learning.', category: 'activity', response: { kind: 'quiz', prompt: 'Test your Java knowledge', topic: 'Java' }, responseReason: 'A quiz measures learning progress.', uncertainties: [] });
    act(() => root.render(<RoutineDraftEditorScreen locale="en" online save={save} approve={approve} aiAvailable quizAvailable propose={propose} cancel={() => undefined} reload={() => undefined} t={(key) => translate('en', key)} />));
    const instruction = container.querySelector<HTMLTextAreaElement>('.routine-draft-main-instruction');
    act(() => { if (instruction) { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(instruction, 'I want to track my Java learning.'); instruction.dispatchEvent(new Event('input', { bubbles: true })); } });
    await act(async () => { Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Suggest a challenge'))?.click(); await Promise.resolve(); });
    expect(propose).toHaveBeenCalledWith({ intent: 'I want to track my Java learning.' });
    expect(container.textContent).toContain('Do not include health or identifying information.');
    expect(container.textContent).toContain('Java progress');
    expect(container.textContent).toContain('A quiz measures learning progress.');
    expect(save).not.toHaveBeenCalled();
    expect(approve).not.toHaveBeenCalled();
    await act(async () => { container.querySelector<HTMLFormElement>('form')?.requestSubmit(); await Promise.resolve(); });
    expect(save.mock.calls[0][0].routine.response).toMatchObject({ kind: 'quiz', topic: 'Java', questionCount: 3, choiceCount: 3 });
    expect(approve).toHaveBeenCalledOnce();
  });

  it('fails closed for gated quiz and prescription capabilities while keeping manual authoring available', () => {
    act(() => root.render(<RoutineDraftEditorScreen locale="en" online save={vi.fn()} aiAvailable={false} quizAvailable={false} cancel={() => undefined} reload={() => undefined} t={(key) => translate('en', key)} />));
    const quiz = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.querySelector('strong')?.textContent === 'Quiz');
    const prescription = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent?.includes('Photograph a prescription'));
    expect(quiz?.disabled).toBe(true);
    expect(prescription?.disabled).toBe(true);
    expect(container.textContent).toContain('Manual creation remains fully available');
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Create draft')?.disabled).toBe(false);
  });

  it('preserves edits after a conflict and offers recovery', async () => {
    const reload = vi.fn();
    const save = vi.fn().mockRejectedValue(new Error('functions/aborted: changed on another device'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    act(() => root.render(<RoutineDraftEditorScreen draft={savedDraft('Original name')} locale="en" online save={save} cancel={() => undefined} reload={reload} t={(key) => translate('en', key)} />));
    const instruction = container.querySelector<HTMLTextAreaElement>('.routine-draft-main-instruction');
    act(() => { if (instruction) { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(instruction, 'Unsaved local instruction'); instruction.dispatchEvent(new Event('input', { bubbles: true })); } });
    await act(async () => { container.querySelector<HTMLFormElement>('form')?.requestSubmit(); await Promise.resolve(); });
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('changed on another device');
    expect(instruction?.value).toBe('Unsaved local instruction');
    act(() => Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Reload latest revision')?.click());
    expect(reload).toHaveBeenCalledOnce();
  });

  it('keeps local edits and disables saving while offline', () => {
    const save = vi.fn();
    act(() => root.render(<RoutineDraftEditorScreen draft={savedDraft()} locale="en" online={false} save={save} cancel={() => undefined} reload={() => undefined} t={(key) => translate('en', key)} />));
    expect(container.querySelector('[role="status"]')?.textContent).toContain('offline');
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Save draft')?.disabled).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });
});
