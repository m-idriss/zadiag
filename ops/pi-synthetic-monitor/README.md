# Raspberry Pi synthetic monitor

This monitor keeps a persistent Chromium profile connected to the production PWA. A dedicated participant account receives real Web Push messages and reports `received`, `opened`, and browser `heartbeat` receipts to a token-protected Cloud Function.

Chromium runs inside Xvfb instead of native headless mode because persistent Web Push and service workers are more reliable with a real browser display context.

The runtime configuration and Chromium profile live in `.pi-monitor/`, which is intentionally ignored by Git. The monitor is isolated from real participant data and uses a dedicated Firebase anonymous UID.

Useful commands:

```sh
systemctl --user status zadiag-synthetic-monitor.service
journalctl --user -u zadiag-synthetic-monitor.service -f
xvfb-run -a node ops/pi-synthetic-monitor/browser-control.mjs status
xvfb-run -a node ops/pi-synthetic-monitor/browser-control.mjs activate
```
