/**
 * Import Ultimate Rugby squad / player pages into players:
 * profile fields, bio, career stints, caps (from bio text), and news links.
 */
import { and, eq } from "drizzle-orm";
import { playerCareerStints, playerSourceNews, players } from "@rugby365/db";
import { getDb } from "./db";
import { resolvePlayer, resolveTeam } from "./entity-resolve-service";
import { namesLikelyMatch } from "./player-profile-enrichment-service";
import {
  ULTIMATE_RUGBY_ORIGIN,
  ULTIMATE_RUGBY_PROVIDER,
  fetchUltimateRugbyHtml,
  fetchUltimateRugbyPlayerByName,
  parseUltimateRugbyNewsHtml,
  parseUltimateRugbyPlayerHtml,
  parseUltimateRugbySquadHtml,
  squadCardToSeedProfile,
  type UltimateRugbyNewsItem,
  type UltimateRugbyPlayerProfile,
  type UltimateRugbySquadCard,
} from "./ultimate-rugby-parse";

type PlayerRow = typeof players.$inferSelect;

export const SOUTH_AFRICA_TEAM_ID = "b0000000-0000-4000-8000-000000000001";
export const SOUTH_AFRICA_SQUAD_PATH = "/south-africa/squad";

export type UltimateRugbyImportOptions = {
  squadPath?: string;
  internationalTeamId?: string;
  countryName?: string;
  /** When true, skip coaching staff listed on the squad page. Default true. */
  playersOnly?: boolean;
  delayMs?: number;
  limit?: number;
  dryRun?: boolean;
  includeCareer?: boolean;
  includeNews?: boolean;
  onProgress?: (message: string) => void;
};

export type UltimateRugbyPlayerImportResult = {
  name: string;
  path: string;
  playerId: string | null;
  created: boolean;
  fieldsUpdated: string[];
  bioChars: number;
  careerStints: number;
  newsItems: number;
  caps: number | null;
  skipped?: string;
  error?: string;
};

export type UltimateRugbySquadImportReport = {
  squadUrl: string;
  cardsFound: number;
  coachesSkipped: number;
  results: UltimateRugbyPlayerImportResult[];
};

