import {
  signInAnonymously,
  signInWithEmailAndPassword,
  type Auth,
  type User,
} from 'firebase/auth';

interface SyntheticMonitorCredentials {
  email: string;
  password: string;
}

declare global {
  var __ZADIAG_SYNTHETIC_MONITOR_AUTH__: SyntheticMonitorCredentials | undefined;
}

const syntheticMonitorCredentials = (): SyntheticMonitorCredentials | undefined => {
  const credentials = globalThis.__ZADIAG_SYNTHETIC_MONITOR_AUTH__;
  if (credentials === undefined) return undefined;
  const email = typeof credentials?.email === 'string' ? credentials.email.trim().toLowerCase() : '';
  const password = typeof credentials?.password === 'string' ? credentials.password : '';
  if (!email || password.length < 12) throw new Error('synthetic_monitor_auth_invalid');
  return { email, password };
};

export const authenticateFirebaseUser = async (auth: Auth, currentUser: User | null) => {
  const credentials = syntheticMonitorCredentials();
  if (!credentials) return currentUser ?? (await signInAnonymously(auth)).user;
  if (currentUser && !currentUser.isAnonymous && currentUser.email?.toLowerCase() === credentials.email) return currentUser;
  return (await signInWithEmailAndPassword(auth, credentials.email, credentials.password)).user;
};
