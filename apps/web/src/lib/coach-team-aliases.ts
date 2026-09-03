import { eq, inArray } from "drizzle-orm";
import { teams } from "@rugby365/db";
import { getDb } from "./db";
import { pickCanonicalTeamIdByName } from "./table-lab/standings-fixture-dedupe";

export type TeamAliasRow = { id: string; name: string; slug: string };

/**
 * Duplicate imports (e.g. `ireland-m46v8v9z__legacy__…`) share a display name with
 * the canonical national/club row. Coach tenures often sit on the legacy id, while
 * fixtures, squad, world rankings and match ratings sit on the canonical id.
 */
export async function relatedTeamIdsBySource(
  teamIds: string[],
): Promise<Map<string, string[]>> {
  const unique = [...new Set(teamIds.filter(Boolean))];
  const out = new Map<string, string[]>();
  if (unique.length === 0) return out;
  const db = getDb();
  const rows = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug })
    .from(teams)
    .where(inArray(teams.id, unique));
  const names = [...new Set(rows.map((r) => r.name).filter(Boolean))];
  const siblings =
    names.length > 0
      ? await db
          .select({ id: teams.id, name: teams.name, slug: teams.slug })
          .from(teams)
          .where(inArray(teams.name, names))
      : [];
  const byName = new Map<string, TeamAliasRow[]>();
  for (const row of siblings) {
    const list = byName.get(row.name) ?? [];
    list.push(row);
    byName.set(row.name, list);
  }
  for (const row of rows) {
    const group = byName.get(row.name) ?? [row];
    out.set(row.id, [...new Set(group.map((g) => g.id))]);
  }
  for (const id of unique) {
    if (!out.has(id)) out.set(id, [id]);
  }
  return out;
}

export async function allRelatedTeamIds(teamIds: string[]): Promise<string[]> {
  const map = await relatedTeamIdsBySource(teamIds);
  return [...new Set([...map.values()].flat())];
}

export async function resolveCanonicalTeam(
  teamId: string | null | undefined,
): Promise<TeamAliasRow | null> {
  if (!teamId) return null;
  const db = getDb();
  const [row] = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!row) return null;
  const siblings = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug })
    .from(teams)
    .where(eq(teams.name, row.name));
  if (siblings.length <= 1) return row;
  const canonical = pickCanonicalTeamIdByName(siblings);
  const preferred = canonical.get(row.name.trim().toLowerCase());
  if (!preferred) return row;
  return siblings.find((s) => s.id === preferred.id) ?? row;
}