export type UltimateRugbyHistoricalImportReport = {
  candidates: number;
  results: UltimateRugbyPlayerImportResult[];
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function birthDateIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function pickFillString(existing: string | null | undefined, incoming: string | null | undefined) {
  if (existing?.trim()) return undefined;
  const next = incoming?.trim();
  return next || undefined;
}

function pickFillNumber(existing: number | null | undefined, incoming: number | null | undefined) {
  if (existing != null && existing > 0) return undefined;
  if (incoming != null && incoming > 0) return incoming;
  return undefined;
}

/** Prefer Ultimate Rugby bio when empty, truncated, or shorter than the scraped bio. */
function pickBio(existing: string | null | undefined, incoming: string | null | undefined) {
  const next = incoming?.trim();
  if (!next) return undefined;
  const current = existing?.trim() ?? "";
  if (!current) return next;
  if (current.length + 40 < next.length) return next;
  if (/[…\u2026]$/.test(current) && next.length > current.length) return next;
  return undefined;
}

export function buildUltimateRugbyEnrichmentPatch(
  existing: PlayerRow,
  profile: UltimateRugbyPlayerProfile,
  opts: { internationalTeamId?: string; countryName?: string },
) {
  const patch: Partial<PlayerRow> = {};

  const birthDate = pickFillString(birthDateIso(existing.birthDate), profile.birthDate);
  if (birthDate) patch.birthDate = birthDate;

  const positionName = pickFillString(existing.positionName, profile.positionName);
  if (positionName) patch.positionName = positionName;

  const heightCm = pickFillNumber(existing.heightCm, profile.heightCm);
  if (heightCm != null) patch.heightCm = heightCm;

  const weightKg = pickFillNumber(existing.weightKg, profile.weightKg);
  if (weightKg != null) patch.weightKg = weightKg;

  const imageUrl = pickFillString(existing.imageUrl, profile.imageUrl);
  if (imageUrl) patch.imageUrl = imageUrl;

  const bioSummary = pickBio(existing.bioSummary, profile.bioSummary);
  if (bioSummary) patch.bioSummary = bioSummary;

  const countryName = pickFillString(existing.countryName, opts.countryName);
  if (countryName) patch.countryName = countryName;

  if (!existing.internationalTeamId && opts.internationalTeamId) {
    patch.internationalTeamId = opts.internationalTeamId;
  }

  const caps = pickFillNumber(existing.verifiedInternationalCaps, profile.internationalCaps);
  if (caps != null) patch.verifiedInternationalCaps = caps;

  const points = pickFillNumber(existing.verifiedInternationalPoints, profile.internationalPoints);
  if (points != null) patch.verifiedInternationalPoints = points;

  // Never overwrite an existing provider id (e.g. SDMS); only claim empty slots.
  if (!existing.externalProviderId && profile.externalProviderId) {
    patch.externalProviderId = profile.externalProviderId;
    patch.sourceProvider = ULTIMATE_RUGBY_PROVIDER;
  }

  // Prefer UR profile as website when blank.
  const social =
    existing.socialAccounts && typeof existing.socialAccounts === "object"
      ? { ...(existing.socialAccounts as Record<string, unknown>) }
      : {};
  if (!social.website && profile.url) {
    patch.socialAccounts = { ...social, website: profile.url };
  }

  return patch;
}

export function enrichmentPatchFields(patch: Partial<PlayerRow>): string[] {
  return Object.keys(patch).filter((key) => patch[key as keyof PlayerRow] !== undefined);
}

async function findPlayerByUltimateRugbyId(externalProviderId: string | null) {
  if (!externalProviderId) return null;
  const db = getDb();
  const [row] = await db
    .select()
    .from(players)
    .where(eq(players.externalProviderId, externalProviderId))
    .limit(1);
  return row ?? null;
}

async function upsertUltimateRugbyCareerStints(
  playerId: string,
  profile: UltimateRugbyPlayerProfile,
  dryRun?: boolean,
): Promise<number> {
  if (!profile.careerStints.length) return 0;
  if (dryRun) return profile.careerStints.length;

  const db = getDb();
  for (const stint of profile.careerStints) {
    const team = await resolveTeam({ name: stint.teamName, createIfMissing: true });
    await db
      .delete(playerCareerStints)
      .where(
        and(
          eq(playerCareerStints.playerId, playerId),
          eq(playerCareerStints.careerType, stint.careerType),
          eq(playerCareerStints.yearsLabel, stint.yearsLabel),
          eq(playerCareerStints.teamName, stint.teamName),
        ),
      );

    const tries =
      stint.careerType === "international" &&
      /south africa$/i.test(stint.teamName) &&
      !/7/i.test(stint.teamName)
        ? profile.internationalTries
        : null;
    const points =
      stint.careerType === "international" &&
      /south africa$/i.test(stint.teamName) &&
      !/7/i.test(stint.teamName)
        ? profile.internationalPoints
        : null;
    const apps =
      stint.careerType === "international" &&
      /south africa$/i.test(stint.teamName) &&
      !/7/i.test(stint.teamName)
        ? profile.internationalCaps
        : null;

    await db.insert(playerCareerStints).values({
      playerId,
      careerType: stint.careerType,
      startYear: stint.startYear,
      endYear: stint.endYear,
      yearsLabel: stint.yearsLabel,
      teamName: stint.teamName,
      teamId: team?.id ?? null,
      apps,
      tries,
      points,
      sortOrder: stint.sortOrder,
      sourceProvider: ULTIMATE_RUGBY_PROVIDER,
      sourceUrl: profile.url,
      syncedAt: new Date(),
    });
  }

  const { syncTransfersFromClubCareerStints } = await import("./career-transfer-sync-service");
  await syncTransfersFromClubCareerStints(playerId);
  return profile.careerStints.length;
}

async function upsertUltimateRugbyNews(
  playerId: string,
  items: UltimateRugbyNewsItem[],
  dryRun?: boolean,
): Promise<number> {
  if (!items.length) return 0;
  if (dryRun) return items.length;
  const db = getDb();
  let written = 0;
  for (const item of items) {
    await db
      .delete(playerSourceNews)
      .where(eq(playerSourceNews.importKey, item.importKey));
    await db.insert(playerSourceNews).values({
      playerId,
      sourceProvider: ULTIMATE_RUGBY_PROVIDER,
      importKey: item.importKey,
      title: item.title,
      url: item.url,
      publishedLabel: item.publishedLabel,
      viewCount: item.viewCount,
      syncedAt: new Date(),
    });
    written += 1;
  }
  return written;
}

async function fetchPlayerProfile(
  card: UltimateRugbySquadCard,
): Promise<UltimateRugbyPlayerProfile> {
  const seed = squadCardToSeedProfile(card);
  try {
    const html = await fetchUltimateRugbyHtml(seed.url);
    const parsed = parseUltimateRugbyPlayerHtml(html, card.path);
    return {
      ...parsed,
      positionName: parsed.positionName ?? seed.positionName,
      birthDate: parsed.birthDate ?? seed.birthDate,
      heightCm: parsed.heightCm ?? seed.heightCm,
      weightKg: parsed.weightKg ?? seed.weightKg,
      imageUrl: parsed.imageUrl ?? seed.imageUrl,
      name: parsed.name || seed.name,
    };
  } catch {
    return seed;
  }
}

export async function importUltimateRugbyPlayerProfile(
  profile: UltimateRugbyPlayerProfile,
  opts: {
    internationalTeamId?: string;
    countryName?: string;
    dryRun?: boolean;
    includeCareer?: boolean;
    includeNews?: boolean;
    newsItems?: UltimateRugbyNewsItem[];
  } = {},
): Promise<UltimateRugbyPlayerImportResult> {
  const includeCareer = opts.includeCareer !== false;
  const includeNews = opts.includeNews !== false;
  const base: UltimateRugbyPlayerImportResult = {
    name: profile.name,
    path: profile.path,
    playerId: null,
    created: false,
    fieldsUpdated: [],
    bioChars: profile.bioSummary?.length ?? 0,
    careerStints: 0,
    newsItems: 0,
    caps: profile.internationalCaps,
  };

  if (!profile.name.trim() || /^ultimate rugby$/i.test(profile.name.trim())) {
    return { ...base, skipped: "missing-name" };
  }

  let existing = await findPlayerByUltimateRugbyId(profile.externalProviderId);
  let created = false;

  if (!existing) {
    const resolved = await resolvePlayer({
      name: profile.name,
      positionName: profile.positionName ?? undefined,
      countryName: opts.countryName,
      internationalTeamId: opts.internationalTeamId,
      createIfMissing: !opts.dryRun,
      skipArchiveEnrich: true,
      sourceProvider: ULTIMATE_RUGBY_PROVIDER,
    });
    if (!resolved) {
      if (opts.dryRun) {
        return {
          ...base,
          created: true,
          fieldsUpdated: ["(would create)"],
          careerStints: profile.careerStints.length,
        };
      }
      return { ...base, skipped: "resolve-failed" };
    }
    if (!namesLikelyMatch(resolved.name, profile.name)) {
      return { ...base, playerId: resolved.id, skipped: "name-mismatch" };
    }
    existing = resolved;
    created = !resolved.bioSummary && !resolved.birthDate && !resolved.externalProviderId;
  }

  const patch = buildUltimateRugbyEnrichmentPatch(existing, profile, {
    internationalTeamId: opts.internationalTeamId,
    countryName: opts.countryName,
  });
  const fieldsUpdated = enrichmentPatchFields(patch);

  if (!opts.dryRun && fieldsUpdated.length) {
    const db = getDb();
    await db.update(players).set(patch).where(eq(players.id, existing.id));
  }

  let careerStints = 0;
  if (includeCareer) {
    careerStints = await upsertUltimateRugbyCareerStints(existing.id, profile, opts.dryRun);
    if (careerStints) fieldsUpdated.push(`career:${careerStints}`);
  }

  let newsItems = 0;
  if (includeNews) {
    const items =
      opts.newsItems ??
      (await (async () => {
        try {
          const newsHtml = await fetchUltimateRugbyHtml(`${profile.url.replace(/\/$/, "")}/news`);
          return parseUltimateRugbyNewsHtml(newsHtml, profile.path);
        } catch {
          return [] as UltimateRugbyNewsItem[];
        }
      })());
    newsItems = await upsertUltimateRugbyNews(existing.id, items, opts.dryRun);
    if (newsItems) fieldsUpdated.push(`news:${newsItems}`);
  }

  return {
    ...base,
    playerId: existing.id,
    created,
    fieldsUpdated: fieldsUpdated.length ? fieldsUpdated : opts.dryRun ? ["(no changes)"] : [],
    careerStints,
    newsItems,
  };
}

export async function importUltimateRugbySquad(
  options: UltimateRugbyImportOptions = {},
): Promise<UltimateRugbySquadImportReport> {
  const squadPath = options.squadPath ?? SOUTH_AFRICA_SQUAD_PATH;
  const squadUrl = squadPath.startsWith("http")
    ? squadPath
    : `${ULTIMATE_RUGBY_ORIGIN}${squadPath.startsWith("/") ? "" : "/"}${squadPath}`;
  const internationalTeamId = options.internationalTeamId ?? SOUTH_AFRICA_TEAM_ID;
  const countryName = options.countryName ?? "South Africa";
  const playersOnly = options.playersOnly !== false;
  const delayMs = options.delayMs ?? 350;
  const log = options.onProgress ?? (() => undefined);

  log(`Fetching squad ${squadUrl}`);
  const squadHtml = await fetchUltimateRugbyHtml(squadUrl);
  const cards = parseUltimateRugbySquadHtml(squadHtml);
  const coachesSkipped = cards.filter((c) => c.isCoach).length;
  let work = playersOnly ? cards.filter((c) => !c.isCoach) : cards;
  if (options.limit != null && options.limit > 0) work = work.slice(0, options.limit);

  log(`Parsed ${cards.length} cards (${coachesSkipped} coaches); importing ${work.length} players`);

  const results: UltimateRugbyPlayerImportResult[] = [];
  for (let i = 0; i < work.length; i++) {
    const card = work[i]!;
    log(`[${i + 1}/${work.length}] ${card.name} (${card.path})`);
    try {
      const profile = await fetchPlayerProfile(card);
      const result = await importUltimateRugbyPlayerProfile(profile, {
        internationalTeamId,
        countryName,
        dryRun: options.dryRun,
        includeCareer: options.includeCareer,
        includeNews: options.includeNews,
      });
      results.push(result);
      log(
        `  → ${result.skipped ?? (result.fieldsUpdated.join(", ") || "ok")} | bio=${result.bioChars} career=${result.careerStints} news=${result.newsItems} caps=${result.caps ?? "-"}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        name: card.name,
        path: card.path,
        playerId: null,
        created: false,
        fieldsUpdated: [],
        bioChars: 0,
        careerStints: 0,
        newsItems: 0,
        caps: null,
        error: message,
      });
      log(`  → error: ${message}`);
    }
    if (delayMs > 0 && i < work.length - 1) await sleep(delayMs);
  }

  return {
    squadUrl,
    cardsFound: cards.length,
    coachesSkipped,
    results,
  };
}

/** Enrich every SA-linked player by resolving their Ultimate Rugby profile via name slug. */
export async function importUltimateRugbyHistoricalSaPlayers(
  options: UltimateRugbyImportOptions = {},
): Promise<UltimateRugbyHistoricalImportReport> {
  const db = getDb();
  const internationalTeamId = options.internationalTeamId ?? SOUTH_AFRICA_TEAM_ID;
  const countryName = options.countryName ?? "South Africa";
  const delayMs = options.delayMs ?? 400;
  const log = options.onProgress ?? (() => undefined);

  let rows = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(eq(players.internationalTeamId, internationalTeamId));

  // Prefer players missing strong bios first.
  rows = rows.sort((a, b) => a.name.localeCompare(b.name));
  if (options.limit != null && options.limit > 0) rows = rows.slice(0, options.limit);

  log(`Historical SA import: ${rows.length} candidates`);
  const results: UltimateRugbyPlayerImportResult[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    log(`[${i + 1}/${rows.length}] ${row.name}`);
    try {
      const profile = await fetchUltimateRugbyPlayerByName(row.name);
      if (!profile) {
        results.push({
          name: row.name,
          path: "",
          playerId: row.id,
          created: false,
          fieldsUpdated: [],
          bioChars: 0,
          careerStints: 0,
          newsItems: 0,
          caps: null,
          skipped: "ur-not-found",
        });
        log("  → ur-not-found");
      } else {
        const result = await importUltimateRugbyPlayerProfile(profile, {
          internationalTeamId,
          countryName,
          dryRun: options.dryRun,
          includeCareer: options.includeCareer,
          includeNews: options.includeNews,
        });
        results.push(result);
        log(
          `  → ${result.skipped ?? (result.fieldsUpdated.join(", ") || "ok")} | bio=${result.bioChars} career=${result.careerStints} news=${result.newsItems}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        name: row.name,
        path: "",
        playerId: row.id,
        created: false,
        fieldsUpdated: [],
        bioChars: 0,
        careerStints: 0,
        newsItems: 0,
        caps: null,
        error: message,
      });
      log(`  → error: ${message}`);
    }
    if (delayMs > 0 && i < rows.length - 1) await sleep(delayMs);
  }

  return { candidates: rows.length, results };
}

