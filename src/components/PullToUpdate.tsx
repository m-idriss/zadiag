import { useRef, useState, type CSSProperties, type ReactNode, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import type { MessageKey } from '../services/i18n';

const PULL_THRESHOLD = 72;
const MAX_PULL_DISTANCE = 160;
const PULL_RESISTANCE = 0.65;
const PULL_OVERSHOOT_RESISTANCE = 0.08;
const HORIZONTAL_SWIPE_THRESHOLD = 64;
const HORIZONTAL_SWIPE_DOMINANCE = 1.35;
const SWIPE_NAVIGATION_EXCLUSION_SELECTOR = 'button, a, input, select, textarea, summary, [role="button"], dialog, .parent-review-card, [data-swipe-navigation="ignore"]';

type PullGesture = {
  startX: number;
  startY: number;
  scrollContainer: HTMLElement;
};

type SwipeGesture = {
  startX: number;
  startY: number;
};

const resistedPullDistance = (distance: number) => {
  const boundedDistance = Math.max(0, Math.min(MAX_PULL_DISTANCE, distance));
  if (boundedDistance <= PULL_THRESHOLD) return boundedDistance * PULL_RESISTANCE;
  return PULL_THRESHOLD * PULL_RESISTANCE
    + (boundedDistance - PULL_THRESHOLD) * PULL_OVERSHOOT_RESISTANCE;
};

export function PullToUpdate({
  children,
  onHorizontalSwipe,
  onUpdate,
  t,
}: {
  children: ReactNode;
  onHorizontalSwipe?: (direction: 'left' | 'right') => void;
  onUpdate: () => Promise<unknown>;
  t: (key: MessageKey) => string;
}) {
  const gestureRef = useRef<PullGesture | undefined>(undefined);
  const swipeGestureRef = useRef<SwipeGesture | undefined>(undefined);
  const thresholdReachedRef = useRef(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [updating, setUpdating] = useState(false);

  const resetPull = () => {
    gestureRef.current = undefined;
    thresholdReachedRef.current = false;
    setPullDistance(0);
  };

  const startPull = (event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    const target = event.target instanceof Element ? event.target : undefined;
    const touch = event.touches[0];
    swipeGestureRef.current = onHorizontalSwipe && !target?.closest(SWIPE_NAVIGATION_EXCLUSION_SELECTOR)
      ? { startX: touch.clientX, startY: touch.clientY }
      : undefined;
    if (updating) return;
    const scrollContainer = target?.closest<HTMLElement>('.content-screen, .page');
    if (!scrollContainer || scrollContainer.scrollTop > 0) return;
    gestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      scrollContainer,
    };
    thresholdReachedRef.current = false;
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
    if (verticalDistance > 0) event.preventDefault();
    const distance = Math.max(0, Math.min(MAX_PULL_DISTANCE, verticalDistance));
    if (distance >= PULL_THRESHOLD && !thresholdReachedRef.current) {
      thresholdReachedRef.current = true;
      navigator.vibrate?.(10);
    }
    setPullDistance(resistedPullDistance(distance));
  };

  const endPull = (event: TouchEvent<HTMLDivElement>) => {
    const shouldUpdate = Boolean(gestureRef.current && !updating && thresholdReachedRef.current);
    const swipeGesture = swipeGestureRef.current;
    const touch = event.changedTouches[0];
    swipeGestureRef.current = undefined;
    resetPull();
    if (shouldUpdate) {
      setUpdating(true);
      void onUpdate()
        .catch((error) => console.error('Pull to update failed', error))
        .finally(() => setUpdating(false));
      return;
    }
    if (!swipeGesture || !touch || !onHorizontalSwipe) return;
    const deltaX = touch.clientX - swipeGesture.startX;
    const deltaY = touch.clientY - swipeGesture.startY;
    if (Math.abs(deltaX) < HORIZONTAL_SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY) * HORIZONTAL_SWIPE_DOMINANCE) return;
    onHorizontalSwipe(deltaX < 0 ? 'left' : 'right');
  };

  const cancelGestures = () => {
    swipeGestureRef.current = undefined;
    resetPull();
  };

  const label = updating
    ? t('settingsPullUpdateChecking')
    : thresholdReachedRef.current
      ? t('settingsPullUpdateRelease')
      : t('settingsPullUpdatePull');
  const visible = updating || pullDistance > 0;
  const indicator = (
    <div className={`pull-update-indicator ${visible ? 'visible' : ''}`} role="status" aria-label={label}>
      <svg className="pull-update-spinner" viewBox="0 0 32 32" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <line
            className="pull-update-spinner-ray"
            x1="16"
            y1="4"
            x2="16"
            y2="9"
            key={index}
            transform={`rotate(${index * 45} 16 16)`}
          />
        ))}
      </svg>
    </div>
  );

  return (
    <div
      className={`app-shell ${pullDistance > 0 ? 'pull-active' : ''}`}
      style={{ '--pull-distance': `${pullDistance}px` } as CSSProperties}
      onTouchStart={startPull}
      onTouchMove={movePull}
      onTouchEnd={endPull}
      onTouchCancel={cancelGestures}
    >
      {createPortal(indicator, document.body)}
      {children}
    </div>
  );
}
