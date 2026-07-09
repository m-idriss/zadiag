import {
  normalizeAppPreferences,
  type AppPreferences,
  type AppState,
  type Locale,
  type Role,
} from '../domain/models';

export const PREFERENCES_KEY = 'zadiag.preferences.v1';

export const browserLocale = (): Locale => navigator.language?.startsWith('fr') ? 'fr' : 'en';

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
    notificationsEnabled: false,
    pushHealth: { permission: 'Notification' in window ? Notification.permission : 'unsupported', endpointPresent: false },
    role: preferences.role,
    preferences: normalizeAppPreferences(preferences),
    family: { linked: false, childLinked: false, childName: '', linkingCode: '', parentRecoveryCode: '', consented: false },
    routineAssignments: [],
    routinesLoaded: false,
    routinesError: false,
    events: [],
  };
};
