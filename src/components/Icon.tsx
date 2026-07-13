import {
  cameraOutline,
  chevronBackOutline,
  chevronForwardOutline,
  chevronDownOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  downloadOutline,
  addCircleOutline,
  calendarOutline,
  homeOutline,
  informationCircleOutline,
  linkOutline,
  listOutline,
  medicalOutline,
  notificationsOutline,
  refreshOutline,
  sendOutline,
  settingsOutline,
  shareOutline,
  sparklesOutline,
  statsChartOutline,
  timeOutline,
  todayOutline,
  waterOutline,
} from 'ionicons/icons';
import { SvgIcon } from './SvgIcon';

export type AppIconName =
  | 'camera'
  | 'chevron-back'
  | 'chevron-forward'
  | 'chevron-down'
  | 'check'
  | 'close'
  | 'download'
  | 'add'
  | 'calendar'
  | 'home'
  | 'info'
  | 'link'
  | 'medical'
  | 'notifications'
  | 'refresh'
  | 'routines'
  | 'send'
  | 'settings'
  | 'share'
  | 'sparkles'
  | 'stats'
  | 'time'
  | 'today'
  | 'tooth'
  | 'water';

const toothIcon = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.85' d='M12 3.75c-.76 0-1.37.27-2.02.56-.8.36-1.6.72-2.72.34C5.44 4.03 4 5.47 4 7.59c0 1.28.45 2.33 1.05 3.35.74 1.25 1.27 2.36 1.49 3.91l.36 2.55c.18 1.29.94 2.35 1.87 2.35.66 0 1.1-.53 1.36-1.45l.72-2.54c.18-.66.63-1.08 1.15-1.08s.97.42 1.15 1.08l.72 2.54c.26.92.7 1.45 1.36 1.45.93 0 1.69-1.06 1.87-2.35l.36-2.55c.22-1.55.75-2.66 1.49-3.91.6-1.02 1.05-2.07 1.05-3.35 0-2.12-1.44-3.56-3.26-2.94-1.12.38-1.92.02-2.72-.34-.65-.29-1.26-.56-2.02-.56Z'/></svg>";

const icons: Record<AppIconName, string> = {
  camera: cameraOutline,
  'chevron-back': chevronBackOutline,
  'chevron-forward': chevronForwardOutline,
  'chevron-down': chevronDownOutline,
  check: checkmarkCircleOutline,
  close: closeCircleOutline,
  download: downloadOutline,
  add: addCircleOutline,
  calendar: calendarOutline,
  home: homeOutline,
  info: informationCircleOutline,
  link: linkOutline,
  medical: medicalOutline,
  notifications: notificationsOutline,
  refresh: refreshOutline,
  routines: listOutline,
  send: sendOutline,
  settings: settingsOutline,
  share: shareOutline,
  sparkles: sparklesOutline,
  stats: statsChartOutline,
  time: timeOutline,
  today: todayOutline,
  tooth: toothIcon,
  water: waterOutline,
};

export function AppIcon({ name, className }: { name: AppIconName; className?: string }) {
  return (
    <SvgIcon icon={icons[name]} className={className ? `app-icon ${className}` : 'app-icon'} />
  );
}

export const routineIconName = (icon?: string): AppIconName => {
  const normalizedIcon = icon?.trim().toLowerCase();
  if (icon === '💧') return 'water';
  if (icon === '📷' || icon === '▣') return 'camera';
  if (icon === '📤' || icon === '➤') return 'send';
  if (icon === '🦷' || normalizedIcon === 'tooth' || normalizedIcon === 'teeth' || normalizedIcon === 'dental') return 'tooth';
  return 'sparkles';
};
