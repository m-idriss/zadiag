import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import {
  firebaseAppCheckDebugToken,
  firebaseAppCheckSiteKey,
  firebaseConfig,
  firebaseEnabled,
} from './firebaseConfig';

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
  storage: FirebaseStorage;
}

let services: FirebaseServices | undefined;

export function getFirebaseServices(): FirebaseServices {
  if (!firebaseEnabled) throw new Error('firebase_not_configured');
  if (!services) {
    const app = initializeApp(firebaseConfig);
    if (firebaseAppCheckDebugToken) {
      (self as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = firebaseAppCheckDebugToken;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(firebaseAppCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    services = {
      app,
      auth: getAuth(app),
      db: getFirestore(app),
      functions: getFunctions(app, 'europe-west1'),
      storage: getStorage(app),
    };
  }
  return services;
}
