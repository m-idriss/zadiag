# Raspberry Pi synthetic monitor

This monitor keeps a persistent Chromium profile connected to the production PWA. A dedicated participant account receives real Web Push messages and reports `received`, `opened`, and browser `heartbeat` receipts to a token-protected Cloud Function.

Every five minutes, it also answers newly received check notifications through the real participant UI with a deterministic virtual-camera image. Processed check IDs and retry counts are persisted in `.pi-monitor/handled-checks.json`, so restarts cannot submit the same check twice. A check is attempted at most three times.

Chromium runs inside Xvfb instead of native headless mode because persistent Web Push and service workers are more reliable with a real browser display context.

The runtime configuration and Chromium profile live in `.pi-monitor/`, which is intentionally ignored by Git. The monitor is isolated from real participant data and uses a dedicated Firebase anonymous UID.

Useful commands:

```sh
systemctl --user status zadiag-synthetic-monitor.service
journalctl --user -u zadiag-synthetic-monitor.service -f
xvfb-run -a node ops/pi-synthetic-monitor/browser-control.mjs status
xvfb-run -a node ops/pi-synthetic-monitor/browser-control.mjs activate
xvfb-run -a node ops/pi-synthetic-monitor/browser-control.mjs answer-check
set -a; source .pi-monitor/env; set +a
node ops/pi-synthetic-monitor/sync-runtime.mjs
node ops/pi-synthetic-monitor/send-probe.mjs
```
