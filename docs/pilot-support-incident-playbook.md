# Pilot support and incident playbook

This playbook defines how the Zadiag pilot handles user support, reliability
incidents, privacy concerns, and security reports. It applies to the version
currently deployed from `main`.

## Support intake

Participants and responsible people report ordinary problems from **Settings →
App & support → Contact us**. The app asks separately whether redacted technical
diagnostics may be attached. A report must never contain proof photos,
invitation or recovery codes, health information, or another person's data.

Security suspicions follow the private channel in `SECURITY.md`, never a public
issue. Every report receives a correlation ID in its email subject so messages,
diagnostics, and follow-up decisions can be matched without copying account
identifiers into the working notes.

## Severity and first response

| Level | Examples | Initial action | Target acknowledgement |
| --- | --- | --- | --- |
| SEV-1 | Cross-profile data exposure, account takeover, proof visible to an unauthorized person | Stop the affected path, preserve minimal evidence, notify the owner, assess whether production must be disabled | As soon as observed |
| SEV-2 | Checks or notifications broadly unavailable, repeated incorrect access state, deletion failure | Confirm scope, publish a workaround, prepare rollback or patch | Same working day |
| SEV-3 | Isolated functional defect with a safe workaround | Record reproduction, impact, device and version; prioritize normally | Within two working days |
| Support | Installation, linking, notification permission, or product question | Use the help and diagnostic flow; avoid requesting sensitive content | Within two working days |

These are pilot operating targets, not contractual service-level guarantees.

## Operational alert definitions

The [canonical alert definitions](../functions/src/observability.ts) are the
source for thresholds, owner roles, recovery windows, deduplication keys, and
runbook links. Before a pilot
starts, each owner role below must be assigned to a named primary and deputy in
the private on-call rota. Configure log-based policies from `operational_alert`
records, group incidents by `dedupeKey`, and route them to that role. A matching
`operational_recovery` record uses the same key; close the incident only after
the configured recovery window remains healthy.

| Signal | Threshold | Severity | Owner role | Healthy recovery |
| --- | --- | --- | --- | --- |
| Push dispatch failure | 5 failures in 10 minutes | SEV-2 | `pilot-operations` | Successful dispatches for 15 minutes |
| Invalid push subscription | 10 invalidations in 60 minutes | SEV-3 | `pilot-operations` | No invalidation for 60 minutes |
| Synthetic push not confirmed | 2 failures in 20 minutes | SEV-2 | `pilot-operations` | Received/opened receipt for 20 minutes |
| Scheduled check dispatch | 1 failed run in 10 minutes | SEV-2 | `backend-operations` | Successful run for 10 minutes |
| Analysis failure | 3 failures in 15 minutes | SEV-2 | `ai-reliability` | Successful AI analysis for 15 minutes |
| Proof cleanup failure | 1 failure in 30 minutes | SEV-2 | `privacy-operations` | Successful cleanup for 30 minutes |
| App Check rejection | 20 rejected requests in 10 minutes | SEV-2 | `security-operations` | Rejections below threshold for 20 minutes |

App Check rejects requests before callable code executes. Its policy therefore
uses the Firebase/App Check platform rejection logs and attaches the canonical
`app_check_rejected` definition when notifying the security owner. It must not
copy request bodies, tokens, participant identifiers, or proof data.

### Push delivery

Inspect the dispatch summary and provider status. Remove invalid subscriptions
only through the existing invalidation path; do not copy push endpoints into an
incident record. Confirm recovery with a synthetic dispatch.

### Synthetic monitor

Check the last expected and received synthetic receipt timestamps. A received
or opened synthetic receipt emits recovery without participant or proof
content. Ask the test device to renew its subscription if the heartbeat says so.

### Scheduled jobs

Inspect the scheduler summary and distinguish an invalid plan from an aggregate
or transaction failure. Re-run only with synthetic data after correcting the
cause; confirm that the next summary has no failures or invalid plans.

### Analysis

The user flow falls back to responsible-person review when analysis is
unavailable. Verify provider availability and configuration without inspecting
the submitted proof. Recovery requires a successful AI-backed analysis, not a
self-validation or fallback result.

