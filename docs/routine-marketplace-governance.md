# Routine marketplace governance

## Roles and lifecycle

Authors may share their own immutable publications as unlisted or submit them for listing. Listed submissions enter `pending` and are not discoverable until a Firebase Auth custom claim `routineMarketplaceRole=moderator|admin` approves them. Moderators may approve, reject, suspend, and restore only valid transitions. Only admins may perform emergency revocation. Authors may revoke their own entry. Every transition is enforced by callable Functions; clients have no direct catalogue access.

Lifecycle: `unlisted → revoked`, `pending → approved|rejected|revoked`, `approved → suspended|revoked`, `suspended → approved|revoked`. Suspension and revocation block new resolution/installations. Existing assignment snapshots and verification history are never mutated or deleted.

Every entry records attribution and a license. Internal author submissions default to **All rights reserved**; external registry entries must declare a license in their signed index. Reports contain only entry ID, reporter UID, bounded reason and timestamps. Audit metadata contains identifiers, roles, actions and states—not routine package content, participant details, prescriptions or proofs.

## Backup, restore and migration

Back up `routineCatalogEntries`, `routineShareCodes`, `routineCatalogReports`, `routineRegistry/state`, and audit events using managed Firestore exports with the same access and retention controls as production. Restore into an isolated project, validate counts and references, then run schema/signature/checksum validation before promotion. Never overwrite participant assignment snapshots during catalogue restore. New fields must remain optional for legacy entries until a measured backfill is complete; the compatibility boundary is entries created before 0.9.57.

## Recovery drill evidence — 2026-07-18 / 0.9.57

- Automated transition tests prove invalid role/state changes and moderator emergency revocation are rejected.
- Automated installability tests prove suspended/revoked entries block new installs while snapshots require no catalogue lookup.
- `npm run check` validates the full client, Functions, architecture, design and bundle boundaries.
- Registry compromise recovery is separately covered in `external-routine-registry.md`: invalid replacement data leaves the last-known-good cache intact.

Quarterly drill: suspend an approved fixture, confirm search/install denial, restore it, then admin-revoke it and confirm denial remains while an existing fixture assignment/history stays readable. Export and restore the catalogue collections into an isolated project, record counts and timestamps, and link the evidence from the incident log.
