# Zadiag

Zadiag is a PWA-first family app for simple treatment follow-up. It is designed
to be easy to install on iPhone, link a child device, and receive reminders
without needing App Store distribution during testing.

## What the app does

- Guides the family through three onboarding steps: install on the Home Screen,
  link parent and child, then enable notifications.
- Lets a parent create a family, generate a linking code, and recover access
  later with a secure recovery code.
- Lets the child phone join with a one-time code and request push permission.
- Stores history, status, and reminder state in Firebase when configured.
- Keeps the camera flow privacy-first: the child takes a live photo in the app,
  and the UI makes it clear that photos are not uploaded in demo mode.

## Current stack

- React 19 + TypeScript
- Ionic UI components
- Vite + PWA support
- Firebase Auth, Firestore, Cloud Functions, and App Check
- Web Push with a standards-based subscription flow
- Vercel for hosting the web app

## Local development

Install dependencies:

```sh
pnpm install
```

Run the app:

```sh
pnpm dev
```

Run the checks:

```sh
pnpm test
pnpm test:rules
pnpm build
pnpm --prefix functions test
```

## Environment variables

Copy the example files and fill in your values:

```sh
cp .firebaserc.example .firebaserc
```

The public web config lives in `.env.example` and is required when Firebase is
enabled:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_APP_CHECK_SITE_KEY`
- `VITE_WEB_PUSH_PUBLIC_KEY`

If those values are missing, the app falls back to its local demo repository so
you can still test the UI without Firebase.

For the AI-powered verification flow, set the Firebase Functions secret:

- `AI_GATEWAY_API_KEY`

## Firebase setup

To enable the full family-link flow:

1. Create a Firebase project.
2. Enable Anonymous Authentication.
3. Create Firestore in a European region.
4. Register the web app.
5. Create a reCAPTCHA Enterprise App Check key for the deployed domains.
6. Add the public Firebase values to your Vercel environment.
7. Add the `AI_GATEWAY_API_KEY` secret to Firebase Functions.
8. Deploy Firestore rules and Cloud Functions.

The backend uses callable functions, App Check, and Firestore listeners to keep
the parent and child devices in sync. Linking codes are one-time and expire,
and parent recovery codes are hashed, time-limited, and rotated after use.

## Deploying

Build the app:

```sh
pnpm build
```

Deploy the Firebase backend:

```sh
firebase deploy --only firestore,functions
```

For Vercel, import the repository and set the root directory to the project
folder that contains this README. Add the public Firebase and Web Push values
in the Vercel project environment.

## iPhone testing flow

1. Open the app in Safari.
2. Install it to the Home Screen.
3. Create the parent family or join with the child linking code.
4. Enable notifications on the child phone.

That is the intended test path for a one-month pilot: install, link, then
notifications.

## Notes and limits

- This project is privacy-first, not a medical device.
- The verification result is a structured app response, not a diagnosis.
- The app is still built for testing and iteration, so some flows may evolve.

## App versioning

- The app displays its version and last update timestamp in Settings.
- Version comes from `package.json`.
- GitHub workflows auto-bump patch versions on pushes to `main`.
