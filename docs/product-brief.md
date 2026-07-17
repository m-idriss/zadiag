# Zadiag product brief

## Product thesis

Zadiag helps a responsible adult and a participant follow recurring care
routines together. The product focuses on the gap between knowing what should
happen and having lightweight, shared evidence that it happened.

The initial wedge is a bilingual, iPhone-first PWA: it can be tested with real
families without an App Store release while retaining a production backend path.

## Who it serves

- **Responsible adult:** creates routines, requests checks, and reviews uncertain
  results without having to repeatedly call or message.
- **Participant:** receives a clear prompt and completes a short confirmation
  flow from an installed phone experience.

The current scope is family-supported routine follow-up. Zadiag does not diagnose,
recommend treatment, or replace professional care.

## Why it can win

- One shared workflow covers linking, scheduling, notification, proof, review,
  and history.
- The interface separates responsible-adult and participant needs instead of
  forcing both into the same dashboard.
- A PWA enables fast pilot iteration while Firebase provides scoped access,
  callable backend operations, cleanup paths, and push delivery.
- Demo mode lowers the cost of product demonstrations and usability sessions.
- French and English support broadens the initial pilot surface.

These are product hypotheses until validated with pilot evidence; they are not
claims of clinical effectiveness.

## Pilot learning plan

The first pilot should establish whether families can complete the core loop
reliably and whether it reduces coordination burden.

| Question | Suggested measure |
|----------|-------------------|
| Can a family start without assistance? | Setup and linking completion rate |
| Does the loop work day to day? | Due checks completed within the intended window |
| Are reminders dependable? | Notification delivery and open rate by platform |
| Is proof review manageable? | Share of checks requiring review and review time |
| Does the product remain useful? | Weekly active families and four-week retention |
| Does it reduce coordination effort? | Short before/after caregiver survey |

No target values are asserted yet. Baselines and targets should be set after the
first instrumented cohort, then recorded alongside cohort size and timeframe.

## Evidence required for the next stage

1. A repeatable setup and linking flow observed on real devices.
2. Four weeks of privacy-respecting funnel and reliability data.
3. Qualitative evidence that the workflow reduces caregiver coordination effort.
4. Documented retention, deletion, incident-response, and consent decisions.
5. A regulatory assessment before making clinical claims or expanding the
   product beyond general routine support.
6. A clear buyer and distribution hypothesis supported by interviews.

## Near-term milestones

1. Harden the current family pilot and measure the full check lifecycle.
2. Run a small cohort with explicit consent, support, and incident procedures.
3. Use observed behavior to simplify onboarding and notification recovery.
4. Decide whether the strongest route is direct-to-family, caregiver partnership,
   or a professional distribution channel.
5. Scope regulatory and security work against the chosen route, rather than
   prematurely building for every possible market.

The operating procedure for milestone 2 is defined in the
[pilot support and incident playbook](pilot-support-incident-playbook.md). The
[cohort runbook](pilot-cohort-runbook.md) and
[before-and-after survey](pilot-survey-template.md) cover launch, observation,
weekly review, stopping rules, and closure.

## Principal risks

| Risk | Current response |
|------|------------------|
| Notification limitations on iOS PWAs | Installed-app guidance, diagnostics, and recovery states |
| Sensitive proof data | Scoped Firebase access, App Check, and cleanup paths |
| Overstated health claims | Explicit support-tool positioning and disclaimer |
| Family setup friction | Demo mode, one-time linking, and focused role-based flows |
| Premature platform complexity | PWA-first pilot and evidence-led milestones |

## Technical proof points

The repository includes automated application and backend tests, Firestore rules
tests, typed domain logic, CI quality gates, bundle-size enforcement, deployment
documentation, and a local demo repository. These prove engineering discipline;
they do not substitute for pilot, security, regulatory, or commercial evidence.
