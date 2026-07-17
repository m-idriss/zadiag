# Security policy

Zadiag handles family routine data and may process user-submitted proof. Security
and privacy reports are treated as confidential, even though the current product
is a limited pilot.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability or include real user
data in a report. Use GitHub's private vulnerability reporting flow for this
repository, or contact the repository owner privately if that flow is not
available.

Include the affected component, reproduction steps, likely impact, and any safe
proof of concept. You can expect an acknowledgement within five working days and
a follow-up after triage. Timelines for a fix depend on severity and deployment
risk.

## Supported version

Only the version currently deployed from `main` is supported. Older PWA assets
and previews should not be treated as maintained releases.

Diagnostic logs stay on the device unless a user explicitly creates a support
email. They are kept for at most seven days, and common user or family
identifiers, codes, tokens, email addresses, and URL parameters are removed from
generated reports.

The release security and privacy control map, verified boundaries, retention
periods, and known residual risks are recorded in
[`docs/security-privacy-audit.md`](docs/security-privacy-audit.md). Incident
handling follows [`docs/pilot-support-incident-playbook.md`](docs/pilot-support-incident-playbook.md).

## Scope

Useful reports include authentication or authorization bypasses, cross-family
data exposure, unsafe callable Functions, proof-storage access, secret leakage,
and ways to bypass retention or deletion controls.

General product suggestions and non-sensitive defects belong in the regular
issue tracker. Never test against another person's account or data.

## Automated dependency controls

GitHub audits production dependencies every week and Dependabot monitors the web
application, Functions, and workflow actions. Routine minor and patch updates are
grouped to keep each maintenance change coherent. Security findings still require
impact review, relevant tests, and the normal delivery checks before merging.
