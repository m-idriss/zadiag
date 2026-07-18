# AI authoring controls

AI-assisted authoring is optional and separate from proof analysis. Both authoring capabilities default to disabled. The existing private routine editor and manual translation workflow remain canonical and require no provider.

`AI_AUTHORING_CONFIG` is a server environment JSON value with `globalEnabled`, a non-empty `privacyApprovalId`, and per-capability booleans for `prescriptionExtraction` and `routineTranslation`. All three conditions must be true before the reusable server guard permits a capability. Missing or malformed configuration fails closed. Production configuration must remain disabled until #167 records privacy and regulatory approval.

The server registry pins provider, model and prompt versions. Operational metrics may contain only capability, bounded status/latency, provider, model and prompt version. They must never contain prompts, outputs, prescriptions, routine text, participant data or proofs.

Every future provider call must invoke the guard before preparing provider input, validate output server-side, and store suggestions only as `pending_human_review` drafts with publishing, assignment and activation disabled. Provider failure, invalid output or a kill switch returns the user to the existing manual workflow without modifying their draft.

Emergency shutdown: set `globalEnabled` to false or remove `AI_AUTHORING_CONFIG`, deploy Functions, verify `getAiAuthoringCapabilities` reports both capabilities disabled, and confirm manual draft creation/editing still passes its smoke test.
