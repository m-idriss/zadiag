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
