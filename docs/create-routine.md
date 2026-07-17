# Create a Routine

This guide explains how to add a routine as a file so it can be reviewed, versioned, and later published to the marketplace.

## File Location

Create one JSON file per routine in `routines/`.

```text
routines/night-retainer.json
routines/physical-therapy-knee.json
routines/daily-hydration.json
```

Use `routines/template.json` as the starting point.

The validation contract lives in `routines/schema.json`.

## Routine Shape

Each file contains a Routine Package V1 envelope around a reusable `RoutineTemplate.routine`. The app snapshots only the nested routine into a family-specific `RoutineAssignment` when a responsible user assigns it.

```json
{
  "schemaVersion": 1,
  "version": 1,
  "defaultLocale": "en",
  "availableLocales": ["en", "fr"],
  "routine": {}
}
```

Package V1 is limited to 64 KiB, English plus French, and two to four instruction steps. `routines/schema.json` contains the per-field limits. Declared locales must exactly match translations, and translated step IDs and order must match the default locale.

Required fields inside `routine`:

```json
{
  "id": "night-retainer",
  "name": "Night retainer",
  "description": "Nightly retainer wear check.",
  "instructions": "Wear your retainer as prescribed and send a clear photo when requested.",
  "icon": "smile",
  "accentColor": "#2387c9",
  "category": "custom",
  "proofType": "Photo",
  "proofExample": "Photo showing the expected retainer proof.",
  "recommendedValidationMode": "ai",
  "responsibleName": "Care team",
  "analysis": {
    "expectedEvidence": "A clear photo showing the retainer being worn or prepared for wear.",
    "detectedCriteria": "The photo clearly shows the expected retainer proof.",
    "notDetectedCriteria": "The photo is clear but does not show a retainer or related proof.",
    "uncertaintyCriteria": "The proof is ambiguous, cropped, too dark, blurry, or unrelated."
  },
  "instructionSteps": []
}
```

## Writing Good Verification Criteria

Write criteria for visible adherence proof only.

Good:

- "The photo clearly shows a water bottle, glass of water, hydration tracker, or the participant drinking water."
- "The image is clear but contains no medication package, pill organizer, dose, or medication proof."

Avoid:

- Diagnosis or clinical interpretation.
- Criteria that require knowing intent.
- Criteria that require reading private medical labels unless the routine explicitly needs that proof.

## Translations

Add French under `translations.fr` with the same meaning as English:

```json
{
  "translations": {
    "fr": {
      "name": "Hydratation",
      "description": "Contrôle quotidien de l'hydratation.",
      "instructions": "Quand c'est demandé, envoie une preuve claire."
    }
  }
}
```

## Review Process

1. Add or update the JSON file in `routines/`.
2. Check that the routine id is stable and unique.
3. Check that `analysis` is specific enough for AI verification.
4. Generate both deployable catalogs and validate that no generated file is stale.
5. Run:

```bash
corepack pnpm generate:routines
corepack pnpm check:routines
corepack pnpm check
```

The JSON files are the only authored source for built-in routine content. Files under `src/generated/` and `functions/src/generated/` are committed build artifacts and must never be edited manually.

## Separate Repository Option

If routines become community-maintained, split them into a dedicated repository with the same layout:

```text
zadiag-routines/
  routines/
    schema.json
    template.json
    daily-hydration.json
    night-retainer.json
```

The app repository can then consume that catalog through a package, a generated artifact, or a CI sync step.
