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
