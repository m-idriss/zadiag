# AI authoring controls

AI-assisted authoring is optional and separate from proof analysis. Standard routine proposals are enabled by the checked-in Firebase parameter default; every sensitive capability defaults to disabled. The existing private routine editor and manual translation workflow remain canonical and require no provider.

`AI_AUTHORING_CONFIG` is the single Firebase string parameter for the global kill switch, per-capability switches and sensitive-capability approval record. Its declared default enables only `routineGeneration`. Standard routine generation needs both `globalEnabled` and its own capability switch, but no medical approval record. The UI tells users that only their submitted instruction is sent to Gemini and not to include health or identifying information. An explicit malformed override keeps it disabled.

`prescriptionExtraction`, `routineTranslation` and `dynamicQuizGeneration` additionally require the scoped approval to be `approved`, name the DPO/privacy, legal/regulatory and security approvers, identify the provider contract and data residency, include the exact capability, and be within its approval/expiry dates. Missing, incomplete, out-of-scope or expired approval records fail closed for those capabilities even when their switches are enabled.

The server registry pins provider, model and prompt versions. Operational metrics may contain only capability, bounded status/latency, provider, model and prompt version. They must never contain prompts, outputs, prescriptions, routine text, participant data or proofs.

Every provider call must invoke the guard before preparing provider input and validate output server-side. Routine proposals remain local suggestions until the user explicitly creates the draft; provider failure, invalid output or a kill switch returns the user to the existing manual workflow without modifying their draft. Sensitive provider output remains `pending_human_review` and cannot be published, assigned or activated before its dedicated review boundary.

Emergency shutdown: override `AI_AUTHORING_CONFIG` with `globalEnabled` set to `false`, deploy Functions, verify `getAiAuthoringCapabilities` reports every capability disabled, and confirm manual draft creation/editing still passes its smoke test. Removing the override restores the checked-in standard-routine default and is not an emergency shutdown.
