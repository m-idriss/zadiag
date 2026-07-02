# Routine-centric rollout and rollback

## Release order

1. Deploy Firestore rules and indexes.
2. Deploy Cloud Functions and verify `migrateFamilyRoutines` plus per-routine scheduling.
3. Run `npm test --prefix functions` as the migration rehearsal.
4. Build the client with `VITE_ROUTINE_CENTRIC_UI=true` and run `pnpm check:bundle`.
5. Deploy the client, then verify linking, Today, Routines, routine details, photo submission, and notifications on a participant device.

## Monitoring

- Watch Cloud Function errors for migration, scheduler, and callable authorization failures.
- Confirm scheduled checks carry `routineId` and do not duplicate `dispatchKey` within one routine.
- Confirm separate routines can each have an active pending check.
- Confirm the participant sees only events belonging to the selected routine.

## Immediate UI rollback

Set `VITE_ROUTINE_CENTRIC_UI=false` in the production environment and redeploy the client. This restores the legacy participant tab (`Progress`) while leaving the additive routine data intact.

## Backend rollback

Do not delete routine assignments or remove `routineId` from checks. If scheduler errors increase, disable the scheduled function or roll it back to the previous deployment while keeping the migrated data. The migration is additive and idempotent, so the routine-aware backend can be redeployed after correction.

## Release gate

General release is allowed only when frontend tests, Firestore rule tests, function tests, migration rehearsal, production build, and bundle-size check all pass.
