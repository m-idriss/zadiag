import { AppIcon } from './Icon';

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
  closeLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
  busy?: boolean;
}) {
  return (
    <div className="app-snackbar" role="status" aria-live="polite">
      <p>{message}</p>
      {actionLabel && onAction ? (
        <button type="button" className="app-snackbar-action" aria-busy={busy} disabled={busy} onClick={onAction}>
          {busy ? <span className="button-spinner" aria-hidden="true" /> : null}
          {actionLabel}
        </button>
      ) : null}
      {closeLabel && onClose ? (
        <button type="button" className="app-snackbar-close" aria-label={closeLabel} onClick={onClose}><AppIcon name="close" /></button>
      ) : null}
    </div>
  );
}
