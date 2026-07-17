# Pilot journey measurement

Zadiag measures whether the core coordination loop works without collecting
proof content or introducing a third-party analytics SDK.

## Data boundary

Journey records contain a technical stage, timestamp, role, scoped profile
identifier, source, and an optional check identifier. They never contain a
photo, display name, email address, routine text, AI comment, or medical data.
Client-only stages are deduplicated by day or check. Audit records are deleted
automatically after 35 days.

## Funnel stages

| Stage | Source of truth | Meaning |
| --- | --- | --- |
| `app_ready` | Client journey event | A linked account finished loading the app that day. |
| `create_family`, `join_family`, `accept_relationship_invitation` | Server audit | A responsible or participant association succeeded. |
| `notifications_enabled` | Client journey event | Push permission and subscription registration succeeded. |
| `notification_opened` | Client journey event | A push or in-app notification opened a specific check. |
| `check_opened` | Client journey event | The participant entered the camera flow for a specific check. |
| `request_check` | Server audit | A check was requested or reminded. |
| `submit_proof` | Server audit | A proof submission reached the server. |
| `review_proof` | Server audit | A responsible review was saved. |

## Pilot measures

- Setup completion: associated profiles divided by created profiles.
- Notification engagement: notification opens divided by dispatched checks.
- Check start rate: opened checks divided by requested checks.
- Completion rate: submitted proofs divided by opened checks.
- Review workload: reviewed proofs and elapsed time from submission to review.
- Weekly retention: distinct scoped profiles with `app_ready` in consecutive weeks.

All reporting must use cohorts of sufficient size and aggregate results. Raw
journey records are operational pilot evidence, not individual performance or
clinical evidence.
