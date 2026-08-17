/**
 * Merge orphan / "Unknown team …" CMS placeholders onto canonical club rows.
 * Identity is inferred by voting on each orphan's fixture-slug side tokens.
 */
import { sql } from "drizzle-orm";
import { teams } from "@rugby365/db";
import { getDb } from "./db";
import { mergeTeamRecords } from "./entity-dedup-service";
import { teamDedupKey } from "./entity-normalize";
import {
  cleanFixtureSlugSideToken,
  displayNameFromFixtureSlugToken,
  isUnknownStandingsTeamName,
  pickCanonicalTeamIdByName,
} from "./table-lab/standings-fixture-dedupe";

export type OrphanTeamVote = {
  orphanId: string;
  label: string;
  votes: number;
  totalVotes: number;
  canonicalId: string | null;
  canonicalName: string | null;
};

function scoreLabelConfidence(topVotes: number, totalVotes: number, runnerUpVotes: number): boolean {
  if (topVotes < 1 || totalVotes < 1) return false;
  // Require a clear majority so mixed/mis-slugged orphans are skipped.
  if (topVotes / totalVotes < 0.6) return false;
  if (runnerUpVotes > 0 && topVotes < runnerUpVotes * 2) return false;
  return true;
}

export async function inferOrphanClubVotes(): Promise<OrphanTeamVote[]> {
  const db = getDb();
  const rows = await db.execute<{
    team_id: string;
    fixture_slug: string;
    home_team_id: string | null;
    away_team_id: string | null;
  }>(sql`
    SELECT t.id AS team_id, f.slug AS fixture_slug,
           f.home_team_id, f.away_team_id
    FROM teams t
    JOIN fixtures f
      ON f.home_team_id = t.id OR f.away_team_id = t.id
    WHERE t.name ILIKE 'Unknown team%' OR t.slug LIKE 'orphan-%'
  `);

  const votes = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const base = (row.fixture_slug ?? "").split("__legacy__")[0] ?? "";
    const withoutDate = base.replace(/-\d{4}-\d{2}-\d{2}$/, "");
    const parts = withoutDate.split("-v-");
    if (parts.length !== 2) continue;
    const side = row.home_team_id === row.team_id ? 0 : row.away_team_id === row.team_id ? 1 : -1;
    if (side < 0) continue;
    const label = displayNameFromFixtureSlugToken(
      (parts[side] ?? "").replace(/\bwrmru\d+\b/gi, " "),
    );
    if (!label || isUnknownStandingsTeamName(label)) continue;
    const byLabel = votes.get(row.team_id) ?? new Map<string, number>();
    byLabel.set(label, (byLabel.get(label) ?? 0) + 1);
    votes.set(row.team_id, byLabel);
  }

  const allTeams = await db.select().from(teams);
  const canonicalByName = pickCanonicalTeamIdByName(
    allTeams
      .filter((row) => !isUnknownStandingsTeamName(row.name))
      .map((row) => ({ id: row.id, name: row.name, slug: row.slug })),
  );

  const bySlug = new Map<string, { id: string; name: string }>();
  const byDedup = new Map<string, { id: string; name: string; score: number }>();
  for (const row of allTeams) {
    if (isUnknownStandingsTeamName(row.name)) continue;
    const slugBase = cleanFixtureSlugSideToken(row.slug.split("__legacy__")[0] ?? row.slug);
    if (slugBase && !bySlug.has(slugBase)) {
      bySlug.set(slugBase, { id: row.id, name: row.name });
    }
    const key = teamDedupKey(row.name);
    let score = 0;
    if (!row.slug.includes("__legacy__")) score += 20;
    if (row.slug.length <= 40) score += 5;
    if (row.name.trim().toLowerCase() === displayNameFromFixtureSlugToken(slugBase).toLowerCase()) {
      score += 15;
    }
    const existing = byDedup.get(key);
    if (!existing || score > existing.score || (score === existing.score && row.id < existing.id)) {
      byDedup.set(key, { id: row.id, name: row.name, score });
    }
  }

  const resolved: OrphanTeamVote[] = [];
  for (const [orphanId, byLabel] of votes) {
    const ranked = [...byLabel.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const top = ranked[0];
    if (!top) continue;
    const totalVotes = ranked.reduce((sum, [, n]) => sum + n, 0);
    const runnerUp = ranked[1]?.[1] ?? 0;
    if (!scoreLabelConfidence(top[1], totalVotes, runnerUp)) {
      resolved.push({
        orphanId,
        label: top[0],
        votes: top[1],
        totalVotes,
        canonicalId: null,
        canonicalName: null,
      });
      continue;
    }

    const label = top[0];
    const slugKey = cleanFixtureSlugSideToken(label.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    const canonical =
      canonicalByName.get(label.toLowerCase()) ??
      bySlug.get(slugKey) ??
      (() => {
        const hit = byDedup.get(teamDedupKey(label));
        return hit ? { id: hit.id, name: hit.name } : null;
      })();

    resolved.push({
      orphanId,
      label,
      votes: top[1],
      totalVotes,
      canonicalId: canonical && canonical.id !== orphanId ? canonical.id : null,
      canonicalName: canonical && canonical.id !== orphanId ? canonical.name : null,
    });
  }

  return resolved;
}

export async function repairOrphanTeams(options: { dryRun?: boolean } = {}) {
  const dryRun = options.dryRun === true;
  const votes = await inferOrphanClubVotes();
  const mergePlan = new Map<string, Set<string>>();
  const skipped: OrphanTeamVote[] = [];
  const planned: OrphanTeamVote[] = [];

  for (const vote of votes) {
    if (!vote.canonicalId) {
      skipped.push(vote);
      continue;
    }
    planned.push(vote);
    const set = mergePlan.get(vote.canonicalId) ?? new Set<string>();
    set.add(vote.orphanId);
    mergePlan.set(vote.canonicalId, set);
  }

  let teamsMerged = 0;
  if (!dryRun) {
    for (const [canonicalId, dupes] of mergePlan) {
      const ids = [...dupes].filter((id) => id !== canonicalId);
      if (!ids.length) continue;
      await mergeTeamRecords(canonicalId, ids);
      teamsMerged += ids.length;
    }
  } else {
    teamsMerged = planned.length;
  }

  return {
    dryRun,
    orphanVotes: votes.length,
    mergeable: planned.length,
    skipped: skipped.length,
    teamsMerged,
    planned: planned.map((row) => ({
      orphanId: row.orphanId,
      label: row.label,
      votes: row.votes,
      canonicalId: row.canonicalId,
      canonicalName: row.canonicalName,
    })),
    skippedSamples: skipped.slice(0, 25).map((row) => ({
      orphanId: row.orphanId,
      label: row.label,
      votes: row.votes,
      totalVotes: row.totalVotes,
    })),
  };
}
