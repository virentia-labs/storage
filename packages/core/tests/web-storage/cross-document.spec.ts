// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Serializer } from "../../lib";
import { local, session } from "../../lib";
import { removeWindowListenersAfterEach, storageEvent } from "../support/window";

describe("cross-document watch", () => {
  removeWindowListenersAfterEach();
  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("decodes each storage-event payload for the watched key", () => {
    const box = local();
    const listener = vi.fn();
    box.watch!("token", listener);
    window.dispatchEvent(
      storageEvent({ key: "token", newValue: '"abc"', storageArea: window.localStorage }),
    );
    window.dispatchEvent(
      storageEvent({ key: "token", newValue: "42", storageArea: window.localStorage }),
    );
    expect(listener.mock.calls).toEqual([["abc"], [42]]);
  });

  it("notifies undefined when the event's newValue is null", () => {
    const box = local();
    const listener = vi.fn();
    box.watch!("token", listener);
    window.dispatchEvent(
      storageEvent({ key: "token", newValue: null, storageArea: window.localStorage }),
    );
    expect(listener).toHaveBeenCalledWith(undefined);
  });

  it("notifies undefined on a clear, where the event key is null", () => {
    const box = local();
    const listener = vi.fn();
    box.watch!("token", listener);
    window.dispatchEvent(
      storageEvent({ key: null, newValue: null, storageArea: window.localStorage }),
    );
    expect(listener).toHaveBeenCalledWith(undefined);
  });

  it("ignores an event for a different key", () => {
    const box = local();
    const listener = vi.fn();
    box.watch!("token", listener);
    window.dispatchEvent(
      storageEvent({ key: "other", newValue: "1", storageArea: window.localStorage }),
    );
    expect(listener).not.toHaveBeenCalled();
  });

  it("ignores an event from a different storage area", () => {
    const box = local();
    const listener = vi.fn();
    box.watch!("token", listener);
    window.dispatchEvent(
      storageEvent({ key: "token", newValue: "1", storageArea: window.sessionStorage }),
    );
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not notify for a malformed or empty external payload", () => {
    const box = local();
    const listener = vi.fn();
    box.watch!("token", listener);
    window.dispatchEvent(
      storageEvent({ key: "token", newValue: "{bad", storageArea: window.localStorage }),
    );
    window.dispatchEvent(
      storageEvent({ key: "token", newValue: "", storageArea: window.localStorage }),
    );
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not fire on registration", () => {
    const listener = vi.fn();
    local().watch!("token", listener);
    expect(listener).not.toHaveBeenCalled();
  });

  describe("unsubscribe", () => {
    it("stops delivering to the listener", () => {
      const box = local();
      const listener = vi.fn();
      const unwatch = box.watch!("token", listener);
      unwatch();
      window.dispatchEvent(
        storageEvent({ key: "token", newValue: '"x"', storageArea: window.localStorage }),
      );
      expect(listener).not.toHaveBeenCalled();
    });

    it("is idempotent", () => {
      const box = local();
      const unwatch = box.watch!("token", vi.fn());
      unwatch();
      expect(() => unwatch()).not.toThrow();
    });
  });

  it("a session watcher ignores localStorage-area events", () => {
    const box = session();
    const listener = vi.fn();
    box.watch!("token", listener);
    window.dispatchEvent(
      storageEvent({ key: "token", newValue: "1", storageArea: window.localStorage }),
    );
    expect(listener).not.toHaveBeenCalled();
  });

  it("decodes an external payload through a custom serializer", () => {
    const base64: Serializer = {
      write: (v) => Buffer.from(JSON.stringify(v)).toString("base64"),
      read: (r) => JSON.parse(Buffer.from(r, "base64").toString()),
    };
    const box = local({ serializer: base64 });
    const listener = vi.fn();
    box.watch!("k", listener);
    const encoded = Buffer.from(JSON.stringify({ a: 1 })).toString("base64");
    window.dispatchEvent(
      storageEvent({ key: "k", newValue: encoded, storageArea: window.localStorage }),
    );
    expect(listener).toHaveBeenCalledWith({ a: 1 });
  });
});
