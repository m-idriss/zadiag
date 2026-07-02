import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions, type Functions } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY;
const appCheckDebugToken = import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN;
export const firebaseEnabled = Object.values(config).every(Boolean) && Boolean(appCheckSiteKey);

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  functions: Functions;
}

let services: FirebaseServices | undefined;

export function getFirebaseServices(): FirebaseServices {
  if (!firebaseEnabled) throw new Error('firebase_not_configured');
  if (!services) {
    const app = initializeApp(config);
    if (appCheckDebugToken) {
      (self as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = appCheckDebugToken;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    services = {
      app,
      auth: getAuth(app),
      db: getFirestore(app),
      functions: getFunctions(app, 'europe-west1'),
    };
  }
  return services;
}
