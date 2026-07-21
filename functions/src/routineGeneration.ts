import { z } from 'zod';

export type ProposedResponseKind = 'photo' | 'confirmation' | 'checklist' | 'quiz';

export interface RoutineProposalRequest {
  intent: string;
  locale: 'en' | 'fr';
  preferredResponseKind?: ProposedResponseKind;
  refinement?: string;
  currentProposal?: RoutineProposal;
}

export interface RoutineProposal {
  name: string;
  instructions: string;
  description: string;
  category: 'dental' | 'wellness' | 'medication' | 'activity' | 'custom';
  response: { kind: ProposedResponseKind; prompt: string; topic?: string; items?: Array<{ id: string; label: string }> };
  responseReason: string;
  uncertainties: string[];
}

const outputSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  instructions: z.string().trim().min(2).max(2_000),
  description: z.string().trim().min(2).max(500),
  category: z.enum(['dental', 'wellness', 'medication', 'activity', 'custom']),
  response: z.strictObject({
    kind: z.enum(['photo', 'confirmation', 'checklist', 'quiz']),
    prompt: z.string().trim().min(2).max(500),
    topic: z.string().trim().min(2).max(200).optional(),
    items: z.array(z.string().trim().min(1).max(200)).min(1).max(20).optional(),
  }),
  responseReason: z.string().trim().min(2).max(240),
  uncertainties: z.array(z.string().trim().min(2).max(240)).max(5),
  changedFields: z.array(z.enum(['name', 'instructions', 'description', 'category', 'response'])).min(1).max(5).optional(),
});

const jsonFrom = (text: string) => {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('routine_proposal_invalid_output');
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
};

export const parseRoutineProposal = (value: unknown, preferredResponseKind?: ProposedResponseKind, currentProposal?: RoutineProposal): RoutineProposal => {
  const parsed = outputSchema.parse(value);
  if (preferredResponseKind && parsed.response.kind !== preferredResponseKind) throw new Error('routine_proposal_response_mismatch');
  if (parsed.response.kind === 'quiz' && !parsed.response.topic) throw new Error('routine_proposal_topic_required');
  if (parsed.response.kind === 'checklist' && !parsed.response.items) throw new Error('routine_proposal_items_required');
  if (parsed.response.kind !== 'quiz' && parsed.response.topic) throw new Error('routine_proposal_unexpected_topic');
  if (parsed.response.kind !== 'checklist' && parsed.response.items) throw new Error('routine_proposal_unexpected_items');
  const normalized = {
    name: parsed.name,
    instructions: parsed.instructions,
    description: parsed.description,
    category: parsed.category,
    response: {
      kind: parsed.response.kind,
      prompt: parsed.response.prompt,
      ...(parsed.response.topic ? { topic: parsed.response.topic } : {}),
      ...(parsed.response.items ? { items: parsed.response.items.map((label, index) => ({ id: `item-${index + 1}`, label })) } : {}),
    },
    responseReason: parsed.responseReason,
    uncertainties: parsed.uncertainties,
  };
  if (!currentProposal) return normalized;
  if (!parsed.changedFields?.length) throw new Error('routine_proposal_changed_fields_required');
  const changed = new Set(parsed.changedFields);
  return {
    name: changed.has('name') ? normalized.name : currentProposal.name,
    instructions: changed.has('instructions') ? normalized.instructions : currentProposal.instructions,
    description: changed.has('description') ? normalized.description : currentProposal.description,
    category: changed.has('category') ? normalized.category : currentProposal.category,
    response: changed.has('response') ? normalized.response : currentProposal.response,
    responseReason: normalized.responseReason,
    uncertainties: normalized.uncertainties,
  };
};

const responseSchema = {
  type: 'OBJECT', required: ['name', 'instructions', 'description', 'category', 'response', 'responseReason', 'uncertainties'],
  properties: {
    name: { type: 'STRING', maxLength: 120 }, instructions: { type: 'STRING', maxLength: 2_000 }, description: { type: 'STRING', maxLength: 500 },
    category: { type: 'STRING', enum: ['dental', 'wellness', 'medication', 'activity', 'custom'] },
    response: { type: 'OBJECT', required: ['kind', 'prompt'], properties: { kind: { type: 'STRING', enum: ['photo', 'confirmation', 'checklist', 'quiz'] }, prompt: { type: 'STRING', maxLength: 500 }, topic: { type: 'STRING', maxLength: 200 }, items: { type: 'ARRAY', maxItems: 20, items: { type: 'STRING', maxLength: 200 } } } },
    responseReason: { type: 'STRING', maxLength: 240 }, uncertainties: { type: 'ARRAY', maxItems: 5, items: { type: 'STRING', maxLength: 240 } }, changedFields: { type: 'ARRAY', minItems: 1, maxItems: 5, items: { type: 'STRING', enum: ['name', 'instructions', 'description', 'category', 'response'] } },
  },
} as const;

const promptFor = (request: RoutineProposalRequest) => [
  'Create a concise routine challenge proposal from the user intent below.',
  `User intent: ${request.intent}`,
  request.preferredResponseKind ? `The user selected response kind ${request.preferredResponseKind}; preserve it exactly.` : 'Recommend the safest and simplest response kind.',
  'For a learning intent, prefer a quiz. For several independently confirmed actions, prefer a checklist. Never infer medical doses, timing or treatment details.',
  'A quiz uses a concise topic. A checklist uses one item label per action. Other modes must omit topic and items.',
  request.locale === 'fr' ? 'Write every user-facing field in French.' : 'Write every user-facing field in English.',
  request.refinement ? `Refinement request: ${request.refinement}` : '',
  request.currentProposal ? `Current proposal to refine while preserving unrelated fields: ${JSON.stringify(request.currentProposal)}` : '',
  request.currentProposal ? 'Set changedFields to exactly the proposal fields affected by the refinement. Preserve every other field.' : '',
  'List any ambiguity requiring human confirmation. Return JSON only, without markdown.',
].filter(Boolean).join(' ');

export const generateRoutineProposalWithGemini = async (request: RoutineProposalRequest, options: {
  model: string;
  getAccessToken: () => Promise<string | null | undefined>;
  fetchImpl?: typeof fetch;
}) => {
  const token = await options.getAccessToken();
  if (!token) throw new Error('routine_proposal_missing_access_token');
  const response = await (options.fetchImpl ?? fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: promptFor(request) }] }], generationConfig: { temperature: 0.25, maxOutputTokens: 2_000, responseMimeType: 'application/json', responseSchema, thinkingConfig: { thinkingBudget: 0 } } }),
  });
  if (!response.ok) throw new Error(`routine_proposal_provider_${response.status}`);
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: unknown };
  if (payload.error) throw new Error('routine_proposal_provider_error');
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
  if (!text) throw new Error('routine_proposal_empty_output');
  return parseRoutineProposal(jsonFrom(text), request.preferredResponseKind, request.refinement ? request.currentProposal : undefined);
};
