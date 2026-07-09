// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { query } from "../../lib";

describe("query falls back to memory when the History API is missing", () => {
  it("keeps values in memory with reference semantics", () => {
    const desc = Object.getOwnPropertyDescriptor(window, "history");
    Object.defineProperty(window, "history", { value: undefined, configurable: true });
    try {
      const box = query();
      const value = { a: 1 };
      box.set("k", value);
      expect(box.get("k")).toBe(value); // memory reference semantics
    } finally {
      if (desc) Object.defineProperty(window, "history", desc);
      else delete (window as { history?: unknown }).history;
    }
  });
});
