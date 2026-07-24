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

  it('keeps horizontal navigation available from a full-row history opener', () => {
    const onHorizontalSwipe = vi.fn();
    const page = renderPullToUpdate(async () => false, onHorizontalSwipe);
    page.innerHTML = '<section class="history-row"><button type="button" class="history-row-open-button">Open result</button></section>';
    const historyRowOpener = page.querySelector('.history-row-open-button') as HTMLButtonElement;

    dispatchTouch(historyRowOpener, 'touchstart', 120, 80);
    dispatchTouch(historyRowOpener, 'touchend', 30, 82);

    expect(onHorizontalSwipe).toHaveBeenCalledWith('left');
  });

  it('allows a dashboard to opt its controls into swipe navigation', () => {
    const onHorizontalSwipe = vi.fn();
    const page = renderPullToUpdate(async () => false, onHorizontalSwipe);
    page.innerHTML = '<main data-swipe-navigation="allow"><button type="button">Dashboard filter</button></main>';
    const dashboardFilter = page.querySelector('button') as HTMLButtonElement;

    dispatchTouch(dashboardFilter, 'touchstart', 120, 80);
    dispatchTouch(dashboardFilter, 'touchend', 45, 82);

    expect(onHorizontalSwipe).toHaveBeenCalledWith('left');
  });
});
