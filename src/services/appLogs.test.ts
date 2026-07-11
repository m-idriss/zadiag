import { describe, expect, it } from 'vitest';
import { buildDiagnosticsEmailBody, redactDiagnosticText } from './appLogs';

describe('diagnostic privacy', () => {
  it('redacts common identifiers, codes, tokens, and email addresses', () => {
    const input = 'familyId=fam-123 participantUid: user-456 recoveryCode="ABC-789" token=secret contact@example.com';

    const output = redactDiagnosticText(input);

    expect(output).not.toContain('fam-123');
    expect(output).not.toContain('user-456');
    expect(output).not.toContain('ABC-789');
    expect(output).not.toContain('secret');
    expect(output).not.toContain('contact@example.com');
  });

  it('omits family, check, session, and URL query identifiers from a report', () => {
    window.history.replaceState({}, '', '/settings?linkCode=PRIVATE#secret');

    const report = buildDiagnosticsEmailBody({
      correlationId: 'safe-correlation-id',
      locale: 'en',
      role: 'parent',
      familyId: 'private-family-id',
      notificationsEnabled: false,
      childInstalled: true,
      pendingChecks: 1,
      totalChecks: 1,
      events: [{
        id: 'private-check-id',
        routineId: 'private-routine-id',
        sessionId: 'private-session-id',
        status: 'pending',
        requestedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }],
    });

    expect(report).toContain('FamilyContextPresent: true');
    expect(report).toContain('ActiveCheckPresent: true');
    expect(report).toContain(`url: ${window.location.origin}/settings`);
    expect(report).not.toContain('private-family-id');
    expect(report).not.toContain('private-check-id');
    expect(report).not.toContain('private-session-id');
    expect(report).not.toContain('PRIVATE');
    expect(report).not.toContain('#secret');
  });
});
