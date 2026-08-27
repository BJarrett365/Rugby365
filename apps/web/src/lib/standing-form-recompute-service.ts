/**
 * Recompute `standing_rows.form` (W/D/L) from finished fixtures in the same season.
 * Prefer SDMS `last_five` when present; use this to fill gaps and after Wikipedia table imports.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { competitionSeasons, competitions, fixtures, standingRows, teams } from "@rugby365/db";
import { getDb } from "./db";
import { stripTeamSponsorAndSeasonLabels } from "./entity-normalize";
import {
  computeFormSequenceFromFixtures,
  isPlaceholderAllDrawForm,
  parseStandingForm,
  standingFormNeedsRecompute,
} from "./standing-form";

const FINISHED_STATUSES = ["full_time", "result", "complete", "finished"] as const;

const TEAM_ALIASES: Record<string, string[]> = {
  "united states": ["usa", "us", "united states of america"],
  usa: ["united states", "us", "united states of america"],
  "hong kong": ["hong kong china", "hong kong, china"],
  "hong kong china": ["hong kong"],
  "cardiff blues": ["cardiff", "cardiff rugby"],
  "cardiff rugby": ["cardiff", "cardiff blues"],
  cardiff: ["cardiff blues", "cardiff rugby"],
  "benetton treviso": ["benetton", "benetton rugby"],
  benetton: ["benetton treviso", "benetton rugby"],
  "newport gwent dragons": ["dragons", "dragons rfc"],
  dragons: ["newport gwent dragons", "dragons rfc"],
  ospreys: ["ospreys rfc"],
  biarritz: ["biarritz olympique"],
  "biarritz olympique": ["biarritz"],
  castres: ["castres olympique"],
  "castres olympique": ["castres"],
  harlequins: ["nec harlequins", "harlequin football club", "london harlequins"],
  "nec harlequins": ["harlequins"],
  "bristol bears": ["bristol", "bristol shoguns", "bristol rugby"],
  "bristol shoguns": ["bristol bears", "bristol"],
  bristol: ["bristol bears", "bristol shoguns"],
  stormers: ["dhl stormers", "dhl stormers xxiii"],
  "dhl stormers": ["stormers", "dhl stormers xxiii"],
  "dhl stormers xxiii": ["stormers", "dhl stormers"],
  lions: ["emirates lions", "golden lions"],
  "racing 92": ["racing metro", "racing metro 92"],
  cheetahs: ["toyota cheetahs", "free state cheetahs"],
  batumi: ["rc batumi", "batumi rc"],
  "rc batumi": ["batumi", "batumi rc"],
  "batumi rc": ["batumi", "rc batumi"],
  "aia kutaisi": ["kutaisi", "ares kutaisi"],
  "kharebi rustavi": ["rustavi kharebi", "rc rustavi"],
  "rustavi kharebi": ["kharebi rustavi", "rc rustavi"],
  "rc kochebi": ["kochebi bolnisi", "kochebi"],
  "kochebi bolnisi": ["rc kochebi", "kochebi"],
  "rc armia": ["army tbilisi", "armia"],
  "army tbilisi": ["rc armia", "armia"],
};

/** Normalize standing/fixture team labels for alias matching. */
function formMatchKey(name: string): string {
  return stripTeamSponsorAndSeasonLabels(name)
    .replace(/\s*\[\d+\]\s*$/g, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type RecomputeStandingFormOptions = {
  /** Recompute even when existing form looks healthy. */
  force?: boolean;
  /** Limit to one competition. */
  competitionId?: string;
  /** Limit to one season. */
  seasonId?: string;
  /** Only active seasons (default true when no seasonId). */
  activeOnly?: boolean;
};

export type RecomputeStandingFormResult = {
  seasonsProcessed: number;
  rowsUpdated: number;
  rowsCleared: number;
  rowsSkipped: number;
};

type ScoredFixture = {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  kickoffAt: Date | string | null;
};

/** Collapse USA/United States (etc.) alias doubles that share score within 3 days. */
function dedupeAliasFixtures(
  rows: Array<{
    teamId: string;
    homeTeamId: string;
    awayTeamId: string;
    homeScore: number | null;
    awayScore: number | null;
    kickoffAt: Date | string | null;
  }>,
) {
  const sorted = [...rows].sort((a, b) => {
    const aMs = a.kickoffAt ? new Date(a.kickoffAt).getTime() : 0;
    const bMs = b.kickoffAt ? new Date(b.kickoffAt).getTime() : 0;
    return aMs - bMs;
  });
  const kept: typeof sorted = [];
  for (const row of sorted) {
    const dayMs = row.kickoffAt ? new Date(row.kickoffAt).getTime() : 0;
    const isHome = row.homeTeamId === row.teamId;
    const duplicate = kept.some((existing) => {
      if (existing.homeScore !== row.homeScore || existing.awayScore !== row.awayScore) return false;
      if ((existing.homeTeamId === existing.teamId) !== isHome) return false;
      const existingMs = existing.kickoffAt ? new Date(existing.kickoffAt).getTime() : 0;
      return Math.abs(existingMs - dayMs) <= 3 * 24 * 60 * 60 * 1000;
    });
    if (!duplicate) kept.push(row);
  }
  return kept;
}

async function loadScoredFixtures(seasonId: string): Promise<ScoredFixture[]> {
  const db = getDb();
  const finished = await db
    .select({
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      kickoffAt: fixtures.kickoffAt,
      status: fixtures.status,
    })
    .from(fixtures)
    .where(eq(fixtures.seasonId, seasonId));

  const scored = finished.filter(
    (f) =>
      f.homeTeamId &&
      f.awayTeamId &&
      f.homeScore != null &&
      f.awayScore != null &&
      !(f.homeScore === 0 && f.awayScore === 0) &&
      FINISHED_STATUSES.includes(f.status as (typeof FINISHED_STATUSES)[number]),
  );

  const rows =
    scored.length > 0
      ? scored
      : finished.filter(
          (f) =>
            f.homeTeamId &&
            f.awayTeamId &&
            f.homeScore != null &&
            f.awayScore != null &&
            !(f.homeScore === 0 && f.awayScore === 0),
        );

  return rows.map((f) => ({
    homeTeamId: f.homeTeamId!,
    awayTeamId: f.awayTeamId!,
    homeScore: f.homeScore!,
    awayScore: f.awayScore!,
    kickoffAt: f.kickoffAt,
  }));
}

function rowNeedsRecompute(
  form: string | null,
  played: number,
  force: boolean,
): boolean {
  if (force) return true;
  if (standingFormNeedsRecompute(form)) return true;
  const letters = (parseStandingForm(form).lastFive ?? "").replace(/-/g, "").length;
  const expected = Math.min(Math.max(played ?? 0, 0), 5);
  if (expected > 0 && letters < expected) return true;
  return isPlaceholderAllDrawForm(parseStandingForm(form).lastFive);
}

export async function recomputeStandingFormForSeason(
  seasonId: string,
  options: { force?: boolean } = {},
): Promise<{ updated: number; cleared: number; skipped: number }> {
  const db = getDb();
  const force = Boolean(options.force);
  const scored = await loadScoredFixtures(seasonId);

  // No real results → clear placeholder all-draw / dash forms so UI does not show fake Ds.
  if (!scored.length) {
    const placeholderRows = await db
      .select({ id: standingRows.id, form: standingRows.form })
      .from(standingRows)
      .where(eq(standingRows.seasonId, seasonId));

    let cleared = 0;
    let skipped = 0;
    for (const row of placeholderRows) {
      if (!row.form) {
        skipped += 1;
        continue;
      }
      const letters = parseStandingForm(row.form).lastFive;
      const shouldClear =
        force ||
        isPlaceholderAllDrawForm(letters) ||
        standingFormNeedsRecompute(row.form) ||
        /^-+$/.test(row.form.trim());
      if (!shouldClear) {
        skipped += 1;
        continue;
      }
      await db.update(standingRows).set({ form: null }).where(eq(standingRows.id, row.id));
      cleared += 1;
    }
    return { updated: 0, cleared, skipped };
  }

  const viewRows = await db
    .selectDistinct({ view: standingRows.view })
    .from(standingRows)
    .where(eq(standingRows.seasonId, seasonId));
  const views = [
    ...new Set(
      viewRows
        .map((row) => row.view)
        .filter((view) => view === "overall" || /^pool_/i.test(view) || /^conference_/i.test(view)),
    ),
  ];
  if (!views.includes("overall")) views.push("overall");

  let updated = 0;
  let cleared = 0;
  let skipped = 0;

  for (const view of views) {
    const result = await recomputeStandingFormForSeasonView(seasonId, view, scored, force);
    updated += result.updated;
    cleared += result.cleared;
    skipped += result.skipped;
  }

  return { updated, cleared, skipped };
}

async function recomputeStandingFormForSeasonView(
  seasonId: string,
  view: string,
  scored: ScoredFixture[],
  force: boolean,
): Promise<{ updated: number; cleared: number; skipped: number }> {
  const db = getDb();

  const rows = await db
    .select({
      id: standingRows.id,
      teamId: standingRows.teamId,
      form: standingRows.form,
      played: standingRows.played,
      teamName: teams.name,
    })
    .from(standingRows)
    .innerJoin(teams, eq(teams.id, standingRows.teamId))
    .where(and(eq(standingRows.seasonId, seasonId), eq(standingRows.view, view)));

  if (!rows.length) return { updated: 0, cleared: 0, skipped: 0 };

  const poolNameKeys = new Set(
    rows.map((row) => formMatchKey(row.teamName)).filter((key) => Boolean(key)),
  );
  const poolMemberIds = new Set(rows.map((row) => row.teamId));

  // Expand pool membership to fixture-side duplicate team rows that share the same name
  // (historic URC imports often left multiple Connacht/Edinburgh IDs).
  if ((/^pool_/i.test(view) || /^conference_/i.test(view)) && scored.length) {
    const fixtureTeamIds = [...new Set(scored.flatMap((f) => [f.homeTeamId, f.awayTeamId]))];
    if (fixtureTeamIds.length) {
      const fixtureTeams = await db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .where(inArray(teams.id, fixtureTeamIds));
      for (const team of fixtureTeams) {
        const key = formMatchKey(team.name);
        if (key && poolNameKeys.has(key)) poolMemberIds.add(team.id);
        for (const alias of TEAM_ALIASES[key] ?? []) {
          if (poolNameKeys.has(formMatchKey(alias))) poolMemberIds.add(team.id);
        }
      }
    }
  }

  // Pool/conference tables should only show form from matches within that group.
  const fixturesForView =
    /^pool_/i.test(view) || /^conference_/i.test(view)
      ? scored.filter((f) => poolMemberIds.has(f.homeTeamId) && poolMemberIds.has(f.awayTeamId))
      : scored;

  if (!fixturesForView.length) return { updated: 0, cleared: 0, skipped: rows.length };

  const teamIdsByName = new Map<string, string[]>();
  const fixtureTeamIds = new Set<string>();
  for (const f of fixturesForView) {
    fixtureTeamIds.add(f.homeTeamId);
    fixtureTeamIds.add(f.awayTeamId);
  }
  if (fixtureTeamIds.size) {
    const names = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(inArray(teams.id, [...fixtureTeamIds]));
    for (const team of names) {
      const key = formMatchKey(team.name);
      if (!key) continue;
      const bucket = teamIdsByName.get(key) ?? [];
      bucket.push(team.id);
      teamIdsByName.set(key, bucket);
    }
  }

  let updated = 0;
  let cleared = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!rowNeedsRecompute(row.form, row.played ?? 0, force)) {
      skipped += 1;
      continue;
    }

    const key = formMatchKey(row.teamName);
    const relatedIds = new Set<string>([row.teamId, ...(teamIdsByName.get(key) ?? [])]);
    for (const alias of TEAM_ALIASES[key] ?? []) {
      for (const id of teamIdsByName.get(formMatchKey(alias)) ?? []) relatedIds.add(id);
    }
    if (key.length >= 4) {
      for (const [fixtureKey, ids] of teamIdsByName) {
        if (fixtureKey === key) continue;
        if (fixtureKey.startsWith(key) || key.startsWith(fixtureKey)) {
          for (const id of ids) relatedIds.add(id);
        }
      }
    }

    const formLimit = 5;
    const form = computeFormSequenceFromFixtures(
      row.teamId,
      dedupeAliasFixtures(
        fixturesForView.flatMap((f) => {
          const homeMatch = relatedIds.has(f.homeTeamId);
          const awayMatch = relatedIds.has(f.awayTeamId);
          if (!homeMatch && !awayMatch) return [];
          return [
            {
              teamId: row.teamId,
              homeTeamId: homeMatch ? row.teamId : f.homeTeamId,
              awayTeamId: awayMatch ? row.teamId : f.awayTeamId,
              homeScore: f.homeScore,
              awayScore: f.awayScore,
              kickoffAt: f.kickoffAt,
            },
          ];
        }),
      ),
      formLimit,
    );

    if (!form) {
      // Clear fake all-draw / dash forms when fixtures cannot produce a sequence.
      if (
        row.form &&
        (force ||
          isPlaceholderAllDrawForm(parseStandingForm(row.form).lastFive) ||
          /^-+$/.test(row.form.trim()) ||
          (/-/.test(row.form) && !row.form.trim().startsWith("{")))
      ) {
        await db.update(standingRows).set({ form: null }).where(eq(standingRows.id, row.id));
        cleared += 1;
      } else if (force && row.form) {
        const existing = parseStandingForm(row.form).lastFive;
        if (existing) {
          const next = existing.slice(-formLimit);
          if (next !== row.form) {
            await db.update(standingRows).set({ form: next }).where(eq(standingRows.id, row.id));
            updated += 1;
          } else {
            skipped += 1;
          }
        } else {
          skipped += 1;
        }
      } else {
        skipped += 1;
      }
      continue;
    }

    await db.update(standingRows).set({ form }).where(eq(standingRows.id, row.id));
    updated += 1;
  }

  return { updated, cleared, skipped };
}

