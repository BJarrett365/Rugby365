import "server-only";
import { createDb } from "@rugby365/db";

let _db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}
