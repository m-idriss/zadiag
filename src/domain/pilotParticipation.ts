import type { PilotParticipation, Role } from './models';

export const PILOT_CONSENT_VERSION = '2026-07-17';

export const currentPilotParticipation = (participation?: PilotParticipation) =>
  participation?.version === PILOT_CONSENT_VERSION ? participation : undefined;

export const pilotParticipationRecord = (
  status: PilotParticipation['status'],
  role: Role,
  recordedAt = new Date().toISOString(),
): PilotParticipation => ({ version: PILOT_CONSENT_VERSION, status, role, recordedAt });
