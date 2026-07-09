import type { Scope } from "@virentia/core";
import { scoped } from "@virentia/core";

/** Read a unit's value as seen from a specific scope. */
export const readIn = <T>(s: Scope, unit: { value: T }): T => scoped(s, () => unit.value);
