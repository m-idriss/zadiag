# Caregiver and participant relationship architecture

Status: proposed design for issue #40. This document describes the target model; it does not authorize the client to write relationship or permission records directly.

## Vocabulary and scope

Use **participant** in the data model for the person whose routines and checks are followed. Use **caregiver** for a user allowed to help manage a participant. Product copy may use a more specific label such as parent, partner, or relative, stored as relationship metadata rather than as an authorization role.

A user and a participant are different concepts:

- a user is an authenticated account in `users/{uid}`;
- a participant is a followed person in `participants/{participantId}`;
- a membership connects one user to one participant and carries all authorization data;
- the same user may have memberships for several participants;
- self-management is a normal membership whose `uid` also equals the participant's `userId`.

The existing `families` aggregate remains readable during migration, but new authorization must not depend on `users/{uid}.familyId` or `families/{familyId}.members`.

## Target Firestore schema

```text
users/{uid}
  displayName?: string
  locale?: "en" | "fr"
  relationshipModelVersion: 2
  createdAt: Timestamp
  updatedAt: Timestamp

participants/{participantId}
  displayName: string
  userId?: uid                  # account used by the followed person, if any
  status: "active" | "archived"
  sourceFamilyId?: familyId     # migration trace only
  createdBy: uid
  createdAt: Timestamp
  updatedAt: Timestamp

participants/{participantId}/memberships/{uid}
  uid: uid
  role: "owner" | "caregiver" | "participant" | "viewer"
  label?: "parent" | "partner" | "relative" | "professional" | "self" | "other"
  permissions: {
    view: boolean
    manageRoutines: boolean
    requestChecks: boolean
    submitChecks: boolean
    reviewProofs: boolean
    manageCaregivers: boolean
    manageParticipant: boolean
  }
  status: "active" | "suspended"
  invitedBy?: uid
  createdAt: Timestamp
  updatedAt: Timestamp

users/{uid}/participantRefs/{participantId}
  participantId: participantId
  role: MembershipRole
  status: "active" | "suspended"
  updatedAt: Timestamp

participants/{participantId}/routineAssignments/{assignmentId}
participants/{participantId}/checks/{checkId}
participants/{participantId}/pushSubscriptions/{uid}

relationshipInvitations/{invitationHash}
  participantId: participantId
  intendedRole: "caregiver" | "participant" | "viewer"
  permissions: PermissionSet
  createdBy: uid
  expiresAt: Timestamp
  consumedAt?: Timestamp
  consumedBy?: uid

relationshipRecoveryCodes/{codeHash}
  participantId: participantId
  membershipUid: uid
  expiresAt: Timestamp
  consumedAt?: Timestamp
```

The canonical membership is the participant subcollection document. `users/{uid}/participantRefs` is a denormalized index used to list a user's participants without a collection-group query. Cloud Functions must update both documents atomically. Authorization reads the canonical membership, never the index alone.

Routine assignments, checks, proof images, and participant-specific subscriptions move under `participants/{participantId}`. Account-wide notification preferences may remain under the user.

Membership document IDs use the UID. This makes the relation unique, naturally supports self-management, and gives rules a fixed path. A suspended membership remains available for audit but grants no access.

## Permission matrix

The role supplies defaults; stored permissions allow deliberate restriction. A request is allowed only when the membership is active and its explicit permission is `true`.

| Capability | Owner | Caregiver | Participant | Viewer |
| --- | --- | --- | --- | --- |
| View participant, routines, and history | yes | yes | yes | yes |
| Manage routines and schedule | yes | yes | no | no |
| Request a check | yes | yes | yes | no |
| Submit a check/proof | yes | optional | yes | no |
| Review a proof | yes | yes | no | no |
| Invite or remove caregivers/viewers | yes | no by default | no | no |
| Edit/archive participant | yes | no by default | no | no |
| Leave participant | yes, if another owner remains | yes | yes | yes |

