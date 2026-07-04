# Routine Marketplace Architecture

## Goal

Routines need to be separated into two concepts:

- `RoutineTemplate`: a reusable routine definition that can be built in, private, unlisted, or public.
- `RoutineAssignment`: a family-specific instance of a routine with its own monitoring plan, status, and history.

An assignment must snapshot the routine template at assignment time. This keeps a family's history stable if the shared template is edited, unpublished, or moderated later.

## Data Model

Recommended Firestore structure:

```text
routineTemplates/{templateId}
  routine: Routine
  visibility: "private" | "unlisted" | "public"
  ownerFamilyId: string
  sourceTemplateId?: string
  shareCode?: string
  createdAt: string
  updatedAt: string
  publishedAt?: string
  moderationStatus?: "draft" | "pending" | "approved" | "rejected"

families/{familyId}/routineAssignments/{assignmentId}
  routineId: string
  templateId?: string
  routine: Routine
  plan: MonitoringPlan
  status: "active" | "paused" | "completed"
  assignedAt: string
```

Keep built-in templates in code for offline/demo startup, but expose them through the same marketplace abstraction as remote templates.

## File-Based Routine Source

Routines should be authored as one file per routine under `routines/`.

```text
routines/daily-hydration.json
routines/medication.json
routines/mobility-exercise.json
```

See `docs/create-routine.md` for the authoring guide and `routines/template.json` for the expected shape.

This gives us a repo-friendly workflow before the full marketplace backend exists:

1. A routine is proposed as a JSON file.
2. The file is reviewed in a PR.
3. Approved routines can be added to the built-in catalog or published to Firestore `routineTemplates`.
4. Later, CI can validate and generate the TypeScript catalog from these files.

## Flows

### Create a Routine

1. Parent fills a routine template form: name, description, instructions, proof type, expected evidence, detection criteria, icon/accent.
2. App calls `createRoutineTemplate`.
3. Backend stores it as `private` and returns `templateId`.
4. Parent can assign it to the current family immediately.

### Share a Routine

1. Parent chooses Share.
2. App calls `createRoutineShare`.
3. Backend marks the template `unlisted`, generates a short `shareCode`, and returns a share URL such as `/routines/import/{shareCode}`.
4. Another parent imports it with `importRoutineTemplate`.
5. Backend copies the template into the new family's private templates with `sourceTemplateId`.

### Publish to Marketplace

1. Parent submits a private template for publication.
2. Backend sets `moderationStatus: "pending"`.
3. Approved templates become `public`.
4. The app lists public templates alongside built-in templates.

## API Contract

```ts
createRoutineTemplate(input: { familyId: string; routine: Routine }): Promise<{ templateId: string }>;
updateRoutineTemplate(input: { familyId: string; templateId: string; routine: Routine }): Promise<void>;
createRoutineShare(input: { familyId: string; templateId: string }): Promise<{ shareCode: string; shareUrl: string }>;
importRoutineTemplate(input: { familyId: string; shareCode: string }): Promise<{ templateId: string }>;
assignRoutineTemplate(input: { familyId: string; templateId: string }): Promise<void>;
publishRoutineTemplate(input: { familyId: string; templateId: string }): Promise<void>;
```

`assignRoutineTemplate` should write a snapshot into `families/{familyId}/routineAssignments`, not a reference-only assignment.

## Security Rules

- Only family parents can create or edit templates owned by their family.
- `private` templates are readable only by the owning family.
- `unlisted` templates are readable only through a callable import/share flow, not direct broad reads.
- `public` templates can be read by authenticated users.
- Only Cloud Functions should write assignments, so validation and snapshotting remain centralized.

## Migration

1. Keep existing `routineAssignments.routine` snapshots valid.
2. Add optional `templateId` to new assignments.
3. Treat current catalog routines as built-in templates with `visibility: "builtin"` in the frontend abstraction.
4. Later, backfill existing assignments with `templateId = routineId` when `routineId` matches a built-in template.

## Implementation Order

1. Frontend marketplace abstraction over built-ins.
2. Template editor form for private routines.
3. Demo repository support for create/import/share.
4. Firebase callable functions and rules.
5. Public marketplace listing and moderation workflow.
