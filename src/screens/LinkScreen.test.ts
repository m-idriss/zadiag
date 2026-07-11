import { describe, expect, it } from 'vitest';
import { linkErrorMessageKey } from './linkErrors';

describe('linkErrorMessageKey', () => {
  it('keeps legacy linking errors generic', () => {
    expect(linkErrorMessageKey({ code: 'functions/not-found' }, false)).toBe('invalidCode');
  });

  it('explains participant invitation failures', () => {
    expect(linkErrorMessageKey({ code: 'functions/not-found' }, true)).toBe('invitationNotFound');
    expect(linkErrorMessageKey({ message: 'The invitation has expired.' }, true)).toBe('invitationExpired');
    expect(linkErrorMessageKey({ code: 'functions/already-exists' }, true)).toBe('participantAlreadyLinked');
  });
});