### Proof cleanup

Treat retained proof as a privacy incident until scoped. Confirm the storage
deletion and Firestore metadata cleanup using synthetic data, then verify a
successful scheduled cleanup run.

### App Check

Separate a release/configuration regression from abusive traffic using only
aggregate platform logs. Roll back a bad enforcement/configuration change or
contain abusive traffic, then observe the threshold for 20 minutes.

### Test alert

An authenticated account with the custom claim `operationsRole=operator` (or
`admin`) can call `triggerOperationalTestAlert` with `{}` to emit an alert and
with `{ "phase": "recovery" }` to emit its correlated recovery. The payload
contains only `source=manual_test`, static routing metadata, and the
`operational:operational_test` deduplication key. Run this drill before the
pilot and after notification routing changes; remove the temporary claim when
the operator does not otherwise need it.

## Incident procedure

1. Assign an incident owner and record start time, deployed version, reporter
   correlation ID, affected profiles count, and observed impact.
2. Contain first. Suspend a compromised account or disable the affected feature
   when continued use could expose data or produce unsafe access.
3. Preserve only the minimum evidence needed. Do not download proof photos or
   copy personal data into issues, chat, or incident notes.
4. Reproduce with demo or synthetic data. Check deployment, Functions and
   application logs using the correlation ID when available.
5. Choose rollback for a recent release regression; choose a forward patch only
   when rollback would retain the defect or lose a required data migration.
6. Validate the fix with the relevant tests, the complete project check, and a
   focused production smoke test using synthetic data.
7. Tell affected pilot users what happened, what they should do, and whether
   access or data was involved. Avoid speculation and clinical language.
8. Close with cause, timeline, affected scope, containment, correction, and one
   concrete prevention action.

## Incident record and decision log

Create one private record for the incident. Use opaque profile and account
references; never paste a proof image, bearer code, push endpoint, email address,
or raw production document. Keep these fields current throughout the response:

| Field | Required content |
| --- | --- |
| Incident ID | `ZDI-YYYYMMDD-NN`, severity, owner and deputy |
| Detection | UTC timestamp, reporting channel, first observed version |
| Scope | Affected feature, deployment, estimated profiles and data categories |
| Timeline | UTC timestamp, actor, action, evidence reference and outcome for every decision |
| Containment | Access suspended, feature disabled, secret/code rotated or release reverted |
| Data assessment | Confidentiality, integrity, availability and retention impact; confirmed versus suspected |
| Recovery evidence | Commit/deployment, automated checks, synthetic smoke test and monitoring result |
| Communication | Audience, approver, time sent and correction if later facts changed |
| Closure | Root cause, contributing controls, prevention owner and due date |

At each hand-off, the incident owner states the current facts, unresolved
questions, next decision, and next update time. Preserve logs and audit records
in place when possible. Any exceptional export must be approved by the incident
owner, minimized, encrypted, access-limited, recorded in the timeline, and
deleted when the investigation no longer needs it.

Before closure, verify that temporary access, feature flags, exported evidence,
test accounts, and rotated codes have been removed. Record why user or authority
notification was or was not required, who made that determination, and the
applicable deadline; obtain qualified legal or privacy advice rather than
deriving that decision from this engineering playbook.

## Privacy or security escalation

Treat any suspected unauthorized access, proof exposure, identifier leakage,
retention failure, or deletion bypass as SEV-1 until scoped. Rotate exposed
secrets, revoke affected access, and use GitHub private vulnerability reporting
for technical coordination. Determine notification obligations with qualified
privacy or legal advice; this playbook does not make that legal determination.

## Release recovery

Production is deployed from `main`. Follow `docs/deployment-workflow.md` for the
normal release path. Prefer reverting the offending merge in a new reviewed
commit so repository history and the deployed state remain aligned. Never move
an immutable release tag. After recovery, confirm linking, dashboard loading,
notification registration, check submission, review, and account access on the
affected platform.

## Pilot review cadence

Review open support reports and incidents weekly during an active cohort.
Record counts by severity, time to acknowledgement, time to recovery, repeated
causes, and product changes made. Use aggregated results only; support notes are
not product analytics and must not become a parallel store of participant data.
