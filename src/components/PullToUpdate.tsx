import { useRef, useState, type ReactNode, type TouchEvent } from 'react';
import type { MessageKey } from '../services/i18n';

const PULL_THRESHOLD = 72;
const MAX_PULL_DISTANCE = 110;

type PullGesture = {
  startX: number;
  startY: number;
  scrollContainer: HTMLElement;
};

export function PullToUpdate({
  children,
  onUpdate,
  t,
}: {
  children: ReactNode;
  onUpdate: () => Promise<unknown>;
  t: (key: MessageKey) => string;
}) {
  const gestureRef = useRef<PullGesture | undefined>(undefined);
  const distanceRef = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [updating, setUpdating] = useState(false);

  const resetPull = () => {
    gestureRef.current = undefined;
    distanceRef.current = 0;
    setPullDistance(0);
  };

  const startPull = (event: TouchEvent<HTMLDivElement>) => {
    if (updating || event.touches.length !== 1) return;
    const target = event.target instanceof Element ? event.target : undefined;
    const scrollContainer = target?.closest<HTMLElement>('.content-screen, .page');
    if (!scrollContainer || scrollContainer.scrollTop > 0) return;
    const touch = event.touches[0];
    gestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      scrollContainer,
    };
    distanceRef.current = 0;
    setPullDistance(0);
  };

  const movePull = (event: TouchEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    const touch = event.touches[0];
    if (!gesture || !touch || updating) return;
    if (gesture.scrollContainer.scrollTop > 0) {
      resetPull();
      return;
    }
    const horizontalDistance = Math.abs(touch.clientX - gesture.startX);
    const verticalDistance = touch.clientY - gesture.startY;
    if (horizontalDistance > Math.abs(verticalDistance) && horizontalDistance > 8) {
      resetPull();
      return;
    }
    const distance = Math.max(0, Math.min(MAX_PULL_DISTANCE, verticalDistance));
    distanceRef.current = distance;
    setPullDistance(distance);
  };

  const endPull = () => {
    if (!gestureRef.current || updating) return;
    const shouldUpdate = distanceRef.current >= PULL_THRESHOLD;
    resetPull();
    if (!shouldUpdate) return;
    setUpdating(true);
    void onUpdate()
      .catch((error) => console.error('Pull to update failed', error))
      .finally(() => setUpdating(false));
  };

  const progress = updating
    ? 100
    : Math.max(0, Math.min(100, Math.round((pullDistance / PULL_THRESHOLD) * 100)));
  const label = updating
    ? t('settingsPullUpdateChecking')
    : pullDistance >= PULL_THRESHOLD
      ? t('settingsPullUpdateRelease')
      : t('settingsPullUpdatePull');
  const visible = updating || pullDistance > 0;
  const spinnerProgress = updating ? 72 : progress;

  return (
    <div
      className="app-shell"
      onTouchStart={startPull}
      onTouchMove={movePull}
      onTouchEnd={endPull}
      onTouchCancel={resetPull}
    >
      <div className={`pull-update-indicator ${visible ? 'visible' : ''}`} aria-live="polite">
        <svg className={`pull-update-spinner ${updating ? 'spinning' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
          <circle className="pull-update-spinner-track" cx="12" cy="12" r="9" pathLength="100" />
          <circle className="pull-update-spinner-progress" cx="12" cy="12" r="9" pathLength="100" style={{ strokeDasharray: `${spinnerProgress} 100` }} />
        </svg>
        <small>{label}</small>
      </div>
      {children}
    </div>
  );
}
