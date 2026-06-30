# Zadiag PWA

An installable, PWA-first treatment follow-up app for families. The initial
prototype tests orthodontic-elastics adherence on iPhone without Apple Developer
distribution, while the Zadiag brand can support additional treatment routines.

## Current vertical slice

- Parent and child roles with a one-time demo link code (`ZD-4821`)
- Explicit parent consent
- Parent adherence dashboard and history
- Child check/progress experience
- Live `getUserMedia` camera capture with no gallery input
- One-use session and capture timestamp validation
- Simulated structured AI result; no photo leaves the device
- English and French UI
- iPhone standalone manifest and custom service worker
- Generic Web Push handler ready for a VAPID subscription

## Run locally

```sh
npm install
npm run dev
```

Camera access requires HTTPS except on `localhost`. For an iPhone test, deploy the
`dist/` output to Firebase Hosting or another HTTPS host.

## Deploy after creating a Firebase project

```sh
cp .firebaserc.example .firebaserc
# Replace the placeholder project ID, then:
npm run build
firebase deploy --only hosting
```

## Production boundary

The demo repository intentionally stores only structured demo state in localStorage.
Before processing a minor's photo, implement `FamilyRepository` and
`VerificationGateway` against authenticated backend endpoints, deploy deny-by-default
Firebase Rules, enable App Check, and configure lifecycle deletion.

The web camera removes the gallery control but cannot offer native anti-tamper
guarantees. Treat a server nonce, capture timestamp, digest, and random visual
challenge as risk reduction—not proof of identity or medical compliance.

## Firebase backend

The app keeps its local demo behavior until every `VITE_FIREBASE_*` value in
`.env.example` is configured. Once configured, it uses anonymous Firebase Auth,
callable Cloud Functions, App Check, and real-time Firestore listeners to link the
parent and child devices.

Setup requirements:

1. Create a Firebase project and enable the Blaze plan (required for Cloud Functions).
2. Enable Anonymous Authentication and create a Firestore database in a European region.
3. Register the web app and a reCAPTCHA Enterprise App Check key for the Vercel domains.
4. Copy `.firebaserc.example` to `.firebaserc` and set the Firebase project ID.
5. Add the public Firebase web values from `.env.example` to the Vercel project.
6. Deploy the backend with `firebase deploy --only firestore,functions`.

The callable functions run in `europe-west1`, enforce App Check, create single-use
24-hour linking codes, and keep code hashes private. Photos are not uploaded or
stored by this implementation; only structured check metadata is synchronized.

Local verification:

```sh
npm test
npm run test:rules
npm run build
npm --prefix functions test
```
