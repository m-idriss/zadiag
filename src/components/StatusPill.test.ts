import { describe, expect, it } from 'vitest';
import { statusMessageKey } from './StatusPill';

describe('statusMessageKey', () => {
  it('presents a completed structured response as validated', () => {
    expect(statusMessageKey('answered')).toBe('validated');
  });
});
