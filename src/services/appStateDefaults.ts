import {
  normalizeAppPreferences,
  type AppPreferences,
  type AppState,
  type Locale,
  type Role,
} from '../domain/models';
import { resolveLocale } from './locale';

export const PREFERENCES_KEY = 'zadiag.preferences.v1';

export const browserLocale = (): Locale => resolveLocale(navigator.language);

export const readStoredPreferences = () => {
  try {
    return JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}') as Partial<AppPreferences> & { locale?: Locale; role?: Role };
  } catch {
    return {};
  }
};

export const initialRemoteState = (): AppState => {
  const preferences = readStoredPreferences();
  return {
    locale: preferences.locale ?? browserLocale(),
    accessStatus: 'active',
    notificationsEnabled: false,
    pushHealth: { permission: 'Notification' in window ? Notification.permission : 'unsupported', endpointPresent: false },
    role: preferences.role,
    preferences: normalizeAppPreferences(preferences),
    family: { linked: false, childLinked: false, childName: '', linkingCode: '', parentRecoveryCode: '', consented: false },
    participantAccess: [],
    routineAssignments: [],
    routinesLoaded: false,
    routinesError: false,
    events: [],
  };
};
