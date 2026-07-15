import { describe, expect, it } from 'vitest';
import type { VerificationEvent } from '../domain/models';
import { retakeGuidanceMessageKey } from './retakeGuidance';

const event = (overrides: Partial<VerificationEvent> = {}): VerificationEvent => ({
  id: 'check',
  routineId: 'routine',
  sessionId: 'session',
  requestedAt: '2026-07-15T16:00:00.000Z',
  expiresAt: '2026-07-15T18:00:00.000Z',
  status: 'uncertain',
  ...overrides,
});

describe('retake guidance', () => {
  const now = Date.parse('2026-07-15T17:00:00.000Z');

  it('turns analysis reasons into safe actionable guidance', () => {
    expect(retakeGuidanceMessageKey(event({ reason: 'La photo est trop sombre.' }), now)).toBe('retakeGuidanceLight');
    expect(retakeGuidanceMessageKey(event({ reason: 'The image is blurry.' }), now)).toBe('retakeGuidanceStability');
    expect(retakeGuidanceMessageKey(event({ reason: 'La bouche est mal cadrée.' }), now)).toBe('retakeGuidanceFraming');
    expect(retakeGuidanceMessageKey(event({ status: 'not_detected' }), now)).toBe('retakeGuidanceMissing');
  });

  it('uses a generic safe message for unknown reasons and reports expired windows', () => {
    expect(retakeGuidanceMessageKey(event({ reason: 'Ambiguous result.' }), now)).toBe('retakeGuidanceGeneric');
    expect(retakeGuidanceMessageKey(event({ expiresAt: '2026-07-15T16:30:00.000Z' }), now)).toBe('retakeGuidanceExpired');
  });
});
