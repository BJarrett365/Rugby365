import { eq, gte, lte, and, desc } from "drizzle-orm";
import { fixtures, playerExternalMatches, players, teams } from "@rugby365/db";
import {
  cmsPlayerSlugToRugbyPassSlug,
  parseRugbyPassPlayerProfile,
  parseRugbyPassPlayerSlug,
  rugbyPassPlayerSlugCandidates,
  rugbyPassPlayerUrl,
  type RugbyPassPlayerProfile,
} from "@rugby365/import-sdk";
import { getDb } from "./db";
import { resolvePlayer, resolveTeam } from "./entity-resolve-service";
import { normalizeTeamName } from "./entity-normalize";
import {
  enrichmentFieldsUpdated,
  mergeRugbyPassEnrichment,
  namesLikelyMatch,
} from "./player-profile-enrichment-service";
import { canonicalPremiershipTeamName } from "./transfer-match-service";

export type RugbyPassPlayerImportResult = {
  enriched: boolean;
  playerId: string;
  sourceUrl?: string;
  fieldsUpdated?: string[];
  matchesImported?: number;
  matchesLinked?: number;
  reason?: string;
};

const RUGBYPASS_PROVIDER = "rugbypass";

function canonicalTeamKey(name: string): string {
  return canonicalPremiershipTeamName(normalizeTeamName(name)).toLowerCase();
}

function teamsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  if (!left || !right) return false;
  const a = canonicalTeamKey(left);
  const b = canonicalTeamKey(right);
  return a === b || a.includes(b) || b.includes(a);
}

async function fetchRugbyPassHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Rugby365Bot/1.0 (+https://rugby365.com)",
      Accept: "text/html",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`RugbyPass fetch failed (${res.status})`);
  return res.text();
}

async function fetchRugbyPassHtmlWithFallback(
  url: string,
  externalProviderId?: string | null,
): Promise<{ html: string; url: string }> {
  const slug = parseRugbyPassPlayerSlug(url);
  const urls = slug
    ? rugbyPassPlayerSlugCandidates(slug, externalProviderId).map(rugbyPassPlayerUrl)
    : [url];

  let lastError: Error | null = null;
  for (const tryUrl of urls) {
    try {
      const html = await fetchRugbyPassHtml(tryUrl);
      return { html, url: tryUrl };
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      lastError = err;
      if (!err.message.includes("404")) throw err;
    }
  }
  throw lastError ?? new Error("RugbyPass fetch failed");
}

async function findPlayerByRugbyPassIdentity(profile: RugbyPassPlayerProfile) {
  const db = getDb();
  if (profile.rugbypassPlayerId) {
    const [byId] = await db
      .select()
      .from(players)
      .where(eq(players.rugbypassPlayerId, profile.rugbypassPlayerId))
      .limit(1);
    if (byId) return byId;
  }
  const [bySlug] = await db
    .select()
    .from(players)
    .where(eq(players.rugbypassSlug, profile.slug))
    .limit(1);
  return bySlug ?? null;
}

async function resolveFixtureForMatch(
  input: {
    kickoffAt: Date;
    matchTitle: string;
    teamName: string;
    opponentName: string;
    competitionName: string;
  },
  teamById: Record<string, string>,
) {
  const db = getDb();
  const dayStart = new Date(input.kickoffAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(input.kickoffAt);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const rows = await db
    .select()
    .from(fixtures)
    .where(and(gte(fixtures.kickoffAt, dayStart), lte(fixtures.kickoffAt, dayEnd)));

  for (const row of rows) {
    const home = row.homeTeamId ? teamById[row.homeTeamId] : null;
    const away = row.awayTeamId ? teamById[row.awayTeamId] : null;
    if (!home || !away) continue;
    const titleMatches =
      (teamsMatch(home, input.teamName) && teamsMatch(away, input.opponentName)) ||
      (teamsMatch(home, input.opponentName) && teamsMatch(away, input.teamName));
    if (!titleMatches) continue;
    if (
      input.competitionName &&
      row.competitionName &&
      !row.competitionName.toLowerCase().includes(input.competitionName.toLowerCase().slice(0, 8))
    ) {
      continue;
    }
    return row.id;
  }
  return null;
}

async function upsertExternalMatches(
  playerId: string,
  profile: RugbyPassPlayerProfile,
): Promise<{ imported: number; linked: number }> {
  const db = getDb();
  let imported = 0;
  let linked = 0;
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);
  const teamById = Object.fromEntries(allTeams.map((t) => [t.id, t.name]));

  for (const match of profile.recentMatches) {
    const kickoffAt = new Date(match.kickoffAt);
    const fixtureId = await resolveFixtureForMatch(
      {
        kickoffAt,
        matchTitle: match.matchTitle,
        teamName: match.teamName,
        opponentName: match.opponentName,
        competitionName: match.competitionName,
      },
      teamById,
    );
    if (fixtureId) linked += 1;

    const [existing] = await db
      .select({ id: playerExternalMatches.id })
      .from(playerExternalMatches)
      .where(eq(playerExternalMatches.importKey, match.importKey))
      .limit(1);

    const values = {
      playerId,
      sourceProvider: RUGBYPASS_PROVIDER,
      importKey: match.importKey,
      fixtureId,
      competitionName: match.competitionName || null,
      seasonLabel: match.seasonLabel || null,
      teamName: match.teamName || null,
      opponentName: match.opponentName || null,
      matchTitle: match.matchTitle,
      kickoffAt,
      squadRole: match.squadRole,
      minutesPlayed: match.minutesPlayed,
      tries: match.tries,
      points: match.points,
      conversions: match.conversions,
      stats: match.stats,
      sourceUrl: profile.sourceUrl,
      syncedAt: new Date(),
    };

    if (existing) {
      await db
        .update(playerExternalMatches)
        .set(values)
        .where(eq(playerExternalMatches.id, existing.id));
    } else {
      await db.insert(playerExternalMatches).values(values);
      imported += 1;
    }
  }

  return { imported, linked };
}

