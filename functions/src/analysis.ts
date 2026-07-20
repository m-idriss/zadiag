import { z } from 'zod';

export type AnalysisResult = {
  status: 'detected' | 'not_detected' | 'uncertain';
  confidence: number;
  imageQuality: number;
  reason: string;
  reasonRaw?: string;
};

export const routeAnalysisStatusForReview = (
  status: AnalysisResult['status'],
  hasProofImage: boolean,
): { status: AnalysisResult['status']; automatedStatus: AnalysisResult['status']; reviewRequired: boolean } => {
  const reviewRequired = hasProofImage && status !== 'detected';
  return {
    status: reviewRequired ? 'uncertain' : status,
    automatedStatus: status,
    reviewRequired,
  };
};

export type RoutineAnalysisContext = {
  routineName: string;
  expectedEvidence: string;
  detectedCriteria: string;
  notDetectedCriteria: string;
  uncertaintyCriteria?: string;
};

const analysisSchema = z.object({
  status: z.unknown(),
  confidence: z.unknown(),
  imageQuality: z.unknown(),
  reason: z.unknown(),
});

const imageDataUrlSchema = z.string().regex(/^data:(.+?);base64,(.+)$/);

const toProbability = (value: unknown) => {
  if (typeof value === 'number') {
    if (value > 1 && value <= 100) return value / 100;
    return value;
  }
  if (typeof value !== 'string') return value;
  const normalized = value.trim();
  if (!normalized) return value;
  const percent = normalized.match(/-?\d+(?:[.,]\d+)?\s*%/);
  if (percent) {
    const parsed = Number.parseFloat(percent[0].replace('%', '').replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed / 100;
  }
  const numberMatch = normalized.match(/-?\d+(?:[.,]\d+)?/);
  if (!numberMatch) return value;
  const parsed = Number.parseFloat(numberMatch[0].replace(',', '.'));
  if (!Number.isFinite(parsed)) return value;
  return parsed > 1 && parsed <= 100 ? parsed / 100 : parsed;
};

const normalizeStatus = (value: unknown): AnalysisResult['status'] => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'detected') return 'detected';
  if (normalized === 'not_detected' || normalized === 'not detected' || normalized === 'notdetected') return 'not_detected';
  return 'uncertain';
};

const normalizeReason = (value: unknown) => {
  if (typeof value !== 'string') return 'analysis_unavailable';
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 220) : 'analysis_unavailable';
};

export const extractJsonPayload = (text: string) => {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('Gemini response did not contain JSON.');
  }
  return trimmed.slice(start, end + 1);
};

export const normalizeAnalysisResult = (value: unknown): AnalysisResult => {
  const parsed = analysisSchema.parse(value);
  const confidence = toProbability(parsed.confidence);
  const imageQuality = toProbability(parsed.imageQuality);
  return {
    status: normalizeStatus(parsed.status),
    confidence: Number.isFinite(Number(confidence)) ? Math.min(1, Math.max(0, Number(confidence))) : 0.5,
    imageQuality: Number.isFinite(Number(imageQuality)) ? Math.min(1, Math.max(0, Number(imageQuality))) : 0.5,
    reason: normalizeReason(parsed.reason),
  };
};

export const parseImageDataUrl = (dataUrl: string) => {
  const match = imageDataUrlSchema.safeParse(dataUrl);
  if (!match.success) {
    throw new Error('A valid image is required.');
  }
  const [, mimeType, data] = dataUrl.match(/^data:(.+?);base64,(.+)$/) ?? [];
  if (!mimeType || !data) {
    throw new Error('A valid image is required.');
  }
  return { mimeType, data };
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  error?: unknown;
};

type AnalysisLocale = 'en' | 'fr';

const GEMINI_ANALYSIS_MAX_OUTPUT_TOKENS = 768;
const GEMINI_ANALYSIS_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  required: ['status', 'confidence', 'imageQuality', 'reason'],
  properties: {
    status: { type: 'STRING', enum: ['detected', 'not_detected', 'uncertain'] },
    confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
    imageQuality: { type: 'NUMBER', minimum: 0, maximum: 1 },
    reason: { type: 'STRING', maxLength: 220 },
  },
} as const;

const defaultRoutineAnalysis: RoutineAnalysisContext = {
  routineName: 'Treatment adherence',
  expectedEvidence: 'The expected treatment aid or adherence proof for this routine.',
  detectedCriteria: 'The expected proof is clearly visible and matches the routine.',
  notDetectedCriteria: 'The expected proof is not visible or clearly does not match the routine.',
  uncertaintyCriteria: 'Use uncertain when the image is too dark, blurry, cropped, ambiguous, or does not allow a reliable decision.',
};

