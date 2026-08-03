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
  onOpenChange,
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
  onOpenChange?: (open: boolean) => void;
  t: (key: MessageKey) => string;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'down' | 'up'>('down');
  const [busyAction, setBusyAction] = useState<'request' | 'skip' | 'cancel'>();
  const [actionError, setActionError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        onOpenChange?.(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      onOpenChange?.(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onOpenChange, open]);
  const toggleMenu = () => {
    setActionError(false);
    setOpen((current) => {
      const next = !current;
      if (next && rootRef.current) {
        const bounds = rootRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - bounds.bottom;
        setPlacement(spaceBelow < 220 && bounds.top > spaceBelow ? 'up' : 'down');
      }
      onOpenChange?.(next);
      return next;
    });
  };
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
      onOpenChange?.(false);
    } catch (error) {
      console.error(error);
      setActionError(true);
    } finally {
      setBusyAction(undefined);
    }
  };
  return (
    <div ref={rootRef} className={`upcoming-check-actions${open ? ` menu-open ${placement === 'up' ? 'open-up' : 'open-down'}` : ''}`} data-action-id={actionId}>
      <button type="button" className="upcoming-check-menu-trigger" aria-label={`${actionLabel ?? t('upcomingCheckActions')} · ${routineName}`} aria-haspopup="menu" aria-expanded={open} onClick={toggleMenu}><SvgIcon icon={ellipsisHorizontal} /></button>
      {open ? <div className="upcoming-check-menu" role="menu">
        {onRequest ? <button type="button" role="menuitem" disabled={Boolean(busyAction)} onClick={() => { void run('request'); }}><SvgIcon icon={playOutline} /><span><b>{t('requestCheckNow')}</b><small>{t('requestPlannedCheckNowHint')}</small></span></button> : null}
        {onCancel && eventId ? <button type="button" role="menuitem" className="skip" disabled={Boolean(busyAction)} onClick={() => { void run('cancel'); }}><AppIcon name="close" /><span><b>{t('cancelCheck')}</b><small>{t('confirmCancelCheck')}</small></span></button> : null}
        {onSkip ? <button type="button" role="menuitem" className="skip" disabled={Boolean(busyAction)} onClick={() => { void run('skip'); }}><AppIcon name="close" /><span><b>{t('skipPlannedCheck')}</b><small>{t('skipPlannedCheckHint')}</small></span></button> : null}
        {onEditPlan ? <button type="button" role="menuitem" disabled={Boolean(busyAction)} onClick={() => { setOpen(false); onOpenChange?.(false); void onEditPlan(routineId); }}><AppIcon name="calendar" /><span><b>{t('editSchedule')}</b><small>{t('editPlannedCheckHint')}</small></span></button> : null}
        {actionError ? <p role="alert">{t('plannedCheckActionError')}</p> : null}
      </div> : null}
    </div>
  );
}
