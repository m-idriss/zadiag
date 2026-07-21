import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PullToUpdate } from './PullToUpdate';

const t = (key: string) => key;

const dispatchTouch = (
  element: Element,
  type: 'touchstart' | 'touchmove' | 'touchend',
  clientX: number,
  clientY: number,
) => {
  const event = new Event(type, { bubbles: true });
  const touches = type === 'touchend' ? [] : [{ clientX, clientY }];
  Object.defineProperty(event, 'touches', { value: touches });
  Object.defineProperty(event, 'changedTouches', { value: [{ clientX, clientY }] });
  act(() => element.dispatchEvent(event));
};

describe('PullToUpdate', () => {
  let container: HTMLDivElement | undefined;
  let root: ReturnType<typeof createRoot> | undefined;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    vi.unstubAllGlobals();
  });

  const renderPullToUpdate = (
    onUpdate: () => Promise<unknown>,
    onHorizontalSwipe?: (direction: 'left' | 'right') => void,
  ) => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(
      <PullToUpdate onHorizontalSwipe={onHorizontalSwipe} onUpdate={onUpdate} t={t}>
        <div className="content-screen">Page</div>
      </PullToUpdate>,
    ));
    return container.querySelector('.content-screen') as HTMLElement;
  };

  it('updates after a downward pull from the top of a page', async () => {
    const onUpdate = vi.fn().mockResolvedValue(false);
    const page = renderPullToUpdate(onUpdate);

    dispatchTouch(page, 'touchstart', 20, 20);
    dispatchTouch(page, 'touchmove', 20, 100);

    expect(document.querySelectorAll('.pull-update-spinner-ray')).toHaveLength(8);
    expect(document.querySelector('.pull-update-indicator')?.textContent).toBe('');

    dispatchTouch(page, 'touchend', 20, 100);

    await act(async () => Promise.resolve());
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it('adds resistance, latches at the threshold, and confirms it once', async () => {
    const onUpdate = vi.fn().mockResolvedValue(false);
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { ...navigator, vibrate });
    const page = renderPullToUpdate(onUpdate);
    const shell = page.closest('.app-shell') as HTMLElement;

    dispatchTouch(page, 'touchstart', 20, 20);
    dispatchTouch(page, 'touchmove', 20, 100);
    const thresholdOffset = Number.parseFloat(shell.style.getPropertyValue('--pull-distance'));
    dispatchTouch(page, 'touchmove', 20, 220);
    const maximumOffset = Number.parseFloat(shell.style.getPropertyValue('--pull-distance'));
    dispatchTouch(page, 'touchmove', 20, 70);
    dispatchTouch(page, 'touchend', 20, 70);

    await act(async () => Promise.resolve());
    expect(thresholdOffset).toBeLessThan(80);
    expect(maximumOffset).toBeLessThan(60);
    expect(vibrate).toHaveBeenCalledOnce();
    expect(vibrate).toHaveBeenCalledWith(10);
    expect(onUpdate).toHaveBeenCalledOnce();
  });

  it('does not update while the page is scrolled or during a horizontal swipe', () => {
    const onUpdate = vi.fn().mockResolvedValue(false);
    const page = renderPullToUpdate(onUpdate);

    Object.defineProperty(page, 'scrollTop', { configurable: true, value: 10 });
    dispatchTouch(page, 'touchstart', 20, 20);
    dispatchTouch(page, 'touchmove', 20, 110);
    dispatchTouch(page, 'touchend', 20, 110);

    Object.defineProperty(page, 'scrollTop', { configurable: true, value: 0 });
    dispatchTouch(page, 'touchstart', 20, 20);
    dispatchTouch(page, 'touchmove', 120, 30);
    dispatchTouch(page, 'touchend', 120, 30);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('renders the shared indicator in the viewport layer', () => {
    renderPullToUpdate(async () => false);

    expect(document.body.querySelector(':scope > .pull-update-indicator')).not.toBeNull();
    expect(container?.querySelector('.pull-update-indicator')).toBeNull();
  });

  it('navigates with a deliberate horizontal swipe in either direction', () => {
    const onHorizontalSwipe = vi.fn();
    const page = renderPullToUpdate(async () => false, onHorizontalSwipe);

    dispatchTouch(page, 'touchstart', 120, 80);
    dispatchTouch(page, 'touchend', 30, 85);
    dispatchTouch(page, 'touchstart', 30, 80);
    dispatchTouch(page, 'touchend', 120, 75);

    expect(onHorizontalSwipe).toHaveBeenNthCalledWith(1, 'left');
    expect(onHorizontalSwipe).toHaveBeenNthCalledWith(2, 'right');
  });

  it('leaves interactive controls and review-card swipes untouched', () => {
    const onHorizontalSwipe = vi.fn();
    const page = renderPullToUpdate(async () => false, onHorizontalSwipe);
    page.innerHTML = '<button type="button">Action</button><article class="parent-review-card"><span>Review</span></article>';
    const button = page.querySelector('button') as HTMLButtonElement;
    const review = page.querySelector('.parent-review-card span') as HTMLSpanElement;

    dispatchTouch(button, 'touchstart', 120, 80);
    dispatchTouch(button, 'touchend', 30, 80);
    dispatchTouch(review, 'touchstart', 120, 80);
    dispatchTouch(review, 'touchend', 30, 80);

    expect(onHorizontalSwipe).not.toHaveBeenCalled();
  });
});
