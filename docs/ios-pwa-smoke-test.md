# iPhone PWA smoke-test matrix

This is the release evidence for iOS-only behavior that browser emulation cannot
prove. Run it against production with synthetic accounts and routines only. Do
not attach proof photos, push endpoints, email addresses, invitation/recovery
codes, or production identifiers to the record.

## Supported combinations

Zadiag supports Home Screen installation, Web Push, and app badging on iPhones
running iOS 16.4 or later. The release matrix samples both compatibility edges:

| Lane | Device and OS | Frequency | Required evidence |
| --- | --- | --- | --- |
| Current | A pilot iPhone on the latest installed iOS patch | Every pilot release | Complete matrix below |
| Minimum | iPhone 8, 8 Plus, or X on the latest available iOS 16 patch | Before expanding beyond the initial cohort and after notification/service-worker changes | Install, standalone, camera, push, badge, offline and update rows |
| Compact layout | iPhone SE-size display on supported iOS | After navigation, routine editor, camera, or settings layout changes | No clipped action, hidden status, or horizontal overflow |

The minimum is iOS 16.4 because Apple exposes Web Push and Badging to Home
Screen web apps from that version. Opening the site only in a Safari tab is not
a supported notification configuration. Record the exact device model, iOS
patch, locale and installed app version; “latest” alone is not evidence.

## Preconditions

- Production URL: `https://zadiag-22482.web.app`
- Named application version: `0.9.64`
- Two synthetic accounts are available: responsible person and participant.
- The responsible account can request a check and review an uncertain result.
- The participant account is linked and assigned a synthetic routine.
- Notifications are initially disabled for Zadiag on the test iPhone.
- Safari has network access; Low Power Mode and Focus status are recorded.

## Complete run

Use `Pass`, `Fail`, or `Blocked`. A pass records a UTC timestamp and a short
observable result. A failure links a focused GitHub issue before this ticket can
close.

| ID | Action | Pass criteria | Result/evidence |
| --- | --- | --- | --- |
| IOS-01 | Open production in Safari, Share → Add to Home Screen, then launch the icon | Icon is present; launch has no Safari browser chrome and uses the production origin | Pass — installed icon launches without Safari chrome (`2026-07-18T08:49:27Z`) |
| IOS-02 | Complete or resume synthetic participant onboarding in the installed app | Correct participant dashboard opens; compact layout has no hidden primary action or horizontal overflow | Pass on 0.9.64 — intrinsic card height, text and full-width action remain isolated in the scrollable catalogue (`2026-07-18T11:48:46Z`); see [`evidence/ios/ios-0.9.64-routine-catalog-pass.png`](evidence/ios/ios-0.9.64-routine-catalog-pass.png). |
| IOS-03 | Enable reminders from an explicit button tap | Native permission sheet appears; allowing it produces a registered subscription and healthy notification diagnostics | Pass — native permission and active notification registration confirmed (`2026-07-18`) |
| IOS-04 | Send the built-in test notification with the app backgrounded | Lock Screen/Notification Centre receives one notification with expected Zadiag title | Pass — notifications received while the app is closed (`2026-07-18T08:49:27Z`) |
| IOS-05 | Tap that notification | Installed app opens to the intended context, not an unrelated Safari tab | Pass — notification opens the intended screen in the installed app (`2026-07-18T08:54:40Z`) |
| IOS-06 | Request a synthetic routine check from the responsible account | Participant receives one check notification; app icon badge reflects pending work | Pass — pending routine notification and icon badge observed (`2026-07-18T08:54:40Z`) |
| IOS-07 | Open the participant task and start proof capture | Native camera permission/capture works; retake and submit controls remain usable | Pass — camera opens correctly on the real device (`2026-07-18T08:49:03Z`) |
| IOS-08 | Submit a non-sensitive synthetic image, then complete responsible review if requested | Submission returns a visible result; review notification opens the correct check; no stale proof remains after review | Pass — synthetic submission and responsible review confirmed (`2026-07-18`) |
| IOS-09 | Return to the participant dashboard after completing the pending task | Badge clears and completed state is visible | Pass — badge clears after validation (`2026-07-18T08:54:40Z`) |
| IOS-10 | Enable Airplane Mode, force-close, and relaunch the installed app | App shell relaunches; offline/unavailable state is understandable; no destructive action falsely succeeds | Pass — installed shell reopens during the reported network interruption (`2026-07-18T08:54:40Z`) |
| IOS-11 | Restore connectivity and reopen | Current participant/routine state resynchronizes without reinstalling or relinking | Pass — state resynchronizes after connectivity returns (`2026-07-18T08:54:40Z`) |
| IOS-12 | Deploy or select a newer test build, background then reopen the installed app | Update becomes observable and the installed app reaches the named target version without a broken shell | Pass — installed app updated without reinstallation (`2026-07-18`) |
| IOS-13 | Reset the synthetic participant/account flow, then recover or relink as documented | Removed access is unavailable; recovery/relink restores only the intended synthetic profile | Pass — synthetic profile removal and reconnection confirmed (`2026-07-18`) |
| IOS-14 | Reopen Settings → diagnostics | Version, last sync, service worker, notification permission and subscription state match the observed run | Pass — version, synchronization and notification diagnostics confirmed (`2026-07-18`) |

## Run record

| Field | Value |
| --- | --- |
| Run ID | `IOS-20260718-01` |
| Tester | Mohamady |
| Started/completed UTC | Pending |
| Device model | iPhone 16 Pro, 128 GB (`MYNF3ZD/A`) |
| iOS patch | 26.5.2 |
| Locale | French |
| App version | `0.9.64` |
| Focus / Low Power Mode | Pending |
| Overall result | Pass for all completed rows; run metadata remains to be completed |
| Follow-up issues | [#175](https://github.com/m-idriss/zadiag/issues/175), overlap reproduced on `0.9.63` and resolved by the `0.9.64` real-device retest |

## Failure handling

Stop the run for any unauthorized profile access, proof exposure, or misleading
successful state and follow the incident playbook. For functional failures,
capture only the row ID, device/OS, timestamp, displayed non-sensitive error,
expected behavior and reproduction steps. Create one focused issue per root
behavior; do not bundle unrelated iOS failures.

## Sources

- [Apple: Sending web push notifications in web apps and browsers](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers)
- [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [WebKit: Badging for Home Screen Web Apps](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/)
