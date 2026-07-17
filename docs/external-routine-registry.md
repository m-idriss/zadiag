# External routine registry operations

The external registry is optional. Installed assignments remain local snapshots and catalogue entries remain cached when synchronization fails.

Configure `ROUTINE_REGISTRY_URL` with an HTTPS signed-index URL and `ROUTINE_REGISTRY_PUBLIC_KEYS` with a JSON object mapping key IDs to Ed25519 public keys. With either value absent, synchronization is disabled. The index and every package are bounded, packages require the Zadiag MIME type, HTTPS URLs, matching SHA-256 checksums, Package V1 validation, and matching routine IDs and versions.

## Rotation and compromise recovery

1. Add the new public key under a new key ID while the old key remains trusted.
2. Publish and verify an index signed by the new key.
3. Remove the old key after all deployments have received the new trust set.

If a key or registry is compromised, remove its key or URL and redeploy. The next failed or disabled sync leaves the last-known-good cache and installed snapshots untouched. After publishing a clean index with a new key, re-enable synchronization; a successful full validation atomically revokes stale cached entries and replaces them. Check `routineRegistry/state` for `status`, `generatedAt`, `syncedAt`, and the last bounded error. Never restore cached data without re-running signature, checksum, schema, MIME, URL, size, and provenance validation.
