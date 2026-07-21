# Raspberry Pi synthetic monitor

This monitor keeps a persistent Chromium profile connected to the production PWA. A dedicated participant account receives real Web Push messages and reports `received`, `opened`, and browser `heartbeat` receipts to a token-protected Cloud Function.

Every five minutes, it answers newly received check notifications through the real participant UI with a deterministic virtual-camera image. It also reloads the participant screen and looks for a pending check directly, so a missed Web Push delivery cannot leave a synthetic control unanswered. Processed notification check IDs and retry counts are persisted in `.pi-monitor/handled-checks.json`, so restarts cannot submit the same notification twice. A notified check is attempted at most three times.

The virtual camera supports two isolated operational routines:

- `Santé du Raspberry Pi` / `Raspberry Pi Health`: memory, CPU load, disk, temperature, Docker and agent status;
- `Connectivité du Raspberry Pi` / `Raspberry Pi Connectivity`: active interface, gateway reachability, DNS resolution, Zadiag HTTPS latency, NTP synchronization and agent status.

For a private AI-authored connectivity routine, keep the French or English title above exactly. The participant dashboard exposes the persisted routine ID as a non-visual data attribute, so notification-driven checks select the exact routine card while the title identifies which bounded collector and proof template to use.

Suggested French authoring instruction:

```text
Crée une routine nommée « Connectivité du Raspberry Pi ». À chaque contrôle, le Raspberry Pi vérifie automatiquement son interface réseau, sa passerelle, la résolution DNS, l’accès HTTPS à Zadiag, la synchronisation NTP et l’état de l’agent, puis envoie son tableau de connectivité horodaté comme preuve photo.
```

Chromium runs inside Xvfb instead of native headless mode because persistent Web Push and service workers are more reliable with a real browser display context.

The runtime configuration and Chromium profile live in `.pi-monitor/`, which is intentionally ignored by Git. The monitor is isolated from real participant data and uses a dedicated Firebase anonymous UID.

Set `ZADIAG_MONITOR_CONTACT_EMAIL` to the operational address for the synthetic account before provisioning. The supervisor completes the mandatory contact-email flow and declines optional pilot measurement automatically, so an onboarding release cannot block scheduled checks.

Useful commands:

```sh
systemctl --user status zadiag-synthetic-monitor.service
journalctl --user -u zadiag-synthetic-monitor.service -f
xvfb-run -a node ops/pi-synthetic-monitor/browser-control.mjs status
xvfb-run -a node ops/pi-synthetic-monitor/browser-control.mjs activate
xvfb-run -a node ops/pi-synthetic-monitor/browser-control.mjs answer-check
set -a; source .pi-monitor/env; set +a
node ops/pi-synthetic-monitor/sync-runtime.mjs
node ops/pi-synthetic-monitor/configure-app-check.mjs
node ops/pi-synthetic-monitor/send-probe.mjs
```
