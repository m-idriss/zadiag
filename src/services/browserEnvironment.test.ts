import { describe, expect, it } from 'vitest';
import { notificationLaunchIntent } from './browserEnvironment';

describe('notification launch intent', () => {
  it('targets the participant carried by a review notification', () => {
    expect(notificationLaunchIntent('?open=review&participant=participant-alex')).toEqual({
      kind: 'review',
      participantId: 'participant-alex',
    });
  });

  it('ignores incomplete and unrelated notification routes', () => {
    expect(notificationLaunchIntent('?open=review')).toBeUndefined();
    expect(notificationLaunchIntent('?open=verification&participant=participant-alex')).toBeUndefined();
  });
});