export async function recomputeStandingForms(
  options: RecomputeStandingFormOptions = {},
): Promise<RecomputeStandingFormResult> {
  const db = getDb();
  const force = Boolean(options.force);
  const activeOnly = options.seasonId ? false : options.activeOnly !== false;

  const conditions = [eq(competitionSeasons.isDeprecated, false)];
  if (options.seasonId) conditions.push(eq(competitionSeasons.id, options.seasonId));
  if (options.competitionId) conditions.push(eq(competitionSeasons.competitionId, options.competitionId));
  if (activeOnly) conditions.push(eq(competitionSeasons.isActive, true));

  const seasons = await db
    .select({
      id: competitionSeasons.id,
      label: competitionSeasons.label,
      name: competitions.name,
    })
    .from(competitionSeasons)
    .innerJoin(competitions, eq(competitions.id, competitionSeasons.competitionId))
    .where(and(...conditions));

  // Prefer seasons that already have standing rows.
  const withStandings: typeof seasons = [];
  for (const season of seasons) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(standingRows)
      .where(and(eq(standingRows.seasonId, season.id), eq(standingRows.view, "overall")));
    if (Number(row?.n ?? 0) > 0) withStandings.push(season);
  }

  let rowsUpdated = 0;
  let rowsCleared = 0;
  let rowsSkipped = 0;
  let seasonsProcessed = 0;

  for (const season of withStandings) {
    const result = await recomputeStandingFormForSeason(season.id, { force });
    if (result.updated || result.cleared) {
      seasonsProcessed += 1;
      console.log(
        `  ${season.name} ${season.label}: updated=${result.updated} cleared=${result.cleared} skipped=${result.skipped}`,
      );
    }
    rowsUpdated += result.updated;
    rowsCleared += result.cleared;
    rowsSkipped += result.skipped;
  }

  return { seasonsProcessed, rowsUpdated, rowsCleared, rowsSkipped };
}
