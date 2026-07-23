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

  it('maps routine package icon names to application icons', () => {
    expect(routineIconName('pulse')).toBe('pulse');
    expect(routineIconName('eye')).toBe('eye');
    expect(routineIconName('send')).toBe('send');
    expect(routineIconName('fitness')).toBe('fitness');
    expect(routineIconName('calendar')).toBe('calendar');
    expect(routineIconName('notifications')).toBe('notifications');
    expect(routineIconName('unknown-community-icon')).toBe('sparkles');
  });
});
