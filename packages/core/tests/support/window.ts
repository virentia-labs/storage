import { afterEach, beforeEach, vi } from "vitest";

// Capture the precise spy type via a factory's ReturnType; `ReturnType<typeof
// vi.spyOn>` collapses to a generic SpyInstance that the assignment rejects.
const spyOnAddEventListener = () => vi.spyOn(window, "addEventListener");

/**
 * Install per-test bookkeeping that removes every `window` listener the test
 * added, so a box's handler never leaks onto the shared jsdom window and fires
 * during a later test. Call once at the top of a `describe` (or the file).
 */
export function removeWindowListenersAfterEach(): void {
  let spy: ReturnType<typeof spyOnAddEventListener>;
  beforeEach(() => {
    spy = spyOnAddEventListener();
  });
  afterEach(() => {
    for (const [type, handler] of spy.mock.calls) {
      window.removeEventListener(type, handler);
    }
  });
}

/** Build a cross-document `storage` event. */
export const storageEvent = (init: StorageEventInit): StorageEvent =>
  new StorageEvent("storage", init);

/** Fire a `popstate` (back/forward navigation) on the window. */
export const popstate = (): void => void window.dispatchEvent(new PopStateEvent("popstate"));
