import type { CSSProperties } from 'react';
import {
  cameraOutline,
  checkmarkCircleOutline,
  homeOutline,
  listOutline,
  medicalOutline,
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
  | 'home'
  | 'medical'
  | 'routines'
  | 'send'
  | 'settings'
  | 'sparkles'
  | 'stats'
  | 'time'
  | 'today'
  | 'water';

const icons: Record<AppIconName, string> = {
  camera: cameraOutline,
  check: checkmarkCircleOutline,
  home: homeOutline,
  medical: medicalOutline,
  routines: listOutline,
  send: sendOutline,
  settings: settingsOutline,
  sparkles: sparklesOutline,
  stats: statsChartOutline,
  time: timeOutline,
  today: todayOutline,
  water: waterOutline,
};

export function AppIcon({ name, className }: { name: AppIconName; className?: string }) {
  return (
    <span
      className={className ? `app-icon ${className}` : 'app-icon'}
      style={{ '--app-icon-url': `url("${icons[name]}")` } as CSSProperties}
      aria-hidden="true"
    />
  );
}

export const routineIconName = (icon?: string): AppIconName => {
  if (icon === '💧') return 'water';
  if (icon === '📷' || icon === '▣') return 'camera';
  if (icon === '📤' || icon === '➤') return 'send';
  if (icon === '🦷') return 'medical';
  return 'sparkles';
};
