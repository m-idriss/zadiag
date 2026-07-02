import type { AnalysisResult, AppState, Locale, MonitoringPlan, Role, VerificationEvent } from '../domain/models';

export interface AppRepository {
  initialize(): Promise<void>;
  snapshot(): AppState;
  subscribe(listener: () => void): () => void;
  selectRole(role: Role): Promise<void>;
  setLocale(locale: Locale): Promise<void>;
  linkParent(childName: string): Promise<void>;
  recoverParent(code: string): Promise<void>;
  linkChild(code: string): Promise<void>;
  regenerateLinkCode(): Promise<void>;
  requestCheckNow(): Promise<void>;
  savePushSubscription(subscription: PushSubscriptionJSON): Promise<void>;
  savePlan(plan: MonitoringPlan): Promise<void>;
  activeSession(): VerificationEvent | undefined;
  submitCapture(sessionId: string, capturedAt: Date, imageDataUrl: string): Promise<VerificationEvent>;
  reset(): Promise<void>;
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
