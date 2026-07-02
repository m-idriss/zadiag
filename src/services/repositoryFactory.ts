import type { AppRepository } from './contracts';
import { DemoRepository } from './demoRepository';
import { firebaseEnabled } from './firebaseClient';
import { FirebaseRepository } from './firebaseRepository';

const isLocalhost = /^(localhost|127\.0\.0\.1|::1)$/.test(window.location.hostname);
const useFirebase = import.meta.env.VITE_USE_FIREBASE === 'true';

export const createRepository = (): AppRepository => firebaseEnabled
  ? (isLocalhost && !useFirebase ? new DemoRepository() : new FirebaseRepository())
  : new DemoRepository();
