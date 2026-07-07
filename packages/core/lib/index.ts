export type { Serializer, StorageBox, StringBoxOptions } from "./box";
export { jsonSerializer } from "./box";

export { memory } from "./memory";
export { local, session } from "./web";
export { query, querySerializer } from "./query";
export type { QueryBoxOptions } from "./query";
export { custom } from "./custom";
export type { CustomStorage } from "./custom";

export { persist } from "./persist";
export type { PersistOptions } from "./persist";
