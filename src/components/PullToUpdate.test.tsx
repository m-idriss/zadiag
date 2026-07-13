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

  const renderPullToUpdate = (onUpdate: () => Promise<unknown>) => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(
      <PullToUpdate onUpdate={onUpdate} t={t}>
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

    expect(container?.querySelectorAll('.pull-update-spinner-ray')).toHaveLength(8);
    expect(container?.querySelector('.pull-update-indicator')?.textContent).toBe('');

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
});
