import { useEffect, useMemo, useState } from 'react';
import type { Locale, Role, RoutineAssignment, VerificationEvent } from '../domain/models';
import { notificationsForEvents, type AppNotificationKind } from '../domain/notificationCenter';
import { presentRoutine } from '../domain/routinePresentation';
import { useModalFocus } from '../hooks/useModalFocus';
import type { MessageKey } from '../services/i18n';
import { languageTag } from '../services/locale';
import { readUiStorageJson, writeUiStorageString } from '../services/uiStorage';
import { AppIcon } from './Icon';

const titleKeys: Record<AppNotificationKind, MessageKey> = {
  check_ready: 'notificationCenterCheckReady',
  retry: 'notificationCenterRetry',
  missed: 'notificationCenterMissed',
  review: 'notificationCenterReview',
};

const readNotificationIds = (storageKey: string, notificationIds: string[]) => {
  const stored = readUiStorageJson<string[]>(storageKey, [], (value) => (
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  ));
  const currentIds = new Set(notificationIds);
  return stored.filter((id) => currentIds.has(id));
};

export function NotificationCenter({
  role,
  events,
  assignments,
  locale,
  contextId,
  onOpenEvent,
  t,
}: {
  role: Role;
  events: VerificationEvent[];
  assignments: RoutineAssignment[];
  locale: Locale;
  contextId: string;
  onOpenEvent: (event: VerificationEvent) => void;
  t: (key: MessageKey) => string;
}) {
  const [open, setOpen] = useState(false);
  const notifications = notificationsForEvents(role, events);
  const notificationIds = notifications.map((notification) => notification.id);
  const notificationIdSignature = notificationIds.join('|');
  const storageKey = `zadiag.notificationCenter.read.${role}.${contextId}`;
  const [readState, setReadState] = useState(() => ({
    storageKey,
    ids: readNotificationIds(storageKey, notificationIds),
  }));
  const dialogRef = useModalFocus<HTMLDivElement>(open, () => setOpen(false));
  const routineNames = useMemo(() => new Map(assignments.map((assignment) => [
    assignment.routineId,
    presentRoutine(assignment.routine, locale).name,
  ])), [assignments, locale]);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(languageTag(locale), {
    dateStyle: 'short',
    timeStyle: 'short',
  }), [locale]);

  useEffect(() => {
    const validIds = readNotificationIds(storageKey, notificationIds);
    setReadState({ storageKey, ids: validIds });
  }, [notificationIdSignature, storageKey]);

  const readIds = readState.storageKey === storageKey
    ? readState.ids
    : readNotificationIds(storageKey, notificationIds);
  const readSet = new Set(readIds);
  const unreadCount = notifications.filter((notification) => !readSet.has(notification.id)).length;
  const saveReadIds = (ids: string[]) => {
    setReadState({ storageKey, ids });
    writeUiStorageString(storageKey, JSON.stringify(ids));
  };
  const openCenter = () => {
    if (unreadCount) saveReadIds(notificationIds);
    setOpen(true);
  };
  const openNotification = (notificationId: string, event: VerificationEvent) => {
    if (!readSet.has(notificationId)) saveReadIds([...readIds, notificationId]);
    setOpen(false);
    onOpenEvent(event);
  };

  return (
    <div className="notification-center">
      <button
        type="button"
        className="notification-center-trigger"
        aria-label={unreadCount ? `${t('notificationCenterTitle')} · ${unreadCount}` : t('notificationCenterTitle')}
        onClick={openCenter}
      >
        <AppIcon name="notifications" />
        {unreadCount ? <span className="notification-center-badge">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
      </button>
      {open ? (
        <div className="notification-center-backdrop" onClick={() => setOpen(false)}>
          <div ref={dialogRef} className="notification-center-dialog" role="dialog" aria-modal="true" aria-labelledby="notification-center-title" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <small>{t('notifications')}</small>
                <h2 id="notification-center-title">{t('notificationCenterTitle')}</h2>
              </div>
              <button type="button" data-autofocus aria-label={t('close')} onClick={() => setOpen(false)}><AppIcon name="close" /></button>
            </header>
            {notifications.length ? (
              <>
                {unreadCount ? <button type="button" className="notification-center-mark-all" onClick={() => saveReadIds(notificationIds)}>{t('notificationCenterMarkAllRead')}</button> : null}
                <div className="notification-center-list">
                  {notifications.map((notification) => (
                    <button
                      type="button"
                      className={readSet.has(notification.id) ? 'read' : 'unread'}
                      key={notification.id}
                      onClick={() => openNotification(notification.id, notification.event)}
                    >
                      <span className="notification-center-kind" aria-hidden="true"><AppIcon name={notification.kind === 'check_ready' ? 'camera' : notification.kind === 'review' ? 'check' : 'info'} /></span>
                      <span>
                        <strong>{t(titleKeys[notification.kind])}</strong>
                        <small>{routineNames.get(notification.event.routineId) ?? t('routine')} · {dateFormatter.format(new Date(notification.timestamp))}</small>
                      </span>
                      {!readSet.has(notification.id) ? <i>{t('notificationCenterUnread')}</i> : null}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="notification-center-empty">
                <AppIcon name="notifications" />
                <strong>{t('notificationCenterEmptyTitle')}</strong>
                <p>{t('notificationCenterEmptyDetail')}</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
