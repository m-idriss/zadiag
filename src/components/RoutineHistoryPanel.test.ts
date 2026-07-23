import { describe, expect, it } from 'vitest';
import { groupedVerificationStatuses } from './RoutineHistoryPanel';

describe('groupedVerificationStatuses', () => {
  it('offers one validated filter for photo and structured-response successes', () => {
    expect(groupedVerificationStatuses(['detected', 'answered', 'missed'])).toEqual([
      { status: 'detected', eventStatuses: ['detected', 'answered'] },
      { status: 'missed', eventStatuses: ['missed'] },
    ]);
  });
});
