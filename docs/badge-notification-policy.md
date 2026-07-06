# Badge and notification policy

Zadiag badges must only represent an action the current device can take.

## Participant device

- Show an app badge only when at least one active proof is expected.
- Count only pending checks whose expiry time is still in the future.
- Clear the badge when there is no active proof to send.
- Do not badge completed checks, expired checks, routine history, progress, or passive setup information.

## Responsible device

- Keep the app badge clear for passive monitoring information.
- Use responsible-side notifications and badges only for items that require review or another direct action.
- Pending participant checks do not badge the responsible device, because the responsible person cannot complete that proof.

## Activity visibility

When a user sees a notification, badge, or review request, the app should expose an in-app activity entry that explains the reason and the related routine or check.
