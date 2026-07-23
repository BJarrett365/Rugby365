import { eq } from "drizzle-orm";
import { competitions } from "@rugby365/db";
import type { SdmsFixtureRow, SdmsMatchDetail } from "@rugby365/import-sdk";
import {
  createCompetition,
  getCompetitionBySlug,
  updateCompetition,
  upsertSeason,
} from "./competition-admin-service";
import { getDb } from "./db";
import { findFixtureBySdmsMatchId, getFixtureById, normalizeSlug } from "./fixture-admin-service";
import { upsertSdmsFixtureRow } from "./planet-rugby-import-service";
import { resolveCompetition, SDMS_PROVIDER } from "./entity-resolve-service";
import { competitionTypeFromPresetSlug } from "./planet-rugby-import-presets";
import { syncSdmsMatchEntityLinks } from "./match-entity-sync-service";

type CompetitionRef = {
  id: string;
  name: string;
  planetRugbySlug: string | null;
  sdmsCompCode: string | null;
};

function competitionSlugFromName(name: string): string {
  return normalizeSlug(name);
}

function seasonLabelFromDate(date: string): string {
  return date.slice(0, 4);
}

export async function ensureCompetitionForSdms(input: {
  competitionId?: string | number | null;
  competitionName: string;
  matchDate?: string;
}): Promise<CompetitionRef> {
  const extId = input.competitionId != null ? String(input.competitionId).trim() : "";
  const name = input.competitionName.trim();
  const slug = competitionSlugFromName(name);
  const db = getDb();

  if (extId) {
    const [byExt] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.externalProviderId, extId))
      .limit(1);
    if (byExt) {
      await patchCompetitionSdmsFields(byExt.id, extId, slug);
      return toCompetitionRef(byExt, extId, slug);
    }

    const [bySdms] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.sdmsCompCode, extId))
      .limit(1);
    if (bySdms) {
      await patchCompetitionSdmsFields(bySdms.id, extId, slug);
      return toCompetitionRef(bySdms, extId, slug);
    }
  }

  const bySlug = await getCompetitionBySlug(slug);
  if (bySlug) {
    await patchCompetitionSdmsFields(bySlug.id, extId || null, slug);
    if (input.matchDate) {
      await upsertSeason({
        competitionId: bySlug.id,
        label: seasonLabelFromDate(input.matchDate),
        isActive: true,
      });
    }
    return toCompetitionRef(bySlug, extId || bySlug.sdmsCompCode, slug);
  }

  const resolved = await resolveCompetition({
    name,
    externalProviderId: extId || undefined,
    sourceProvider: SDMS_PROVIDER,
    createIfMissing: true,
  });

  if (resolved) {
    const updated = await updateCompetition(resolved.id, {
      sdmsCompCode: extId || resolved.sdmsCompCode,
      planetRugbySlug: slug,
      competitionType: competitionTypeFromPresetSlug(slug),
    });
    if (input.matchDate) {
      await upsertSeason({
        competitionId: updated.id,
        label: seasonLabelFromDate(input.matchDate),
        isActive: true,
      });
    }
    return toCompetitionRef(updated, extId || updated.sdmsCompCode, slug);
  }

  const created = await createCompetition({
    name,
    slug,
    sdmsCompCode: extId || undefined,
    planetRugbySlug: slug,
    competitionType: competitionTypeFromPresetSlug(slug),
  });

  if (extId) {
    await db
      .update(competitions)
      .set({ externalProviderId: extId, sourceProvider: SDMS_PROVIDER })
      .where(eq(competitions.id, created.id));
  }

  if (input.matchDate) {
    await upsertSeason({
      competitionId: created.id,
      label: seasonLabelFromDate(input.matchDate),
      isActive: true,
    });
  }

  return toCompetitionRef(created, extId || created.sdmsCompCode, slug);
}

