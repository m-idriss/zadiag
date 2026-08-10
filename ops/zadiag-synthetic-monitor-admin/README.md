# Zadiag synthetic monitor administration

These tools own the Zadiag backend side of a synthetic monitor: participant
provisioning, App Check registration, receipt synchronization, manual Web Push
probes and Firestore verification.

The long-running browser runtime and evidence collectors belong to the monitor
operator. Keeping only these administration tools in Zadiag avoids coupling
the product to a particular host, device or agent implementation.

Point administrative commands at the monitor runtime environment:

```sh
export ZADIAG_MONITOR_ENV_PATH=/path/to/monitor-runtime/env
set -a; source "$ZADIAG_MONITOR_ENV_PATH"; set +a
node ops/zadiag-synthetic-monitor-admin/sync-runtime.mjs
node ops/zadiag-synthetic-monitor-admin/configure-app-check.mjs
node ops/zadiag-synthetic-monitor-admin/send-probe.mjs
node ops/zadiag-synthetic-monitor-admin/verify.mjs
```

If the persistent Chromium profile still exists but Firebase anonymous auth has
rotated its UID, stop the monitor and migrate only its technical identity. The
participant, assignments and check history remain in place. Pass the current
browser UID and keep the runtime environment out of command output:

```sh
node ops/zadiag-synthetic-monitor-admin/replace-identity.mjs NEW_MONITOR_UID
```

The command rejects occupied targets, atomically moves the Firestore identity,
and replaces only `ZADIAG_MONITOR_ID` in the private runtime environment.

Provisioning a replacement monitor is a separate destructive operation. It
requires an explicit contact email, environment destination, owner UID and new
anonymous monitor UID. The optional display name defaults to `Synthetic
monitor`.

```sh
ZADIAG_MONITOR_CONTACT_EMAIL=monitor@example.com \
ZADIAG_MONITOR_DISPLAY_NAME='Staging synthetic monitor' \
ZADIAG_MONITOR_ENV_PATH=/path/to/monitor-runtime/env \
node ops/zadiag-synthetic-monitor-admin/provision.mjs OWNER_UID MONITOR_UID
```
