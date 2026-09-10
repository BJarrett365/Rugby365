/**
 * Public player URL resolution.
 * Rankings and imports sometimes keep `__legacy__` slugs after a sync collision.
 * After duplicates are merged, those URLs must still load the surviving player.
 */
import { eq } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "./db";

export const PLAYER_PUBLIC_SLUG_ALIASES: Record<string, string> = {
  "francois-hougaard": "francois-hougaard-x91ng0jw__legacy__2f59ab8f",
  "francois-hougaard-x91ng0jw": "francois-hougaard-x91ng0jw__legacy__2f59ab8f",
  "ruan-pienaar-g9n43r6l": "ruan-pienaar-10574",
  "tendai-mtawarira-10521__legacy__dfbea838": "tendai-mtawarira-10521",
  "jaco-taute-retired": "jaco-taute",
  "jaco-taute-retired__legacy__7a6e3f99": "jaco-taute",
};

export function publicPlayerSlugCandidates(slug: string): string[] {
  const normalized = slug.trim();
  const out: string[] = [];
  const push = (value: string) => {
    if (value && !out.includes(value)) out.push(value);
  };
  push(normalized);
  const alias = PLAYER_PUBLIC_SLUG_ALIASES[normalized];
  if (alias) push(alias);
  if (normalized.includes("__legacy__")) {
    const base = normalized.split("__legacy__")[0] ?? "";
    push(base);
    const stripped = base.replace(/-[a-z0-9]{8}$/i, "");
    if (stripped !== base) push(stripped);
    const aliasedBase = PLAYER_PUBLIC_SLUG_ALIASES[base];
    if (aliasedBase) push(aliasedBase);
  }
  return out;
}

export async function findPlayerByPublicSlug(slug: string) {
  const db = getDb();
  for (const candidate of publicPlayerSlugCandidates(slug)) {
    const [row] = await db.select().from(players).where(eq(players.slug, candidate)).limit(1);
    if (row) return row;
  }
  return null;
}
