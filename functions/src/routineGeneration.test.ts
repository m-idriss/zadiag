import assert from 'node:assert/strict';
import test from 'node:test';
import { generateRoutineProposalWithGemini, parseRoutineProposal } from './routineGeneration.js';

const valid = { name: 'Java progress', instructions: 'Answer a short Java quiz.', description: 'Track Java learning over time.', category: 'activity', response: { kind: 'quiz', prompt: 'Test your Java knowledge', topic: 'Java' }, responseReason: 'A quiz measures learning progress.', uncertainties: [] };

test('validates a bounded proposal and preserves the selected response kind', () => {
  assert.equal(parseRoutineProposal(valid, 'quiz').response.kind, 'quiz');
  assert.throws(() => parseRoutineProposal({ ...valid, response: { kind: 'photo', prompt: 'Photo' } }, 'quiz'));
  assert.throws(() => parseRoutineProposal({ ...valid, response: { kind: 'quiz', prompt: 'Quiz' } }));
});

test('creates stable checklist item ids and rejects extra fields', () => {
  const proposal = parseRoutineProposal({ ...valid, response: { kind: 'checklist', prompt: 'Completed?', items: ['One', 'Two'] } });
  assert.deepEqual(proposal.response.items, [{ id: 'item-1', label: 'One' }, { id: 'item-2', label: 'Two' }]);
  assert.throws(() => parseRoutineProposal({ ...valid, secret: 'unexpected' }));
});

test('merges only declared refinement fields into the current proposal', () => {
  const output = { ...valid, name: 'Unexpected rename', instructions: 'Focus on upper braces.', category: 'custom', changedFields: ['instructions'] };
  const refined = parseRoutineProposal(output, 'quiz', parseRoutineProposal(valid, 'quiz'));
  assert.equal(refined.name, valid.name);
  assert.equal(refined.category, valid.category);
  assert.equal(refined.instructions, 'Focus on upper braces.');
});

test('calls the pinned provider with structured output', async () => {
  const fetchImpl = async (_input: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { generationConfig?: { responseMimeType?: string } };
    assert.equal(body.generationConfig?.responseMimeType, 'application/json');
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(valid) }] } }] }), { status: 200 });
  };
  const proposal = await generateRoutineProposalWithGemini({ intent: 'Learn Java', locale: 'en', preferredResponseKind: 'quiz' }, { model: 'test-model', getAccessToken: async () => 'token', fetchImpl });
  assert.equal(proposal.name, 'Java progress');
});
