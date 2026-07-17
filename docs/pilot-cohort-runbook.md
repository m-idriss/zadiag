# Pilot cohort runbook

This runbook turns the second near-term milestone into a repeatable four-week
pilot. It is an operational template, not evidence that a cohort has already
been run and not a clinical study protocol.

## Purpose and scope

The pilot tests whether a small number of families can set up Zadiag, receive a
reminder, submit a routine check, and complete responsible review with less
coordination effort. It does not test diagnosis, treatment effectiveness, or
clinical outcomes.

A practical first cohort is 5–10 family groups using their own supported routine
for four weeks. This range is intended to reveal usability and reliability
problems; it is not statistically powered and must not be presented as proof of
effectiveness.

## Entry criteria

Each family group must have:

- one responsible adult able to manage access and respond to support;
- one participant who understands the routine and can use the supported device;
- an iPhone or compatible browser that can install the PWA and receive
  notifications;
- an existing routine chosen independently of Zadiag;
- explicit acceptance or refusal of the current optional pilot measurement;
- acknowledgement that Zadiag is a coordination aid, not medical advice.

Do not enroll a situation where missing a Zadiag reminder could create immediate
danger, where the participant cannot freely stop, or where the expected proof
would expose another person or unrelated sensitive information.

## Minimal cohort register

Keep the operating register outside application data and restrict it to the
pilot owner. Use a random cohort code, never a family ID, email address,
invitation code, or recovery code in analysis notes.

| Field | Allowed value |
| --- | --- |
| Cohort code | Random label such as `P01` |
| Start and planned end | Calendar dates |
| Platform | iPhone/PWA or other supported platform |
| Roles active | Responsible, participant, or both |
| Measurement choice | Accepted, declined, withdrawn; no reason required |
| Setup observation | Independent, prompted, or blocked |
| Support incidents | Count and highest severity only |
| Exit state | Completed, withdrew, or stopped by pilot owner |

Contact details needed for support must remain in the chosen private contact
channel and must not be copied into the cohort register.

## Launch checklist

Before inviting the first family:

- confirm production is on the intended version and CI is green;
- confirm the support mailbox is monitored and the incident owner is named;
- perform synthetic smoke checks for linking, notification registration,
  reminder opening, proof submission, review, withdrawal, and account deletion;
- verify the current pilot consent version and the 35-day journey retention;
- prepare the baseline and closing questions in `pilot-survey-template.md`;
- define the cohort start, end, weekly review time, and stop authority;
- record baseline targets only after the initial instrumented observations,
  alongside cohort size and timeframe.

## Participant session

1. Explain the product boundary and show how to contact support or stop.
2. Let the family install and link accounts without coaching where possible.
3. Record only whether setup was independent, prompted, or blocked; do not copy
   screen content, names, codes, or proof.
4. Let each account make its own optional measurement choice in the app.
5. Confirm notification permission using the built-in test.
6. Complete one synthetic or ordinary routine loop and responsible review.
7. Remind participants that they can withdraw from measurement or leave the
   pilot without deleting the account, and can separately request deletion.

## Four-week cadence

| Moment | Activity |
| --- | --- |
| Before use | Baseline coordination questions and unassisted setup observation |
| Week 1 | Check setup failures, notification reliability, and SEV-1/SEV-2 reports |
| Week 2 | Review aggregate funnel gaps and repeated support causes |
| Week 3 | Confirm continued voluntary participation; avoid coaching toward metrics |
| Week 4 | Closing questions, aggregate measures, withdrawals, and unresolved incidents |
| Within 5 working days after | Cohort review and a written continue/change/stop decision |

## Measures and interpretation

Use the definitions in `pilot-measurement.md`. Report cohort size, measurement
opt-in count, platform mix, timeframe, and missing-data reasons beside every
result. Keep declined and withdrawn accounts usable but exclude periods without
active measurement consent from journey reporting.

Qualitative notes should describe recurring friction, not individual behavior.
Do not rank families, infer adherence motivation, or combine support messages
with journey data to create individual profiles.

## Stop and escalation rules

Pause new enrollment immediately for suspected cross-profile access, proof
exposure, account takeover, or a repeated inability to delete or revoke access.
Follow `pilot-support-incident-playbook.md` and resume only after containment,
validated correction, and an explicit decision by the pilot owner.

Pause the affected family for a SEV-2 issue without a safe workaround. Ordinary
support questions and isolated defects with a safe workaround do not require a
cohort-wide pause but remain part of the weekly review.

## Completion checklist

- close or assign every open incident and support follow-up;
- record completed, withdrawn, and stopped counts without identifying users;
- calculate only aggregate measures for actively consenting periods;
- compare baseline and closing answers without claiming clinical effect;
- document the top three friction points and the evidence behind them;
- choose one outcome: continue unchanged, change and repeat, or stop;
- remove temporary contact and operating notes that are no longer required;
- schedule the normal 35-day technical-record deletion verification.

