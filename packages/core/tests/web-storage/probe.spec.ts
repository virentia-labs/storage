// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { local } from "../../lib";

afterEach(() => {
  window.localStorage.clear();
});

describe("web-storage probe", () => {
  it("leaves no residue at the probe key after construction", () => {
    local();
    expect(window.localStorage.getItem("__virentia_storage_probe__")).toBeNull();
  });

  it("removes a pre-existing value at the probe key", () => {
    window.localStorage.setItem("__virentia_storage_probe__", "user-data");
    local();
    expect(window.localStorage.getItem("__virentia_storage_probe__")).toBeNull();
  });
});
