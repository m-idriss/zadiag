export function SplashScreen({ progress, message }: { progress: number; message: string }) {
  const width = `${Math.max(0, Math.min(100, progress))}%`;
  return (
    <div className="app-splash" role="status" aria-live="polite" aria-label="Loading Zadiag">
      <div className="app-splash-card">
        <img src="/icons/icon-192.png" alt="" />
        <strong>Zadiag</strong>
        <span>{message}</span>
        <div className="app-splash-progress" aria-hidden="true">
          <div style={{ width }} />
        </div>
      </div>
    </div>
  );
}
