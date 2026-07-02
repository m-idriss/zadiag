export function SplashScreen() {
  return (
    <div className="app-splash" role="status" aria-live="polite" aria-label="Loading Zadiag">
      <div className="app-splash-card">
        <img src="/icons/icon-192.png" alt="" />
        <strong>Zadiag</strong>
        <span>Loading…</span>
      </div>
    </div>
  );
}
