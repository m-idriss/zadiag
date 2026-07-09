import { describe, expect, it } from 'vitest';
import { describeAppUpdate, isMandatoryAppUpdate } from './appUpdate';

describe('app update version comparison', () => {
  it('counts patch updates within the same minor version', () => {
    expect(describeAppUpdate('0.3.93', '0.3.97')).toMatchObject({
      available: true,
      severity: 'patch',
      patchCount: 4,
      badgeLabel: '+4',
    });
  });

  it('marks minor and major updates with the target version', () => {
    expect(describeAppUpdate('0.3.93', '0.4.0')).toMatchObject({
      available: true,
      severity: 'minor',
      badgeLabel: '0.4.0',
    });
    expect(describeAppUpdate('0.3.93', '1.0.0')).toMatchObject({
      available: true,
      severity: 'major',
      badgeLabel: '1.0.0',
    });
  });

  it('does not report an update for current or older versions', () => {
    expect(describeAppUpdate('0.3.93', '0.3.93')).toBeUndefined();
    expect(describeAppUpdate('0.3.93', '0.3.92')).toBeUndefined();
  });

  it('requires minor and major updates only', () => {
    expect(isMandatoryAppUpdate({ available: true, severity: 'patch' })).toBe(false);
    expect(isMandatoryAppUpdate({ available: true, severity: 'unknown' })).toBe(false);
    expect(isMandatoryAppUpdate({ available: true, severity: 'minor' })).toBe(true);
    expect(isMandatoryAppUpdate({ available: true, severity: 'major' })).toBe(true);
    expect(isMandatoryAppUpdate({ available: false, severity: 'major' })).toBe(false);
  });
});
