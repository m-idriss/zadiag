import { useEffect, useRef, useState } from 'react';
import { ellipsisHorizontal, playOutline } from 'ionicons/icons';
import type { presentedUpcomingRoutineChecks } from '../domain/dashboardChecks';
import { plannedWindowLabel } from '../domain/taskTimeLabel';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from './Icon';
import { SvgIcon } from './SvgIcon';

type PresentedUpcomingCheck = ReturnType<typeof presentedUpcomingRoutineChecks>[number];

export function UpcomingChecksSection({
  checks,
  now,
  locale,
  titleId,
  onRequest,
  onSkip,
  onEditPlan,
  t,
}: {
  checks: PresentedUpcomingCheck[];
  now: Date;
  locale: string;
  titleId: string;
  onRequest?: (routineId: string) => Promise<void>;
  onSkip?: (routineId: string, plannedStart: Date, plannedEnd: Date) => Promise<void>;
  onEditPlan?: (routineId: string) => void;
  t: (key: MessageKey) => string;
}) {
  const [openId, setOpenId] = useState<string>();
  const [busyAction, setBusyAction] = useState<'request' | 'skip'>();
  const [actionError, setActionError] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!openId) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!sectionRef.current?.contains(event.target as Node)) setOpenId(undefined);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpenId(undefined); };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openId]);
  const run = async (action: 'request' | 'skip', item: PresentedUpcomingCheck) => {
    if (action === 'skip' && !window.confirm(t('confirmSkipPlannedCheck'))) return;
    setBusyAction(action);
    setActionError(false);
    try {
      if (action === 'request') await onRequest?.(item.routineId);
      else await onSkip?.(item.routineId, item.planned.start, item.planned.end);
      setOpenId(undefined);
    } catch (error) {
      console.error(error);
      setActionError(true);
    } finally {
      setBusyAction(undefined);
    }
  };
  if (!checks.length) return null;
  return (
    <section ref={sectionRef} className="today-section upcoming-checks-section" aria-labelledby={titleId}>
      <div className="section-heading upcoming-checks-heading">
        <h2 id={titleId}>{t('upcomingChecks')}</h2>
      </div>
      <div className="upcoming-checks-list">
        {checks.map((item) => {
          const actionId = `${item.routineId}:${item.planned.start.toISOString()}`;
          const menuOpen = openId === actionId;
          return <article className={`upcoming-check-card${menuOpen ? ' menu-open' : ''}`} style={item.presentation.style} key={actionId}>
            <span className="settings-row-icon today-task-icon" aria-hidden="true"><AppIcon name={routineIconName(item.presentation.icon)} /></span>
            <div className="upcoming-check-copy">
              <h3>{item.presentation.name}</h3>
              <p>{plannedWindowLabel(item.planned.start, item.planned.end, now, locale, t)}</p>
            </div>
            {onRequest || onSkip || onEditPlan ? <div className="upcoming-check-actions">
              <button type="button" className="upcoming-check-menu-trigger" aria-label={`${t('upcomingCheckActions')} · ${item.presentation.name}`} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => { setActionError(false); setOpenId(menuOpen ? undefined : actionId); }}><SvgIcon icon={ellipsisHorizontal} /></button>
              {menuOpen ? <div className="upcoming-check-menu" role="menu">
                {onRequest ? <button type="button" role="menuitem" disabled={Boolean(busyAction)} onClick={() => { void run('request', item); }}><SvgIcon icon={playOutline} /><span><b>{t('requestCheckNow')}</b><small>{t('requestPlannedCheckNowHint')}</small></span></button> : null}
                {onSkip ? <button type="button" role="menuitem" className="skip" disabled={Boolean(busyAction)} onClick={() => { void run('skip', item); }}><AppIcon name="close" /><span><b>{t('skipPlannedCheck')}</b><small>{t('skipPlannedCheckHint')}</small></span></button> : null}
                {onEditPlan ? <button type="button" role="menuitem" disabled={Boolean(busyAction)} onClick={() => { setOpenId(undefined); onEditPlan(item.routineId); }}><AppIcon name="calendar" /><span><b>{t('editSchedule')}</b><small>{t('editPlannedCheckHint')}</small></span></button> : null}
                {actionError ? <p role="alert">{t('plannedCheckActionError')}</p> : null}
              </div> : null}
            </div> : null}
          </article>;
        })}
      </div>
    </section>
  );
}
