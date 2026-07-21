export type AiAuthoringCapability = 'prescriptionExtraction' | 'routineTranslation' | 'routineGeneration' | 'dynamicQuizGeneration';
export type AiAuthoringMetricStatus = 'success' | 'provider_failure' | 'invalid_output' | 'disabled';

export interface AiAuthoringControlConfig {
  globalEnabled?: boolean;
  capabilities?: Partial<Record<AiAuthoringCapability, boolean>>;
  approval?: {
    id?: string;
    status?: 'approved' | 'rejected' | 'pending';
    approvedAt?: string;
    expiresAt?: string;
    dpoApprovedBy?: string;
    legalApprovedBy?: string;
    securityApprovedBy?: string;
    provider?: string;
    dataResidency?: string;
    capabilities?: AiAuthoringCapability[];
  };
}

export const aiAuthoringRegistry = {
  prescriptionExtraction: { provider: 'gemini', model: 'gemini-2.5-flash', promptVersion: 'prescription-extraction-v1' },
  routineTranslation: { provider: 'gemini', model: 'gemini-2.5-flash', promptVersion: 'routine-translation-v1' },
  routineGeneration: { provider: 'gemini', model: 'gemini-2.5-flash', promptVersion: 'routine-generation-v1' },
  dynamicQuizGeneration: { provider: 'gemini', model: 'gemini-2.5-flash', promptVersion: 'dynamic-quiz-generation-v1' },
} as const;

export class AiAuthoringDisabledError extends Error { constructor() { super('ai_authoring_disabled'); } }

const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

export const aiAuthoringApprovalValid = (config: AiAuthoringControlConfig | undefined, capability: AiAuthoringCapability, now = new Date()) => {
  const approval = config?.approval;
  if (!approval || approval.status !== 'approved' || !approval.capabilities?.includes(capability)) return false;
  if (![approval.id, approval.dpoApprovedBy, approval.legalApprovedBy, approval.securityApprovedBy, approval.provider, approval.dataResidency].every(nonEmpty)) return false;
  const approvedAt = Date.parse(String(approval.approvedAt));
  const expiresAt = Date.parse(String(approval.expiresAt));
  return Number.isFinite(approvedAt) && Number.isFinite(expiresAt) && approvedAt <= now.getTime() && expiresAt > now.getTime();
};

export const aiAuthoringCapabilityEnabled = (config: AiAuthoringControlConfig | undefined, capability: AiAuthoringCapability, now = new Date()) => Boolean(
  config?.globalEnabled && config.capabilities?.[capability] && aiAuthoringApprovalValid(config, capability, now),
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
