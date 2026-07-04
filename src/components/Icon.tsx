import { IonIcon } from '@ionic/react';
import {
  cameraOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  addCircleOutline,
  calendarOutline,
  homeOutline,
  listOutline,
  medicalOutline,
  notificationsOutline,
  sendOutline,
  settingsOutline,
  sparklesOutline,
  statsChartOutline,
  timeOutline,
  todayOutline,
  waterOutline,
} from 'ionicons/icons';

export type AppIconName =
  | 'camera'
  | 'check'
  | 'close'
  | 'add'
  | 'calendar'
  | 'home'
  | 'medical'
  | 'notifications'
  | 'routines'
  | 'send'
  | 'settings'
  | 'sparkles'
  | 'stats'
  | 'time'
  | 'today'
  | 'tooth'
  | 'water';

const toothIcon = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='currentColor' d='M12 2.6c-1.1 0-1.9.36-2.62.69-.65.3-.99.42-1.55.22C5.05 2.54 3 4.72 3 7.52c0 1.56.55 2.82 1.22 3.95.69 1.15 1.17 2.1 1.36 3.47l.39 2.81C6.22 19.55 7.4 21 8.92 21c1.28 0 2.15-.95 2.55-2.38l.57-2.05.57 2.05C13 20.05 13.87 21 15.15 21c1.52 0 2.7-1.45 2.95-3.25l.39-2.81c.19-1.37.67-2.32 1.36-3.47.67-1.13 1.22-2.39 1.22-3.95 0-2.8-2.05-4.98-4.83-4.01-.56.2-.9.08-1.55-.22-.72-.33-1.59-.69-2.69-.69Zm0 1.9c.68 0 1.25.24 1.89.53.75.34 1.61.73 2.97.25 1.3-.45 2.34.55 2.34 2.24 0 1.12-.39 2.02-.95 2.96-.75 1.25-1.36 2.45-1.6 4.2l-.39 2.81c-.13.95-.62 1.61-1.11 1.61-.36 0-.6-.36-.8-1.01l-.74-2.66c-.23-.81-.86-1.34-1.57-1.34s-1.34.53-1.57 1.34l-.74 2.66c-.2.65-.44 1.01-.8 1.01-.49 0-.98-.66-1.11-1.61l-.39-2.81c-.24-1.75-.85-2.95-1.6-4.2-.56-.94-.95-1.84-.95-2.96 0-1.69 1.04-2.69 2.34-2.24 1.36.48 2.22.09 2.97-.25.64-.29 1.21-.53 1.9-.53Z'/></svg>";

const icons: Record<AppIconName, string> = {
  camera: cameraOutline,
  check: checkmarkCircleOutline,
  close: closeCircleOutline,
  add: addCircleOutline,
  calendar: calendarOutline,
  home: homeOutline,
  medical: medicalOutline,
  notifications: notificationsOutline,
  routines: listOutline,
  send: sendOutline,
  settings: settingsOutline,
  sparkles: sparklesOutline,
  stats: statsChartOutline,
  time: timeOutline,
  today: todayOutline,
  tooth: toothIcon,
  water: waterOutline,
};

export function AppIcon({ name, className }: { name: AppIconName; className?: string }) {
  return (
    <IonIcon
      className={className ? `app-icon ${className}` : 'app-icon'}
      icon={icons[name]}
      aria-hidden="true"
    />
  );
}

export const routineIconName = (icon?: string): AppIconName => {
  if (icon === '💧') return 'water';
  if (icon === '📷' || icon === '▣') return 'camera';
  if (icon === '📤' || icon === '➤') return 'send';
  if (icon === '🦷') return 'tooth';
  return 'sparkles';
};
