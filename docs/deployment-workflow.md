# Deployment workflow

Zadiag limits automatic Vercel deployments to two branches:

- `main` deploys to production;
- `preview` deploys to the shared preview environment;
- all other branches, including `agent/**`, run GitHub CI without creating a Vercel deployment.

## Develop and verify locally

Keep related changes on one feature branch and avoid pushing every small visual adjustment. Use the local application and checks while iterating:

```sh
corepack pnpm dev
corepack pnpm check
corepack pnpm check:full # before delivery; includes Firestore rules
```

Browser responsive mode is the default way to check intermediate mobile layouts. A real iPhone preview is created only when browser behavior, PWA installation, camera, or push notifications need remote verification.

## Request a remote preview

Update the shared `preview` branch from the feature branch only when a remote check is useful:

```sh
git push origin HEAD:preview --force-with-lease
```

This creates one Vercel preview deployment containing the latest complete iteration. Continue checking locally until another remote preview is genuinely needed.

The `preview` branch is disposable and must never be merged back into `main`. The feature branch remains the source of the pull request.

## Release to production

The launch access notification requires three Firebase Functions secrets before
deploying the backend:

```sh
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set USER_MODERATION_EMAIL
firebase functions:secrets:set USER_MODERATION_FROM_EMAIL
```

`USER_MODERATION_EMAIL` receives each new-user notification.
`USER_MODERATION_FROM_EMAIL` must be a sender accepted by the configured Resend
account. The moderation link opens a confirmation page before suspending access.

Before opening the delivery pull request:

1. Group the related changes into one branch.
2. Run the relevant local checks.
3. Increment `package.json` once in that same branch.
4. Push once and open the pull request.
5. Merge after CI succeeds.

The merge into `main` creates the single production deployment. There is no automatic follow-up version commit.

Use the manual **Publish version-only release** GitHub workflow only when a version-only release is intentionally required. Because it writes to `main`, it creates its own production deployment.

The workflow accepts only a version greater than the current application version. It refuses an existing tag or release, then pushes the version commit and annotated tag atomically. GitHub release immutability is enabled for the repository and applies to future releases. Published version tags and releases are never moved or edited; use a new version to correct a release.

## Dependency security

Production dependency audits run every Monday and can also be started manually through the **Dependency security** workflow. Dependabot checks the web app, Functions, and GitHub Actions weekly. Minor and patch updates are grouped by deployment unit so routine maintenance remains reviewable without producing a stream of tiny pull requests.

Treat an audit or Dependabot alert as a signal to inspect the affected dependency and its reachable use before upgrading. Keep the remediation in one validated batch and run `pnpm check` (`pnpm check:full` when Firestore rules are involved) before merging it.

## Expected deployment count

| Activity | Vercel deployments |
| --- | ---: |
| Local iteration | 0 |
| Feature branch push / pull request | 0 |
| Optional shared preview | 1 |
| Merge into `main` | 1 |
| Manual version-only release | 1 |
