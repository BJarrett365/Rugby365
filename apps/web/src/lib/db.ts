import "server-only";
import { createDb } from "@rugby365/db";

type Db = ReturnType<typeof createDb>;

const globalForDb = globalThis as typeof globalThis & {
  __rugby365Db?: Db;
};

/** Process-wide singleton so Next.js HMR does not open a new pool per reload. */
export function getDb() {
  if (!globalForDb.__rugby365Db) {
    globalForDb.__rugby365Db = createDb();
  }
  return globalForDb.__rugby365Db;
}
