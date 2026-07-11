import type { MessageKey } from '../services/i18n';

export const linkErrorMessageKey = (error: unknown, participantInvitation: boolean): MessageKey => {
  if (!participantInvitation) return 'invalidCode';
  const candidate = error as { code?: unknown; message?: unknown };
  const code = String(candidate?.code ?? '');
  const message = String(candidate?.message ?? '').toLowerCase();
  if (code.includes('not-found')) return 'invitationNotFound';
  if (message.includes('expired')) return 'invitationExpired';
  if (message.includes('already been used')) return 'invitationUsed';
  if (message.includes('already linked') || message.includes('different relationship') || code.includes('already-exists')) {
    return 'participantAlreadyLinked';
  }
  if (code.includes('permission-denied')) return 'invitationPermissionDenied';
  return 'invitationJoinError';
};