async function patchCompetitionSdmsFields(
  competitionId: string,
  extId: string | null,
  slug: string,
): Promise<void> {
  const db = getDb();
  const [row] = await db.select().from(competitions).where(eq(competitions.id, competitionId)).limit(1);
  if (!row) return;

  const patch: Record<string, string | null> = {};
  if (extId && !row.sdmsCompCode) patch.sdmsCompCode = extId;
  if (extId && !row.externalProviderId) patch.externalProviderId = extId;
  if (!row.planetRugbySlug) patch.planetRugbySlug = slug;
  if (Object.keys(patch).length === 0) return;

  await db.update(competitions).set(patch).where(eq(competitions.id, competitionId));
}

function toCompetitionRef(
  row: typeof competitions.$inferSelect,
  sdmsCode: string | null,
  slug: string,
): CompetitionRef {
  return {
    id: row.id,
    name: row.name,
    planetRugbySlug: row.planetRugbySlug ?? slug,
    sdmsCompCode: row.sdmsCompCode ?? sdmsCode,
  };
}

export function sdmsMatchDetailToFixtureRow(detail: SdmsMatchDetail): SdmsFixtureRow {
  return {
    match_id: detail.match_id,
    date: detail.date,
    time: detail.time,
    status: detail.status,
    home_team_name: detail.home_team_name,
    away_team_name: detail.away_team_name,
    home_team_slug: detail.home_team_slug,
    away_team_slug: detail.away_team_slug,
    home_team_id: detail.home_team_id,
    away_team_id: detail.away_team_id,
    home_team_score: detail.home_team_score,
    away_team_score: detail.away_team_score,
    round: detail.round,
    venue: detail.venue_name,
    competition_id: detail.competition_id != null ? String(detail.competition_id) : undefined,
    competition_name: detail.competition_name,
  };
}

/** Create or update CMS fixture shell (teams, competition, scores) from SDMS row. */
export async function autoImportSdmsFixtureRow(row: SdmsFixtureRow): Promise<string | null> {
  const competition = await ensureCompetitionForSdms({
    competitionId: row.competition_id,
    competitionName: row.competition_name ?? "Competition",
    matchDate: row.date,
  });

  const result = await upsertSdmsFixtureRow(row, competition);
  return result.fixtureId ?? null;
}

/** Import many SDMS rows into CMS (fixtures + teams + competitions). */
export async function autoImportSdmsFixtureRows(rows: SdmsFixtureRow[]): Promise<number> {
  let imported = 0;
  for (const row of rows) {
    try {
      const fixtureId = await autoImportSdmsFixtureRow(row);
      if (fixtureId) imported += 1;
    } catch (error) {
      console.warn(
        `[sdms-auto-import] skipped ${row.match_id} (${row.home_team_name} v ${row.away_team_name}):`,
        error instanceof Error ? error.message : error,
      );
    }
  }
  return imported;
}

/** Full CMS import: fixture + squads + events + stats from SDMS match detail. */
export async function autoImportSdmsMatchToCms(
  matchId: string,
  detail: SdmsMatchDetail,
): Promise<{ fixtureId: string; created: boolean; enriched: boolean }> {
  const sdmsId = (detail.match_id || matchId).trim();
  let existing = await findFixtureBySdmsMatchId(sdmsId);
  let created = false;

  if (!existing) {
    const fixtureId = await autoImportSdmsFixtureRow(sdmsMatchDetailToFixtureRow(detail));
    if (!fixtureId) {
      throw new Error(`Failed to auto-import fixture for SDMS match ${sdmsId}`);
    }
    existing =
      (await findFixtureBySdmsMatchId(sdmsId)) ??
      (await getFixtureById(fixtureId)) ??
      null;
    created = true;
  }

  if (!existing) {
    throw new Error(`Fixture missing after auto-import for ${sdmsId}`);
  }

  const sync = await syncSdmsMatchEntityLinks(existing.id, sdmsId, { force: created });
  return { fixtureId: existing.id, created, enriched: created || sync.synced };
}
