import { beforeEach, describe, expect, it } from 'vitest';
import { captureRelationshipInvitationCode, notificationLaunchIntent, relationshipInvitationCode, relationshipInvitationUrl } from './browserEnvironment';

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

describe('relationship invitation links', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the one-time code in the URL fragment and restores it', () => {
    const url = relationshipInvitationUrl(' zi-123456 ', 'https://app.zadiag.fr/');

    expect(url).toBe('https://app.zadiag.fr/#invite=ZI-123456');
    expect(captureRelationshipInvitationCode(new URL(url).hash)).toBe('ZI-123456');
    expect(relationshipInvitationCode('')).toBe('ZI-123456');
  });

  it('ignores malformed invitation fragments', () => {
    expect(relationshipInvitationCode('#invite=ZI-12345')).toBeUndefined();
    expect(relationshipInvitationCode('#other=ZI-123456')).toBeUndefined();
  });
});
