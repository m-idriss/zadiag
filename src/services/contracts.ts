import type { AnalysisResult, MonitoringPlan, VerificationEvent } from '../domain/models';

export interface FamilyRepository {
  createLink(childName: string): Promise<{ code: string; expiresAt: string }>;
  redeemLink(code: string): Promise<void>;
  savePlan(plan: MonitoringPlan): Promise<void>;
  listEvents(): Promise<VerificationEvent[]>;
}

export interface VerificationGateway {
  createUpload(sessionId: string): Promise<{ uploadUrl: string; nonce: string }>;
  submit(input: {
    sessionId: string;
    nonce: string;
    capturedAt: string;
    digest: string;
  }): Promise<AnalysisResult>;
}

export interface PushGateway {
  permission(): Promise<NotificationPermission>;
  subscribe(): Promise<PushSubscription>;
}
