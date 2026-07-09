import { describe, expect, it } from "vitest";

import { jsonSerializer, querySerializer } from "../../lib";
import { forAll, jsonNonStringValue, jsonValue } from "../support/arbitrary";

describe("serializer round-trip (property)", () => {
  it("jsonSerializer.read reverses write for any JSON-safe value", () => {
    forAll(0x5eed, 500, (rng) => {
      const value = jsonValue(rng);
      expect(jsonSerializer.read(jsonSerializer.write(value))).toEqual(value);
    });
  });

  it("querySerializer.read reverses write for any non-string JSON value", () => {
    forAll(0xc0ffee, 500, (rng) => {
      const value = jsonNonStringValue(rng);
      expect(querySerializer.read(querySerializer.write(value))).toEqual(value);
    });
  });
});
