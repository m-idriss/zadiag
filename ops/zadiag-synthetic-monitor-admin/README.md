# Zadiag synthetic monitor administration

These tools own the Zadiag backend side of the Raspberry Pi synthetic monitor:
participant provisioning, App Check registration, receipt synchronization,
manual Web Push probes and Firestore verification.

The long-running browser runtime and Raspberry Pi health/connectivity evidence
collectors live in the private `m-idriss/mayuri` repository under
`ops/zadiag-synthetic-monitor`. Keeping this directory in Zadiag avoids copying
membership, routine and notification contracts into the operational agent.

On the Raspberry Pi, point administrative commands at Mayuri's private runtime
state:

```sh
export ZADIAG_MONITOR_ENV_PATH=/home/idriss/ai-assistant/.zadiag-monitor/env
set -a; source "$ZADIAG_MONITOR_ENV_PATH"; set +a
node ops/zadiag-synthetic-monitor-admin/sync-runtime.mjs
node ops/zadiag-synthetic-monitor-admin/configure-app-check.mjs
node ops/zadiag-synthetic-monitor-admin/send-probe.mjs
node ops/zadiag-synthetic-monitor-admin/verify.mjs
```

Provisioning a replacement monitor is a separate destructive operation. It
requires an explicit contact email, environment destination, owner UID and new
anonymous monitor UID:

```sh
ZADIAG_MONITOR_CONTACT_EMAIL=pi@example.com \
ZADIAG_MONITOR_ENV_PATH=/home/idriss/ai-assistant/.zadiag-monitor/env \
node ops/zadiag-synthetic-monitor-admin/provision.mjs OWNER_UID MONITOR_UID
```