export function formatUltimateRugbyImportReport(report: UltimateRugbySquadImportReport): string {
  const updated = report.results.filter((r) => r.fieldsUpdated.length && !r.skipped && !r.error);
  const withBio = report.results.filter((r) => r.bioChars > 0);
  const withCareer = report.results.filter((r) => r.careerStints > 0);
  const withNews = report.results.filter((r) => r.newsItems > 0);
  const withCaps = report.results.filter((r) => r.caps != null);
  const errors = report.results.filter((r) => r.error);
  const skipped = report.results.filter((r) => r.skipped);
  return [
    `Squad: ${report.squadUrl}`,
    `Cards: ${report.cardsFound} (coaches skipped: ${report.coachesSkipped})`,
    `Processed: ${report.results.length}`,
    `Updated/enriched: ${updated.length}`,
    `With bio: ${withBio.length}`,
    `With career stints: ${withCareer.length}`,
    `With news links: ${withNews.length}`,
    `With caps parsed: ${withCaps.length}`,
    `Skipped: ${skipped.length}`,
    `Errors: ${errors.length}`,
  ].join("\n");
}

export function formatUltimateRugbyHistoricalReport(
  report: UltimateRugbyHistoricalImportReport,
): string {
  const found = report.results.filter((r) => !r.skipped && !r.error);
  const notFound = report.results.filter((r) => r.skipped === "ur-not-found");
  const withBio = report.results.filter((r) => r.bioChars > 200);
  const withCareer = report.results.filter((r) => r.careerStints > 0);
  return [
    `Candidates: ${report.candidates}`,
    `Matched on Ultimate Rugby: ${found.length}`,
    `Not found: ${notFound.length}`,
    `Strong bios written/seen: ${withBio.length}`,
    `Career histories: ${withCareer.length}`,
    `Errors: ${report.results.filter((r) => r.error).length}`,
  ].join("\n");
}
