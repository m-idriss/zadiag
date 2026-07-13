## Outcome

<!-- Describe the complete user or engineering outcome, not the list of files. -->

## Coherence

- Canonical source of truth changed:
- Superseded code removed:
- Compatibility path and removal condition, if any:

## Verification

- [ ] The change is one complete, deployable slice rather than an intermediate patch.
- [ ] No parallel implementation, speculative abstraction, or one-off variant was added.
- [ ] UI changes reuse semantic tokens and cover relevant responsive, state, focus, and contrast behavior.
- [ ] Relevant focused tests pass.
- [ ] `pnpm check` passes (`pnpm check:full` when Firestore rules change).
- [ ] The entire diff was reviewed against [AGENTS.md](../AGENTS.md).
