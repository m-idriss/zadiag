# Deployment workflow

Zadiag limits automatic Vercel deployments to two branches:

- `main` deploys to production;
- `preview` deploys to the shared preview environment;
- all other branches, including `agent/**`, run GitHub CI without creating a Vercel deployment.

## Develop and verify locally

Keep related changes on one feature branch and avoid pushing every small visual adjustment. Use the local application and checks while iterating:

```sh
corepack pnpm dev
corepack pnpm test
corepack pnpm test:rules
corepack pnpm build
npm --prefix functions test
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

Before opening the delivery pull request:

1. Group the related changes into one branch.
2. Run the relevant local checks.
3. Increment `package.json` once in that same branch.
4. Push once and open the pull request.
5. Merge after CI succeeds.

The merge into `main` creates the single production deployment. There is no automatic follow-up version commit.

Use the manual **Force app version bump** GitHub workflow only when a version-only release is intentionally required. Because it writes to `main`, it creates its own production deployment.

## Expected deployment count

| Activity | Vercel deployments |
| --- | ---: |
| Local iteration | 0 |
| Feature branch push / pull request | 0 |
| Optional shared preview | 1 |
| Merge into `main` | 1 |
| Manual version-only release | 1 |

