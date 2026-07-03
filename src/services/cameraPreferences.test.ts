import { beforeEach, describe, expect, test } from 'vitest';
import { hasSeenCameraGuidance, markCameraGuidanceSeen, resetCameraGuidance } from './cameraPreferences';

describe('camera guidance preferences', () => {
  beforeEach(() => localStorage.clear());

  test('stores and clears the one-time camera guidance flag', () => {
    expect(hasSeenCameraGuidance()).toBe(false);

    markCameraGuidanceSeen();
    expect(hasSeenCameraGuidance()).toBe(true);

    resetCameraGuidance();
    expect(hasSeenCameraGuidance()).toBe(false);
  });
});
