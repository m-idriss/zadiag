# Routine Catalog

This directory is the file-based source for versioned routine packages that can later be imported into the app marketplace.

Use one file per routine:

```text
routines/
  orthodontic-elastics.json
  daily-hydration.json
  medication.json
```

## Create a Routine

1. Copy `template.json` to `your-routine-id.json`.
2. Use a stable kebab-case `id`, for example `night-retainer` or `physical-therapy-knee`.
3. Fill the English content first.
4. Add French content under `translations.fr` when available.
5. Define the `analysis` block carefully. This is what the verification prompt uses.
6. Keep `accentColor` as a hex color like `#2387c9`.
7. Run `npm run generate:routines`, then `npm run check:routines` before opening a PR.

`schema.json` documents the validation contract. The generator is the executable validation source used by CI for the template and every routine package, and it refuses stale generated catalogues.

## Package V1

Every file is a data-only package with this envelope:

```json
{
  "schemaVersion": 1,
  "version": 1,
  "defaultLocale": "en",
  "availableLocales": ["en", "fr"],
  "routine": {}
}
```

- `schemaVersion` identifies the validation contract and is currently `1`.
- `version` is a positive, immutable content version.
- Package V1 uses English as its default locale to preserve existing assignment snapshots.
- `availableLocales` must exactly describe the default locale and translations present.
- Packages are limited to 64 KiB, two supported locales, four steps, and the field limits encoded in `schema.json`.
- Unknown fields and executable content are rejected.

The generator validates this envelope, then emits only `routine` into the client and Functions catalogues. Existing stored `Routine` snapshots therefore keep their current shape.

## Required Routine Fields

- `id`: stable unique id.
- `name`: short display name.
- `description`: one sentence describing what is tracked.
- `instructions`: what the participant should do.
- `proofType`: usually `Photo`.
- `analysis.expectedEvidence`: what proof is acceptable.
- `analysis.detectedCriteria`: when the proof should pass.
- `analysis.notDetectedCriteria`: when the proof should fail.
- `instructionSteps`: 2 to 4 short steps for the participant.

## Review Checklist

- The routine describes a repeatable behavior, not a one-off task.
- The proof can realistically be checked from a live photo.
- The criteria avoid medical diagnosis and only check visible adherence proof.
- The text is understandable by a participant without extra training.
- The routine does not require storing sensitive details beyond the proof itself.

## Import Path

Built-in routines use this flow:

1. Keep one routine file here.
2. Validate these JSON files in CI.
3. Generate the frontend and Functions catalogs from these files with `npm run generate:routines`.
4. Publish selected routines to Firestore `routineTemplates` for the marketplace.

If this grows into its own repository later, keep the same structure:

```text
zadiag-routines/
  routines/
    schema.json
    template.json
    daily-hydration.json
  README.md
```
