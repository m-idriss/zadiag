import { useEffect, useRef, useState } from 'react';
import { ellipsisHorizontal, playOutline } from 'ionicons/icons';
import type { MessageKey } from '../services/i18n';
import { AppIcon } from './Icon';
import { SvgIcon } from './SvgIcon';

export function UpcomingCheckActionMenu({
  actionId,
  actionLabel,
  routineId,
  routineName,
  plannedStart,
  plannedEnd,
  onRequest,
  eventId,
  onCancel,
  onSkip,
  onEditPlan,
  t,
}: {
  actionId: string;
  actionLabel?: string;
  routineId: string;
  routineName: string;
  plannedStart: Date;
  plannedEnd: Date;
  onRequest?: (routineId: string) => Promise<void>;
  eventId?: string;
  onCancel?: (eventId: string) => Promise<void>;
  onSkip?: (routineId: string, plannedStart: Date, plannedEnd: Date) => Promise<void>;
  onEditPlan?: (routineId: string) => void | Promise<void>;
  t: (key: MessageKey) => string;
}) {
  const [open, setOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<'request' | 'skip' | 'cancel'>();
  const [actionError, setActionError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);
  const run = async (action: 'request' | 'skip' | 'cancel') => {
    if (action === 'skip' && !window.confirm(t('confirmSkipPlannedCheck'))) return;
    if (action === 'cancel' && !window.confirm(t('confirmCancelCheck'))) return;
    setBusyAction(action);
    setActionError(false);
    try {
      if (action === 'request') await onRequest?.(routineId);
      else if (action === 'skip') await onSkip?.(routineId, plannedStart, plannedEnd);
      else if (eventId) await onCancel?.(eventId);
      setOpen(false);
    } catch (error) {
      console.error(error);
      setActionError(true);
    } finally {
      setBusyAction(undefined);
    }
  };
  return (
    <div ref={rootRef} className={`upcoming-check-actions${open ? ' menu-open' : ''}`} data-action-id={actionId}>
      <button type="button" className="upcoming-check-menu-trigger" aria-label={`${actionLabel ?? t('upcomingCheckActions')} · ${routineName}`} aria-haspopup="menu" aria-expanded={open} onClick={() => { setActionError(false); setOpen((current) => !current); }}><SvgIcon icon={ellipsisHorizontal} /></button>
      {open ? <div className="upcoming-check-menu" role="menu">
        {onRequest ? <button type="button" role="menuitem" disabled={Boolean(busyAction)} onClick={() => { void run('request'); }}><SvgIcon icon={playOutline} /><span><b>{t('requestCheckNow')}</b><small>{t('requestPlannedCheckNowHint')}</small></span></button> : null}
        {onCancel && eventId ? <button type="button" role="menuitem" className="skip" disabled={Boolean(busyAction)} onClick={() => { void run('cancel'); }}><AppIcon name="close" /><span><b>{t('cancelCheck')}</b><small>{t('confirmCancelCheck')}</small></span></button> : null}
        {onSkip ? <button type="button" role="menuitem" className="skip" disabled={Boolean(busyAction)} onClick={() => { void run('skip'); }}><AppIcon name="close" /><span><b>{t('skipPlannedCheck')}</b><small>{t('skipPlannedCheckHint')}</small></span></button> : null}
        {onEditPlan ? <button type="button" role="menuitem" disabled={Boolean(busyAction)} onClick={() => { setOpen(false); void onEditPlan(routineId); }}><AppIcon name="calendar" /><span><b>{t('editSchedule')}</b><small>{t('editPlannedCheckHint')}</small></span></button> : null}
        {actionError ? <p role="alert">{t('plannedCheckActionError')}</p> : null}
      </div> : null}
    </div>
  );
}
