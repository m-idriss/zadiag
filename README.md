<div align="center">

<img src="public/icons/icon-192.png" alt="Zadiag app icon" width="112" />

<h1>Zadiag</h1>

<h3>Family routine follow-up, built as an installable iPhone-first PWA.</h3>

<a href="https://react.dev"><img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=0B1320" alt="React 19" /></a>
<a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 6" /></a>
<a href="https://firebase.google.com/"><img src="https://img.shields.io/badge/Firebase-Backend-FFCA28?style=for-the-badge&logo=firebase&logoColor=0B1320" alt="Firebase backend" /></a>
<a href="public/icons/icon-512.png"><img src="https://img.shields.io/badge/PWA-Ready-6B46C1?style=for-the-badge" alt="PWA ready" /></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="MIT License" /></a>

[![CI](https://github.com/m-idriss/zadiag/actions/workflows/ci.yml/badge.svg)](https://github.com/m-idriss/zadiag/actions/workflows/ci.yml)

<p><a href="https://www.zadiag.com"><strong>Open the deployed app →</strong></a></p>

<p><strong>Zadiag helps a responsible adult and a participant coordinate simple treatment routines.</strong> A responsible device creates the family space and routines; the participant device receives check requests, sends proof, and keeps the flow lightweight during a pilot.</p>

</div>

---

## What Zadiag Does

| Area | Details |
|------|---------|
| Family linking | Create a private family space, generate one-time linking codes, and recover responsible access with rotating recovery codes. |
| Participant flow | Install the PWA, join with a code, enable notifications, and respond to routine checks from the phone. |
| Routine tracking | Assign routine templates, schedule checks, request an immediate check, and keep a shared event history. |
| Proof capture | Guide the participant through a live camera capture and validate freshness before accepting a proof. |
| Responsible review | Review uncertain proof, approve or reject it, and preserve a clear history of decisions. |
| Privacy-first defaults | Demo mode stays local; production uses Firebase with App Check, callable Functions, scoped storage, and cleanup paths. |

Zadiag is a support tool for routine follow-up. It is not a medical device and does not provide a diagnosis.

## Why Zadiag

Routine follow-up often breaks down between a plan being prescribed and the
moment it must be completed at home. Zadiag gives both sides a deliberately
small workflow: schedule, notify, confirm, review. It is designed for families
that need reassurance and shared visibility without turning daily care into a
complex administrative process.

The current product wedge is an iPhone-first, installable pilot that requires no
App Store release. Its privacy-oriented architecture, local demo mode, bilingual
interface, and explicit caregiver/participant roles make it suitable for fast,
measurable field learning before broader product or regulatory investment.

## Product Status

| Dimension | Current state |
|-----------|---------------|
| Stage | Working pilot software; not a certified medical device |
| Users | Responsible adult and linked participant |
| Platforms | Installable web app, optimized for iPhone |
| Languages | French and English |
| Backend | Firebase production path plus local demo mode |
| Quality gates | App, Functions, Firestore rules, build, and bundle checks in CI |

The [product brief](docs/product-brief.md) captures the pilot hypothesis,
success metrics, differentiation, risks, and evidence needed for the next stage.

## Architecture

| Layer | Technology |
|-------|------------|
| Web app | React 19, TypeScript, Ionicons, Vite |
| PWA | Vite PWA, Workbox precaching, Web Push, app badge support |
| Backend | Firebase Auth, Firestore, Cloud Functions, Storage, App Check |
| Hosting | Vercel for the web app, Firebase for backend services |
| Tests | Vitest, jsdom, Firebase rules unit tests, Node test runner for Functions |

The app can run without Firebase configuration in local demo mode. When all Firebase environment variables are present, it switches to the real repository and enables the full family-link, push, storage, and callable Functions flow.

## Quick Start

**Prerequisites:** Node.js 22+, pnpm 11.7+, Java 21 for Firestore rules tests.

```sh
corepack enable
corepack pnpm install
corepack pnpm dev
```

Common checks:

```sh
corepack pnpm check
```

`check` runs the app tests, typecheck, production build, bundle budget, and
Functions tests. Before merging or deploying, use `corepack pnpm check:full` to
include Firestore rules tests (Java 21 required).

The dev server is served by Vite. If Firebase variables are missing, the app falls back to the local demo repository so the UI remains usable.

## Configuration

Copy the Firebase project template:

```sh
cp .firebaserc.example .firebaserc
```

Public web configuration lives in `.env.example`:

```sh
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_APP_CHECK_SITE_KEY=
VITE_WEB_PUSH_PUBLIC_KEY=
```

For AI-powered verification, configure the Firebase Functions secret:

```sh
firebase functions:secrets:set AI_GATEWAY_API_KEY
```

## Firebase Setup

To enable the production-like pilot flow:

1. Create a Firebase project.
2. Enable Anonymous Authentication.
3. Create Firestore in a European region.
4. Register the web app.
5. Create a reCAPTCHA Enterprise App Check key for the deployed domains.
6. Add the public Firebase and Web Push values to the Vercel environment.
7. Set the `AI_GATEWAY_API_KEY` Functions secret.
8. Deploy Firestore rules, indexes, and Cloud Functions.

The backend uses App Check protected callable Functions and Firestore listeners. Linking codes are one-time and expire. Recovery codes are hashed, time-limited, and rotated after use.

## Deployment

Build the web app:

```sh
corepack pnpm build
```

Deploy the Firebase backend:

```sh
corepack pnpm exec firebase deploy --only firestore,functions
```

Deploy the web app through Vercel by importing this repository and setting the project root to the folder containing this README. Configure the same public Firebase and Web Push environment variables in Vercel.

## iPhone Pilot Flow

1. Open Zadiag in Safari.
2. Install it to the Home Screen.
3. Create the responsible family space.
4. Link the participant phone with the private code.
5. Enable notifications on the participant phone.
6. Request or wait for routine checks.
7. Submit proof from the participant device.
8. Review uncertain results from the responsible device.

This is the intended one-month pilot path: install, link, notify, capture, review, iterate.

## Documentation

[Product brief](docs/product-brief.md), [Deployment workflow](docs/deployment-workflow.md), [Caregiver and participant architecture](docs/caregiver-participant-architecture.md), [Create a routine](docs/create-routine.md), [Routine marketplace](docs/routine-marketplace.md), [Routine rollout](docs/routine-rollout.md), [Routine examples](routines/README.md), [Security policy](SECURITY.md), [Firestore rules](firestore.rules), [Firebase indexes](firestore.indexes.json)

## Project Scripts

| Command | Purpose |
|---------|---------|
| `corepack pnpm dev` | Start the Vite development server. |
| `corepack pnpm check` | Run the everyday app, build, bundle, and Functions checks. |
| `corepack pnpm check:full` | Run `check` plus Firestore rules tests before delivery. |
| `corepack pnpm check:security` | Check production dependencies against current vulnerability advisories. |
| `corepack pnpm test` | Run web app tests. |
| `corepack pnpm test:rules` | Run Firestore rules tests through the emulator. |
| `corepack pnpm build` | Typecheck and build the PWA. |
| `corepack pnpm check:bundle` | Enforce bundle-size expectations. |
| `npm --prefix functions test` | Build and test Firebase Functions. |

## Notes And Limits

- Zadiag is privacy-first, but pilot deployments still require careful Firebase, App Check, and storage configuration.
- Verification results are structured app responses, not medical conclusions.
- Proof image retention and cleanup should be reviewed before any broader rollout.
- iOS PWA notifications and badges depend on install state, permission state, and Safari/iOS behavior.

## Versioning

- The app displays its version and last update timestamp in Settings.
- Version comes from `package.json`.
- GitHub workflows can auto-bump patch versions on pushes to `main`.

---

MIT License - **Idriss** - [@m-idriss](https://github.com/m-idriss)
