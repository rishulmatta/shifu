// Picks the store: Postgres when DATABASE_URL is set, files under .data/ otherwise.

import { FileStore } from "./file";
import { PostgresStore } from "./postgres";
import type { Store } from "./types";

let store: Store | null = null;

export function getStore(): Store {
  store ??= process.env.DATABASE_URL ? new PostgresStore(process.env.DATABASE_URL) : new FileStore();
  return store;
}

export type { BuildProgress, BuildStep, CourseRecord, Store } from "./types";
