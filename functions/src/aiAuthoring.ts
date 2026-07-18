export type AiAuthoringCapability = 'prescriptionExtraction' | 'routineTranslation';
export type AiAuthoringMetricStatus = 'success' | 'provider_failure' | 'invalid_output' | 'disabled';

export interface AiAuthoringControlConfig {
  globalEnabled?: boolean;
  privacyApprovalId?: string;
  capabilities?: Partial<Record<AiAuthoringCapability, boolean>>;
}

export const aiAuthoringRegistry = {
  prescriptionExtraction: { provider: 'gemini', model: 'gemini-2.5-flash', promptVersion: 'prescription-extraction-v1' },
  routineTranslation: { provider: 'gemini', model: 'gemini-2.5-flash', promptVersion: 'routine-translation-v1' },
} as const;

export class AiAuthoringDisabledError extends Error { constructor() { super('ai_authoring_disabled'); } }

export const aiAuthoringCapabilityEnabled = (config: AiAuthoringControlConfig | undefined, capability: AiAuthoringCapability) => Boolean(
  config?.globalEnabled && config.privacyApprovalId?.trim() && config.capabilities?.[capability],
);

export const requireAiAuthoringCapability = (config: AiAuthoringControlConfig | undefined, capability: AiAuthoringCapability) => {
  if (!aiAuthoringCapabilityEnabled(config, capability)) throw new AiAuthoringDisabledError();
  return aiAuthoringRegistry[capability];
};

export const parseAiAuthoringConfig = (raw: string | undefined): AiAuthoringControlConfig => {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as AiAuthoringControlConfig;
    return typeof value === 'object' && value !== null ? value : {};
  } catch { return {}; }
};

export const aiAuthoringMetric = (capability: AiAuthoringCapability, status: AiAuthoringMetricStatus, latencyMs: number) => ({
  capability,
  status,
  latencyMs: Number.isFinite(latencyMs) ? Math.max(0, Math.min(120_000, Math.round(latencyMs))) : 0,
  provider: aiAuthoringRegistry[capability].provider,
  model: aiAuthoringRegistry[capability].model,
  promptVersion: aiAuthoringRegistry[capability].promptVersion,
});

export const unapprovedAiDraft = <T>(capability: AiAuthoringCapability, output: T) => ({
  capability, output, approvalStatus: 'pending_human_review' as const, publishable: false as const, assignable: false as const, activatable: false as const,
});
