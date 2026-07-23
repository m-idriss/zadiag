import {
  cameraOutline,
  chevronBackOutline,
  chevronForwardOutline,
  chevronDownOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  downloadOutline,
  eyeOutline,
  fitnessOutline,
  addCircleOutline,
  alarmOutline,
  bandageOutline,
  barbellOutline,
  basketOutline,
  basketballOutline,
  bedOutline,
  bicycleOutline,
  bodyOutline,
  bookOutline,
  bulbOutline,
  cafeOutline,
  callOutline,
  calendarOutline,
  carOutline,
  cartOutline,
  chatbubbleOutline,
  colorPaletteOutline,
  earOutline,
  fastFoodOutline,
  flagOutline,
  flameOutline,
  flowerOutline,
  footballOutline,
  footstepsOutline,
  gameControllerOutline,
  giftOutline,
  glassesOutline,
  heartOutline,
  homeOutline,
  hourglassOutline,
  informationCircleOutline,
  leafOutline,
  linkOutline,
  listOutline,
  mailOutline,
  medicalOutline,
  medkitOutline,
  megaphoneOutline,
  moonOutline,
  musicalNotesOutline,
  notificationsOutline,
  nutritionOutline,
  paperPlaneOutline,
  pawOutline,
  peopleOutline,
  personOutline,
  refreshOutline,
  pulseOutline,
  restaurantOutline,
  ribbonOutline,
  rocketOutline,
  schoolOutline,
  searchOutline,
  sendOutline,
  settingsOutline,
  shareOutline,
  shieldOutline,
  shirtOutline,
  sparklesOutline,
  starOutline,
  statsChartOutline,
  stopwatchOutline,
  sunnyOutline,
  tennisballOutline,
  thermometerOutline,
  thumbsUpOutline,
  timeOutline,
  timerOutline,
  todayOutline,
  trophyOutline,
  walkOutline,
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
  | 'eye'
  | 'fitness'
  | 'add'
  | 'alarm'
  | 'bandage'
  | 'barbell'
  | 'basket'
  | 'basketball'
  | 'bed'
  | 'bicycle'
  | 'body'
  | 'book'
  | 'bulb'
  | 'cafe'
  | 'call'
  | 'calendar'
  | 'car'
  | 'cart'
  | 'chat'
  | 'home'
  | 'color-palette'
  | 'ear'
  | 'fast-food'
  | 'flag'
  | 'flame'
  | 'flower'
  | 'football'
  | 'footsteps'
  | 'game-controller'
  | 'gift'
  | 'glasses'
  | 'heart'
  | 'hourglass'
  | 'info'
  | 'leaf'
  | 'link'
  | 'mail'
  | 'medical'
  | 'medkit'
  | 'megaphone'
  | 'moon'
  | 'musical-notes'
  | 'notifications'
  | 'nutrition'
  | 'paper-plane'
  | 'paw'
  | 'people'
  | 'person'
  | 'refresh'
  | 'pulse'
  | 'restaurant'
  | 'ribbon'
  | 'rocket'
  | 'routines'
  | 'school'
  | 'search'
  | 'send'
  | 'settings'
  | 'share'
  | 'shield'
  | 'shirt'
  | 'sparkles'
  | 'star'
  | 'stats'
  | 'stopwatch'
  | 'sunny'
  | 'tennis'
  | 'thermometer'
  | 'thumbs-up'
  | 'time'
  | 'timer'
  | 'today'
  | 'tooth'
  | 'trophy'
  | 'walk'
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
  eye: eyeOutline,
  fitness: fitnessOutline,
  add: addCircleOutline,
  alarm: alarmOutline,
  bandage: bandageOutline,
  barbell: barbellOutline,
  basket: basketOutline,
  basketball: basketballOutline,
  bed: bedOutline,
  bicycle: bicycleOutline,
  body: bodyOutline,
  book: bookOutline,
  bulb: bulbOutline,
  cafe: cafeOutline,
  call: callOutline,
  calendar: calendarOutline,
  car: carOutline,
  cart: cartOutline,
  chat: chatbubbleOutline,
  'color-palette': colorPaletteOutline,
  ear: earOutline,
  'fast-food': fastFoodOutline,
  flag: flagOutline,
  flame: flameOutline,
  flower: flowerOutline,
  football: footballOutline,
  footsteps: footstepsOutline,
  'game-controller': gameControllerOutline,
  gift: giftOutline,
  glasses: glassesOutline,
  heart: heartOutline,
  home: homeOutline,
  hourglass: hourglassOutline,
  info: informationCircleOutline,
  leaf: leafOutline,
  link: linkOutline,
  mail: mailOutline,
  medical: medicalOutline,
  medkit: medkitOutline,
  megaphone: megaphoneOutline,
  moon: moonOutline,
  'musical-notes': musicalNotesOutline,
  notifications: notificationsOutline,
  nutrition: nutritionOutline,
  'paper-plane': paperPlaneOutline,
  paw: pawOutline,
  people: peopleOutline,
  person: personOutline,
  refresh: refreshOutline,
  pulse: pulseOutline,
  restaurant: restaurantOutline,
  ribbon: ribbonOutline,
  rocket: rocketOutline,
  routines: listOutline,
  school: schoolOutline,
  search: searchOutline,
  send: sendOutline,
  settings: settingsOutline,
  share: shareOutline,
  shield: shieldOutline,
  shirt: shirtOutline,
  sparkles: sparklesOutline,
  star: starOutline,
  stats: statsChartOutline,
  stopwatch: stopwatchOutline,
  sunny: sunnyOutline,
  tennis: tennisballOutline,
  thermometer: thermometerOutline,
  'thumbs-up': thumbsUpOutline,
  time: timeOutline,
  timer: timerOutline,
  today: todayOutline,
  tooth: toothIcon,
  trophy: trophyOutline,
  walk: walkOutline,
  water: waterOutline,
};

export function AppIcon({ name, className }: { name: AppIconName; className?: string }) {
  return <SvgIcon icon={icons[name]} className={className ? `app-icon ${className}` : 'app-icon'} />;
}

export const routineIconName = (icon?: string): AppIconName => {
  const normalizedIcon = icon?.trim().toLowerCase();
  if (icon === '💧') return 'water';
  if (icon === '📷' || icon === '▣') return 'camera';
  if (icon === '📤' || icon === '➤') return 'send';
  if (icon === '🦷' || normalizedIcon === 'tooth' || normalizedIcon === 'teeth' || normalizedIcon === 'dental') return 'tooth';
  if (normalizedIcon === 'water') return 'water';
  if (normalizedIcon === 'camera') return 'camera';
  if (normalizedIcon === 'send') return 'send';
  if (normalizedIcon === 'medical') return 'medical';
  if (normalizedIcon === 'fitness') return 'fitness';
  if (normalizedIcon === 'check') return 'check';
  if (normalizedIcon === 'pulse') return 'pulse';
  if (normalizedIcon === 'eye') return 'eye';
  if (normalizedIcon === 'star') return 'star';
  if (normalizedIcon && normalizedIcon in icons) return normalizedIcon as AppIconName;
  return 'sparkles';
};