const buildPrompt = (locale: AnalysisLocale, retry: boolean, routineAnalysis = defaultRoutineAnalysis) => [
  `Routine: ${routineAnalysis.routineName}.`,
  `Expected evidence: ${routineAnalysis.expectedEvidence}`,
  `Return detected only when: ${routineAnalysis.detectedCriteria}`,
  `Return not_detected only when: ${routineAnalysis.notDetectedCriteria}`,
  `Return uncertain when: ${routineAnalysis.uncertaintyCriteria ?? defaultRoutineAnalysis.uncertaintyCriteria}`,
  locale === 'fr' ? 'Reply in French.' : 'Reply in English.',
  retry ? 'This is a second pass. Re-check carefully before answering.' : '',
  'Return JSON only.',
  'Keys: status, confidence, imageQuality, reason.',
  'status must be detected, not_detected, or uncertain.',
  'Keep reason under 25 words.',
  locale === 'fr'
    ? 'The reason field must be a natural French sentence, with no English words.'
    : 'The reason field must be a natural English sentence, with no French words.',
  locale === 'fr'
    ? 'Example reason: "La preuve attendue n’est pas clairement visible."'
    : 'Example reason: "The expected proof is not clearly visible."',
  retry ? 'Only use not_detected if you are genuinely confident the expected evidence is missing.' : '',
].filter(Boolean).join(' ');

const requestGeminiAnalysis = async (
  imageDataUrl: string,
  options: {
    model: string;
    getAccessToken: () => Promise<string | null | undefined>;
    fetchImpl?: typeof fetch;
    locale?: AnalysisLocale;
    routineAnalysis?: RoutineAnalysisContext;
  },
  retry: boolean,
): Promise<AnalysisResult> => {
  const { mimeType, data } = parseImageDataUrl(imageDataUrl);
  const token = await options.getAccessToken();
  if (!token) {
    throw new Error('Missing Google access token.');
  }
  const response = await (options.fetchImpl ?? fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: buildPrompt(options.locale ?? 'en', retry, options.routineAnalysis),
            },
            {
              inline_data: {
                mime_type: mimeType,
                data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: GEMINI_ANALYSIS_MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: GEMINI_ANALYSIS_RESPONSE_SCHEMA,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API request failed with status ${response.status}: ${errorText}`);
  }

  const payload = await response.json() as GeminiGenerateContentResponse;
  return analyzeGeminiResponse(payload);
};

export const analyzeGeminiResponse = (payload: GeminiGenerateContentResponse) => {
  if (payload.error) {
    throw new Error(`Gemini API returned an error: ${JSON.stringify(payload.error)}`);
  }
  const candidate = payload.candidates?.[0];
  const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('').trim();
  if (!text) {
    throw new Error('Gemini response did not contain text.');
  }
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') {
    console.warn(`Gemini response finished with ${candidate.finishReason}, attempting to parse payload anyway.`);
  }
  return normalizeAnalysisResult(JSON.parse(extractJsonPayload(text)));
};

export const analyzeWithGemini = async (
  imageDataUrl: string,
  options: {
    model: string;
    getAccessToken: () => Promise<string | null | undefined>;
    fetchImpl?: typeof fetch;
    locale?: AnalysisLocale;
    routineAnalysis?: RoutineAnalysisContext;
  },
): Promise<AnalysisResult> => {
  const initialResult = await requestGeminiAnalysis(imageDataUrl, options, false);
  if (initialResult.status !== 'not_detected') return initialResult;
  try {
    return await requestGeminiAnalysis(imageDataUrl, options, true);
  } catch (error) {
    console.warn('Gemini retry failed, keeping first result', error);
    return initialResult;
  }
};

const requestGeminiTranslation = async (
  text: string,
  options: {
    model: string;
    getAccessToken: () => Promise<string | null | undefined>;
    fetchImpl?: typeof fetch;
    locale: AnalysisLocale;
  },
): Promise<string> => {
  const token = await options.getAccessToken();
  if (!token) {
    throw new Error('Missing Google access token.');
  }
  const response = await (options.fetchImpl ?? fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: [
                options.locale === 'fr'
                  ? 'Translate the following text to French. Return only the translated text.'
                  : 'Translate the following text to English. Return only the translated text.',
                text,
              ].join('\n\n'),
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 256,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini translation request failed with status ${response.status}: ${errorText}`);
  }

  const payload = await response.json() as GeminiGenerateContentResponse;
  const candidate = payload.candidates?.[0];
  const translated = candidate?.content?.parts?.map((part) => part.text ?? '').join('').trim();
  if (!translated) {
    throw new Error('Gemini translation did not contain text.');
  }
  return translated;
};

export const localizeAnalysisReason = async (
  reason: string,
  options: {
    model: string;
    getAccessToken: () => Promise<string | null | undefined>;
    fetchImpl?: typeof fetch;
    locale: AnalysisLocale;
  },
): Promise<string> => {
  if (!reason || reason === 'analysis_unavailable') return reason;
  if (options.locale === 'en') return reason;
  try {
    return await requestGeminiTranslation(reason, options);
  } catch (error) {
    console.warn('Gemini translation failed, keeping original reason', error);
    return reason;
  }
};