export type RugbyPassEnrichOptions = {
  /** Skip recent-match import (faster profile-only backfill). */
  skipMatches?: boolean;
};

async function applyRugbyPassProfile(
  playerId: string,
  profile: RugbyPassPlayerProfile,
  options: RugbyPassEnrichOptions = {},
) {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) throw new Error("Player not found");

  if (!namesLikelyMatch(player.name, profile.displayName)) {
    throw new Error("RugbyPass profile name does not match this player");
  }

  const patch = mergeRugbyPassEnrichment(player, profile);
  const fieldsUpdated = enrichmentFieldsUpdated(player, patch);

  let clubTeamId = player.clubTeamId;
  if (!clubTeamId && patch.clubName) {
    const club = await resolveTeam({ name: patch.clubName, createIfMissing: false });
    clubTeamId = club?.id ?? null;
  }

  await db
    .update(players)
    .set({
      ...patch,
      ...(clubTeamId && !player.clubTeamId ? { clubTeamId } : {}),
    })
    .where(eq(players.id, playerId));

  if (options.skipMatches) {
    return { fieldsUpdated, imported: 0, linked: 0 };
  }

  const matchResult = await upsertExternalMatches(playerId, profile);
  return { fieldsUpdated, ...matchResult };
}

export async function enrichPlayerFromRugbyPass(
  playerId: string,
  sourceUrl?: string,
  options: RugbyPassEnrichOptions = {},
): Promise<RugbyPassPlayerImportResult> {
  let url: string | undefined;
  try {
    const db = getDb();
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    if (!player) return { enriched: false, playerId, reason: "player_not_found" };

    const derivedSlug = player.slug
      ? cmsPlayerSlugToRugbyPassSlug(player.slug, player.externalProviderId)
      : null;
    const slug =
      (sourceUrl ? parseRugbyPassPlayerSlug(sourceUrl) : null) ??
      player.rugbypassSlug ??
      derivedSlug;
    url =
      sourceUrl ??
      player.rugbypassUrl ??
      (slug ? rugbyPassPlayerUrl(slug) : undefined);

    if (!url) {
      return { enriched: false, playerId, reason: "missing_rugbypass_url" };
    }

    const { html, url: resolvedUrl } = await fetchRugbyPassHtmlWithFallback(
      url,
      player.externalProviderId,
    );
    const profile = parseRugbyPassPlayerProfile(html, resolvedUrl);
    if (!profile) return { enriched: false, playerId, reason: "parse_failed" };

    const existing = await findPlayerByRugbyPassIdentity(profile);
    if (existing && existing.id !== playerId) {
      return { enriched: false, playerId, reason: "rugbypass_identity_already_linked" };
    }

    const result = await applyRugbyPassProfile(playerId, profile, options);
    return {
      enriched: true,
      playerId,
      sourceUrl: profile.sourceUrl,
      fieldsUpdated: result.fieldsUpdated,
      matchesImported: result.imported,
      matchesLinked: result.linked,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cause =
      error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
    const combined = `${message} ${cause}`;
    if (combined.includes("404") || combined.includes("fetch failed")) {
      return { enriched: false, playerId, reason: "not_found_on_rugbypass", sourceUrl: url };
    }
    if (combined.includes("does not match")) {
      return { enriched: false, playerId, reason: "name_mismatch", sourceUrl: url };
    }
    if (
      combined.includes("ENOTFOUND") ||
      combined.includes("ECONNRESET") ||
      combined.includes("ETIMEDOUT") ||
      combined.includes("connect") ||
      combined.includes("Failed query")
    ) {
      return { enriched: false, playerId, reason: "transient_db_error", sourceUrl: url };
    }
    return { enriched: false, playerId, reason: message.slice(0, 200), sourceUrl: url };
  }
}

export async function importRugbyPassPlayerByUrl(
  sourceUrl: string,
  linkPlayerId?: string,
): Promise<RugbyPassPlayerImportResult & { created?: boolean }> {
  const slug = parseRugbyPassPlayerSlug(sourceUrl);
  if (!slug) throw new Error("Invalid RugbyPass player URL");

  const { html, url: resolvedUrl } = await fetchRugbyPassHtmlWithFallback(sourceUrl);
  const profile = parseRugbyPassPlayerProfile(html, resolvedUrl);
  if (!profile) throw new Error("Could not parse RugbyPass player profile");

  const db = getDb();
  let player: (typeof players.$inferSelect) | null = null;

  if (linkPlayerId != null) {
    player = (await db.select().from(players).where(eq(players.id, linkPlayerId)).limit(1))[0] ?? null;
  } else {
    player = await findPlayerByRugbyPassIdentity(profile);
  }

  if (!player) {
    player = await resolvePlayer({
      name: profile.displayName,
      positionName: profile.position ?? undefined,
      clubName: profile.currentTeam ?? undefined,
      countryName: profile.nationality ?? undefined,
      createIfMissing: false,
    });
  }

  if (!player) {
    const created = await resolvePlayer({
      name: profile.displayName,
      positionName: profile.position ?? undefined,
      clubName: profile.currentTeam ?? undefined,
      countryName: profile.nationality ?? undefined,
      createIfMissing: true,
      sourceProvider: RUGBYPASS_PROVIDER,
    });
    if (!created) throw new Error("Failed to create player");
    player = created;
    const result = await applyRugbyPassProfile(player.id, profile);
    return {
      enriched: true,
      playerId: player.id,
      created: true,
      sourceUrl: profile.sourceUrl,
      fieldsUpdated: result.fieldsUpdated,
      matchesImported: result.imported,
      matchesLinked: result.linked,
    };
  }

  const result = await applyRugbyPassProfile(player.id, profile);
  return {
    enriched: true,
    playerId: player.id,
    created: false,
    sourceUrl: profile.sourceUrl,
    fieldsUpdated: result.fieldsUpdated,
    matchesImported: result.imported,
    matchesLinked: result.linked,
  };
}

export async function getPlayerExternalMatches(playerId: string) {
  const db = getDb();
  return db
    .select()
    .from(playerExternalMatches)
    .where(eq(playerExternalMatches.playerId, playerId))
    .orderBy(desc(playerExternalMatches.kickoffAt));
}

export async function findConflictingRugbyPassPlayer(
  profile: Pick<RugbyPassPlayerProfile, "slug" | "rugbypassPlayerId" | "displayName">,
  excludePlayerId?: string,
) {
  const db = getDb();
  const rows = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(
      profile.rugbypassPlayerId
        ? eq(players.rugbypassPlayerId, profile.rugbypassPlayerId)
        : eq(players.rugbypassSlug, profile.slug),
    );
  return rows.find((row) => row.id !== excludePlayerId) ?? null;
}

export type RugbyPassPlayerPreview = {
  slug: string;
  sourceUrl: string;
  displayName: string;
  nationality: string | null;
  age: number | null;
  birthDate: string | null;
  position: string | null;
  heightCm: number | null;
  weightKg: number | null;
  currentTeam: string | null;
  imageUrl: string | null;
  rugbypassPlayerId: string | null;
  seasonStatCount: number;
  recentMatchCount: number;
  recentMatches: RugbyPassPlayerProfile["recentMatches"];
  seasonStats: RugbyPassPlayerProfile["seasonStats"];
  existingPlayer: { id: string; name: string } | null;
  conflict: { id: string; name: string } | null;
};

export async function previewRugbyPassPlayer(sourceUrl: string): Promise<RugbyPassPlayerPreview> {
  const slug = parseRugbyPassPlayerSlug(sourceUrl);
  if (!slug) throw new Error("Invalid RugbyPass player URL");

  const normalizedUrl = sourceUrl.includes("rugbypass.com")
    ? sourceUrl.trim()
    : rugbyPassPlayerUrl(slug);

  const { html, url: resolvedUrl } = await fetchRugbyPassHtmlWithFallback(normalizedUrl);
  const profile = parseRugbyPassPlayerProfile(html, resolvedUrl);
  if (!profile) throw new Error("Could not parse RugbyPass player profile");

  const [existing, conflict] = await Promise.all([
    findPlayerByRugbyPassIdentity(profile),
    findConflictingRugbyPassPlayer(profile),
  ]);

  return {
    slug: profile.slug,
    sourceUrl: profile.sourceUrl,
    displayName: profile.displayName,
    nationality: profile.nationality,
    age: profile.age,
    birthDate: profile.birthDate,
    position: profile.position,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    currentTeam: profile.currentTeam,
    imageUrl: profile.imageUrl,
    rugbypassPlayerId: profile.rugbypassPlayerId,
    seasonStatCount: profile.seasonStats.length,
    recentMatchCount: profile.recentMatches.length,
    recentMatches: profile.recentMatches.slice(0, 8),
    seasonStats: profile.seasonStats.slice(0, 6),
    existingPlayer: existing ? { id: existing.id, name: existing.name } : null,
    conflict,
  };
}
