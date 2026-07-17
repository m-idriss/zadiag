import type { AppState } from './models';
import { currentPilotParticipation } from './pilotParticipation';

export type AppRoute = 'install' | 'contact' | 'suspended' | 'invitation' | 'welcome' | 'link' | 'pilot-consent' | 'notifications' | 'app' | 'camera' | 'result' | 'routine-edit';

export interface RouteContext {
  setupPreview?: Extract<AppRoute, 'install' | 'notifications'> | null;
  requiresInstall?: boolean;
  useLocalDemo?: boolean;
  invitationCode?: string;
}

export const routeForState = (state: AppState, context: RouteContext = {}): AppRoute => {
  if (context.setupPreview) return context.setupPreview;
  if (context.requiresInstall) return 'install';
  if (state.accessStatus === 'suspended') return 'suspended';
  if (!context.useLocalDemo && !state.contactEmail) return 'contact';
  if (context.invitationCode) return 'invitation';
  if (!state.role) return 'welcome';
  if (!state.family.linked) return 'link';
  if (!currentPilotParticipation(state.pilotParticipation)) return 'pilot-consent';
  if (context.useLocalDemo && state.role === 'child' && !state.notificationsEnabled) return 'app';
  if (state.role === 'child' && !state.notificationsEnabled) return 'notifications';
  return 'app';
};