Invariants enforced server-side:

1. Every active participant has at least one active owner.
2. Only an owner with `manageCaregivers` may grant, change, suspend, or remove another user's membership.
3. A user cannot grant permissions they do not hold.
4. The last owner cannot leave, be suspended, or be removed; ownership must first be transferred or the participant explicitly deleted.
5. Deleting an account removes that user's memberships only. Participant data is deleted only through an explicit participant deletion by an owner, subject to the last-owner rule.
6. A participant account can submit its own proofs but cannot review them unless explicitly given that permission.
7. Self-management needs no exception: one membership can be both `owner` and labeled `self`; `participants.userId` points to the same UID.

`owner` and `caregiver` are authorization roles. Labels are presentation metadata and never grant access.

## Authorization shape

Callable Functions take `participantId`, load `participants/{participantId}/memberships/{request.auth.uid}`, require `status == "active"`, and check the capability needed by the operation. Replace `requireFamilyRole` and `requireFamilyMember` with helpers such as:

```ts
requireParticipantPermission(uid, participantId, 'manageRoutines')
requireParticipantPermission(uid, participantId, 'submitChecks')
```

Firestore clients remain read-only for sensitive records. Rules may allow reads when the canonical active membership has `permissions.view == true`; all membership, routine, check, invitation, and permission mutations continue through Functions.

```text
isActiveMember(participantId) =
  signedIn() &&
  get(/participants/{participantId}/memberships/{uid}).status == "active"

canView(participantId) =
  isActiveMember(participantId) &&
  membership.permissions.view == true
```

Proof download URLs, notifications, scheduled check generation, audits, and cleanup jobs must use `participantId` and memberships. They must not infer access from a user profile or an old family member map.

## Invitation and association flows

### Create a participant

`createParticipant(displayName, selfManaged)` creates the participant and an owner membership for the caller in one transaction. For self-management it also sets `participant.userId = uid`, uses label `self`, and enables submission. Otherwise the owner may later invite the followed person's account with role `participant`.

### Invite a caregiver

An owner requests a short-lived, single-use invitation scoped to one participant, intended role, and bounded permissions. The recipient signs in and accepts it. Acceptance creates the canonical membership plus user index atomically; it never replaces an existing caregiver. Accepting an already-held equivalent membership is idempotent. A conflicting active membership requires an explicit update by an owner.

Invitation codes are stored only as hashes, expire, are single-use, and are rate-limited. The acceptance response returns the participant ID but no other participant data until authorization succeeds.

### Link the followed person

The participant invitation is the same mechanism with role `participant`. Acceptance may set `participants.userId` only if unset or already equal to the accepting UID. Replacing that account requires an explicit owner-controlled recovery flow.

### Recovery

Recovery restores a particular membership; it does not remove other caregivers. A recovery record identifies both `participantId` and `membershipUid`. If recovery is intended for a new authenticated UID, the flow must prove control of the recoverable credential, create/transfer the membership atomically, revoke the old credential, and record an audit event. It must reject a transfer that would silently merge unrelated accounts or remove the last owner.

Recovery codes are per membership, hashed, expiring, rotating, single-use, and rate-limited. Existing `recoverParent`, which removes every previous parent, must remain legacy-only and must not be reused for the new model.

### Unlinking

Leaving removes or suspends only the caller's relationship. An owner removing another caregiver affects only that membership. Both operations revoke that user's participant-specific push subscription. Participant deletion is a separate, clearly confirmed operation that removes all participant data and proof files.

## Migration from `families`

Migration is additive and resumable. Keep compatibility reads until every supported client and background job understands memberships.

### Mapping

For each `families/{familyId}`:

1. Create `participants/{familyId}` so legacy and target IDs remain stable.
2. Copy `childName` to `displayName`, set `sourceFamilyId`, and mark the migration version.
3. For each `families.members` entry:
   - `parent` becomes `owner` with caregiver defaults;
   - `child` becomes `participant` with participant defaults and, when unique, sets `participant.userId`.
