# Release security and privacy audit

Last reviewed: 2026-07-17. Scope: the web client, Firestore rules, callable and
scheduled Functions, proof storage, relationship invitations, account recovery,
and operational audit data in the release built from `main`.

This is an internal engineering review backed by emulator and unit tests. It is
not an external penetration test, legal privacy assessment, or certification.

## Trust boundaries and controls

| Boundary | Enforced control | Independent verification | Retention or deletion |
| --- | --- | --- | --- |
| Firestore profile data | Authenticated, non-suspended family membership or active participant membership with `view`; all client writes denied | `rules-tests/firestore.rules.test.ts` exercises allowed members, outsiders, suspended members, cross-profile isolation and write denial in the Firestore emulator | Profile deletion recursively deletes participant data and related indexes |
| Membership and permissions | Sensitive changes use App Check-protected callable Functions and server-side permission helpers; the last owner cannot leave or be removed | Relationship domain tests cover role defaults, delegation, suspension and last-owner invariants; emulator tests deny direct mutation | Removed memberships are suspended and their push registration is deleted |
| Invitations | Random code returned once; only its hash is used as the document ID; App Check, authentication, expiry, single consumption and per-account attempt throttling apply | Function tests cover code format and relationship invariants; emulator tests prove invitation and attempt documents cannot be read or written by clients | Expired invitations are deleted daily; consumed invitations are deleted after 24 hours |
| Recovery | Bearer code is hashed at rest, expires, rotates after use, transfers membership transactionally and suspends the previous account | Relationship and cleanup unit tests plus emulator denial of all recovery documents | Expired codes and attempts older than 24 hours are deleted daily |
| Proof images | Upload and access occur only through App Check-protected Functions after membership checks; access URLs expire after five minutes; bucket paths are never client-writable | Callable authorization is kept server-side; Firestore emulator denies direct check mutation and cross-profile reads | Image removed immediately after responsible review or after at most 30 days; deletion failures raise an operational alert |
| Push endpoints | Registration and fan-out use server functions; a client may read only its own registration document | Emulator tests deny another member's endpoint and collection listing in both current and legacy aggregates | Endpoint deleted when membership is removed, recovered or account data is reset |
| Audit events | Server-created records contain action, actor, aggregate identifiers and allow-listed scalar metadata; no client access rule exists | Audit unit tests validate metadata filtering; emulator tests deny reads, writes and deletes | Deleted daily after 35 days |
| Local diagnostics | Redacted on device and attached only with explicit user consent | Client tests cover report redaction and consent flow | Local entries expire after seven days |

## Findings and disposition

The review found one release-blocking privacy issue: any authorized member could
read every push subscription in the same aggregate. Firestore now restricts a
member to the document whose ID matches their authenticated UID, while server
fan-out remains unchanged. Adversarial emulator coverage prevents regression.

No direct client path was found to invitation hashes, recovery hashes, recovery
attempts, audit events, membership mutations, check mutations, or proof bucket
operations. All exported callable Functions enforce authentication and App
Check; sensitive relationship actions additionally re-read membership state on
the server.

## Residual risks and release gates

- Bearer invitation and recovery links remain transferable by design. A leaked,
  unexpired code can be used by an authenticated, App Check-verified account;
  short expiry, single use, hashing, throttling and rotation reduce but do not
  eliminate that risk.
- The temporary `notSuspended` compatibility branch permits accounts without a
  `userAccess` document during rollout. Remove it after every deployed account
  has a registered access document; until then, suspension depends on creating
  that document before access must be blocked.
- Proof deletion is asynchronous on storage failure. Operational alerts must be
  monitored and retried; the Firestore reference is retained on immediate
  deletion failure so the scheduled cleanup can try again.
- This review does not replace a qualified privacy/legal assessment or an
  independent human penetration test before a wider public launch.

A release is eligible only when `pnpm check:full` passes (including emulator
rules tests), `pnpm check:security` reports no high-severity production
dependency finding, and the incident procedure has an assigned operator.
