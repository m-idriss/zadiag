import { describe, expect, it } from 'vitest';
import { routineIconName } from './Icon';

describe('routine icons', () => {
  it('uses a tooth icon for orthodontic routines', () => {
    expect(routineIconName('🦷')).toBe('tooth');
  });

  it('keeps generic aliases for proof actions', () => {
    expect(routineIconName('📷')).toBe('camera');
    expect(routineIconName('📤')).toBe('send');
  });
});