4. Create the canonical membership and `users/{uid}/participantRefs/{familyId}`.
5. Copy or dual-read `routineAssignments`, `checks`, and push subscriptions. Preserve document IDs and timestamps.
6. Keep proof storage paths working through a recorded legacy path; move objects only in a separately rehearsed job.
7. Convert unconsumed link codes into scoped participant invitations where safe. Keep current recovery codes legacy-only and rotate them into per-membership recovery after the owner next authenticates.

### Rollout

1. Deploy schema-aware reads and new Functions behind a feature flag.
2. Dual-write legacy family changes and new memberships while old clients remain supported.
3. Backfill deterministically in batches; record `migrationVersion`, attempt time, and errors.
4. Rehearse against representative exports and verify counts, IDs, roles, routines, checks, subscriptions, code expiry, and proof paths.
5. Switch authorization and scheduled jobs to memberships.
6. Switch the client to participant lists plus an active participant selection.
7. Stop legacy writes, observe, then remove `users.familyId` and `families.members` dependencies in a later release.

Each migration step is idempotent. A rerun must compare and repair compatible data, reject conflicts for review, and never downgrade an existing permission or overwrite a newer target record.

Rollback before step 5 disables the feature and returns to legacy reads. After authorization switches, rollback requires retaining dual-written legacy fields until the observation window closes.

## Client state and management UI

Replace the single `AppState.family` assumption with:

```ts
interface ParticipantAccess {
  participant: ParticipantSummary;
  membership: MembershipSummary;
}

interface AppState {
  participantAccess: ParticipantAccess[];
  activeParticipantId?: string;
  // routines and events belong to the active participant
}
```

Single-participant accounts open directly as today. Accounts with several participants get a compact selector that shows the participant name and the user's display label. A management screen lists all linked participants for the current user and, within each participant, its caregivers and their status. Self-managed profiles use first-person copy and do not pretend the user is their own child.

The active participant ID is a UI preference, not an authorization fact. Repository operations always pass the participant ID and the server rechecks membership.

## Examples

### Mother + father + child

`participants/alex` has owner memberships for the mother's and father's UIDs and a participant membership for Alex's UID. Both caregivers can manage routines and review proofs. Either caregiver may leave without affecting the other; neither can remove the last owner.

### One caregiver with multiple children

The caregiver has an owner membership under both `participants/alex` and `participants/sam`, plus two `participantRefs`. Selecting Alex cannot expose Sam's checks because every operation is scoped and authorized by participant ID.

### Self-management

`participants/jordan.userId` is Jordan's UID. Its membership document at `memberships/{jordanUid}` has role `owner`, label `self`, and both management and submission permissions. There is no duplicate user or synthetic child account.

## Required tests before rollout

- two caregivers can read and manage the same participant without replacing one another;
- one caregiver can manage multiple participants and data never crosses participant boundaries;
- a self-managed owner can manage routines and submit checks;
- unrelated and suspended users are denied;
- a removed caregiver immediately loses reads, callable access, proof URLs, and notifications;
- invitation acceptance is single-use and idempotent for an existing equivalent membership;
- a caregiver cannot escalate or delegate permissions they do not have;
- the last owner cannot be removed and account deletion does not delete shared participant data;
- migration reruns preserve IDs, routines, checks, history, subscriptions, and proof access;
- legacy and new clients remain consistent during the dual-write window.

## Decisions and follow-ups

This proposal chooses `participant`, `caregiver`, and `membership` as neutral internal terms. Initial caregiver permissions are full routine/check management, while inviting caregivers and deleting the participant remain owner-only. Product copy and any professional/clinical access requirements should be validated separately before implementation.

Implementation should be split into reviewable changes: schema helpers and tests, invitation/recovery Functions, migration rehearsal, client repository/state, management UI, then rules hardening and legacy removal.
