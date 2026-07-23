# Engineering guardrails

These rules apply to every change in this repository, whether made by a person
or an automated agent. They are the source of truth for delivery discipline;
do not duplicate them in feature documentation.

## Work in coherent slices

- Inspect the complete affected flow, its tests, and existing conventions
  before editing. Fix the source of a problem, not only its visible symptom.
- Define one outcome and the evidence that will prove it before changing code.
  A commit must leave that outcome complete, reviewable, and deployable.
- Prefer one coherent batch over a succession of tiny patches. Do not commit or
  bump the version for intermediate formatting, naming, or follow-up cleanup
  that belongs to the same outcome.
- Do not mix opportunistic cleanup with an unrelated behavior change. Include
  cleanup only when it removes duplication or complexity in the touched flow.
- Read the whole diff before delivery. Remove superseded branches, imports,
  styles, comments, tests, and compatibility code in the same batch.

## Keep one model of the system

- Maintain one source of truth for each rule, state transition, presentation,
  and configuration value. Reuse it instead of creating a parallel helper.
- Do not add a wrapper, hook, component, variant, boolean prop, or generic type
  for a single speculative use. Extract only when there are at least two real
  consumers and the result reduces total code or centralizes an invariant.
- Keep compatibility paths only for identified persisted or deployed data.
  Name the boundary, cover it with a test, and state the removal condition.
- Avoid mode flags and fallback implementations that let two architectures
  coexist indefinitely. A migration must have a canonical target.
- Comments explain constraints or decisions; they must not narrate the code or
  maintain a second specification of behavior.

## Refactor safely

- Define the behavior that must remain unchanged and the duplicated decision,
  competing implementation, or manual synchronization being removed before
  editing. Moving code without simplifying one of those is not a completed
  refactor.
- Identify or add a characterization test before changing a cross-cutting
  boundary. Assert observable behavior and stable errors, not the new internal
  shape.
- Inspect every implementation, adapter, lazy loader, mock, persisted boundary,
  and composition-root binding when an interface or shared contract changes.
- Optional capabilities must have one explicit availability boundary and one
  stable unavailable result. Do not let each caller invent fallback behavior.
- Treat a large module as a prompt to audit mixed responsibilities, not as an
  automatic reason to split it. Extract only a cohesive responsibility with a
  clear dependency direction and more than one meaningful operation.

## Preserve module direction

- `src/domain` is framework- and infrastructure-independent.
- `src/services` may depend on `src/domain`, never on UI layers.
- `src/components` may depend on domain and services, never on screens.
- `src/hooks` may depend on domain and services, never on components or screens.
- `src/screens` composes the lower layers. `src/App.tsx` is the application
  composition root.
- Client code and `functions/src` are separate deployment units and must not
  import each other.
- Relative import cycles are forbidden. Run `pnpm check:architecture` after
  moving code across modules.

## Verify and deliver

- Add or update tests at the boundary where behavior lives. Do not encode an
  implementation detail merely to make a refactor look covered.
- Run the narrow relevant tests while iterating, then `pnpm check` before a
  normal delivery. Use `pnpm check:full` when Firestore rules, authorization,
  authentication, permission enforcement, or persisted-data migrations are
  affected.
- Keep bundle and architecture checks green. Do not silence a guardrail with an
  exception unless the repository architecture itself is intentionally changed.
- Follow `DESIGN.md` for UI changes and keep `pnpm check:design` green. New
  visual foundations belong in semantic tokens, not individual screens.
- Bump the application version once per deployable batch, not once per edit.
- Use an explicit commit message describing the completed outcome.

## Publish deliberately

- Start new work from the latest `origin/main` on a branch dedicated to one
  outcome. Do not reuse a branch that has already been merged.
- Local completion does not imply publication. Prepare the version bump,
  commit, and remote branch only when delivering the coherent batch.
- Follow `docs/deployment-workflow.md`: push the validated feature branch, open
  a pull request, and let its merge create the production deployment. Do not
  push directly to `main` unless the user explicitly requests that delivery
  mode.
- Before merging, confirm the branch contains only the intended commits, is
  based on the current default branch, and has the required checks passing.
- After publishing, report the branch, commit, pull request or explicit direct
  merge, validation performed, and any known warnings. Confirm that the
  worktree is clean.

When the requested work conflicts with these rules, surface the conflict before
adding another implementation path. Simplicity means fewer active concepts,
not merely fewer lines in the latest patch.
