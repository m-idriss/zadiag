export function Snackbar({
  message,
  actionLabel,
  closeLabel,
  onAction,
  onClose,
  busy = false,
}: {
  message: string;
  actionLabel?: string;
  closeLabel: string;
  onAction?: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <div className="app-snackbar" role="status" aria-live="polite">
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button type="button" className="app-snackbar-action" disabled={busy} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
      <button type="button" className="app-snackbar-close" aria-label={closeLabel} onClick={onClose}>x</button>
    </div>
  );
}
