export type Role = 'parent' | 'child';
export type Locale = 'en' | 'fr';
export type VerificationStatus =
  | 'pending'
  | 'analyzing'
  | 'detected'
  | 'not_detected'
  | 'uncertain'
  | 'missed'
  | 'expired';

export interface TimeWindow {
  id: string;
  start: string;
  end: string;
}

export interface MonitoringPlan {
  checksPerDay: number;
  weekdays: number[];
  windows: TimeWindow[];
  expiryMinutes: number;
  timeZone: string;
}

export interface VerificationEvent {
  id: string;
  sessionId: string;
  requestedAt: string;
  expiresAt: string;
  capturedAt?: string;
  status: VerificationStatus;
  analysisSource?: 'ai' | 'fallback';
  confidence?: number;
  imageQuality?: number;
  reason?: string;
}

export interface FamilyState {
  id?: string;
  linked: boolean;
  childLinked: boolean;
  childName: string;
  linkingCode: string;
  parentRecoveryCode: string;
  consented: boolean;
}

export interface AppState {
  role?: Role;
  locale: Locale;
  notificationsEnabled: boolean;
  family: FamilyState;
  plan: MonitoringPlan;
  events: VerificationEvent[];
}

export interface AnalysisResult {
  status: Extract<VerificationStatus, 'detected' | 'not_detected' | 'uncertain'>;
  analysisSource?: 'ai' | 'fallback';
  confidence: number;
  imageQuality: number;
  reason?: string;
}

export const defaultPlan: MonitoringPlan = {
  checksPerDay: 3,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  windows: [
    { id: 'morning', start: '07:30', end: '09:30' },
    { id: 'midday', start: '12:00', end: '14:00' },
    { id: 'evening', start: '17:00', end: '20:00' },
  ],
  expiryMinutes: 20,
  timeZone: 'Europe/Paris',
};
