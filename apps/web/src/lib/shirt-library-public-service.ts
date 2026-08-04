/**
 * Public Shirt Library competition/season page resolver.
 * Only approved shirts are exposed on public pages (unless preview=true).
 */
import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  shirtLibraryCompetitionPageTeams,
  shirtLibraryCompetitionPages,
  teamShirtVersions,
  teamShirts,
  teams,
  venues,
} from "@rugby365/db";
import { getDb } from "./db";
import { countryNameToIsoCode } from "./open-meteo-service";
import {
  getCompetitionShirtStatus,
  getOrCreateShirtRequirements,
  listShirtLibrarySeasons,
  listShirtLibraryTeams,
} from "./shirt-library-service";
import type { ShirtSvgConfig } from "./shirt-library-types";
import { shirtConfigFromVersion } from "./shirt-svg-config";

export type ShirtLibraryPageStatus =
  | "DRAFT"
  | "READY_FOR_REVIEW"
  | "PUBLISHED"
  | "ARCHIVED";

export type PublicApprovedShirt = {
  shirtId: string;
  versionId: string;
  kitType: string;
  versionNumber: number;
  svgConfig: ShirtSvgConfig;
  bodyColour: string;
  secondaryColour: string | null;
  patternType: string;
};

export type PublicShirtTeamCard = {
  teamId: string;
  name: string;
  slug: string;
  shortName: string | null;
  countryName: string | null;
  countryIso: string | null;
  imageUrl: string | null;
  clubHref: string;
  detailHref: string;
  home: PublicApprovedShirt | null;
  away: PublicApprovedShirt | null;
  third: PublicApprovedShirt | null;
  statusLabel: "Approved" | "Partly Approved" | "Shirt Awaiting Approval";
};

export type CompetitionFlag = {
  countryName: string;
  iso: string | null;
  flagUrl: string | null;
};

export type CompetitionMapLocation = {
  teamId: string;
  teamName: string;
  shortName: string | null;
  slug: string;
  clubHref: string;
  latitude: number;
  longitude: number;
  venueName: string | null;
  city: string | null;
  countryName: string | null;
};

export type ColourLegendSwatch = {
  hex: string;
  label: string;
};

function normalizeSeasonSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function seasonMatchesSlug(
  season: { slug: string; label: string; year: number | null },
  seasonSlug: string,
): boolean {
  const target = normalizeSeasonSlug(seasonSlug);
  if (!target) return false;
  if (normalizeSeasonSlug(season.slug) === target) return true;
  if (normalizeSeasonSlug(season.label) === target) return true;
  if (season.year != null && String(season.year) === target) return true;
  // Allow /2026 to match 2026–27
  if (season.year != null && target === String(season.year).slice(0, 4)) return true;
  if (target.length === 4 && season.label.replace(/[^\d]/g, "").startsWith(target)) return true;
  return false;
}

function flagUrlForIso(iso: string | null): string | null {
  if (!iso || iso.length !== 2) return null;
  return `https://flagcdn.com/w40/${iso.toLowerCase()}.png`;
}

const NAMED_COLOURS: Array<{ label: string; hex: string }> = [
  { label: "Black", hex: "#111111" },
  { label: "Navy", hex: "#0A1F44" },
  { label: "Royal Blue", hex: "#0057B8" },
  { label: "Sky Blue", hex: "#6BB7E0" },
  { label: "Green", hex: "#006B3C" },
  { label: "Dark Green", hex: "#0B3D2E" },
  { label: "Red", hex: "#C8102E" },
  { label: "Scarlet", hex: "#E10600" },
  { label: "Maroon", hex: "#6B1D3A" },
  { label: "Gold", hex: "#C5A572" },
  { label: "Amber", hex: "#F5A623" },
  { label: "Yellow", hex: "#F5C518" },
  { label: "Orange", hex: "#E85D04" },
  { label: "Pink", hex: "#E91E8C" },
  { label: "Purple", hex: "#5B2C6F" },
  { label: "Teal", hex: "#008080" },
  { label: "White", hex: "#FFFFFF" },
  { label: "Grey", hex: "#6B7280" },
];

function parseHex(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  return `#${m[1]!.toUpperCase()}`;
}

function hexDistance(a: string, b: string): number {
  const toRgb = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return Math.abs(ar! - br!) + Math.abs(ag! - bg!) + Math.abs(ab! - bb!);
}

function labelForHex(hex: string): string {
  let best = NAMED_COLOURS[0]!;
  let bestDist = Infinity;
  for (const c of NAMED_COLOURS) {
    const d = hexDistance(hex, c.hex);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best.label;
}

function buildColourLegend(shirts: PublicApprovedShirt[]): ColourLegendSwatch[] {
  const seen = new Map<string, string>();
  for (const s of shirts) {
    for (const raw of [
      s.svgConfig.bodyColour,
      s.svgConfig.secondaryColour,
      s.svgConfig.collarColour,
      s.svgConfig.patternColour,
    ]) {
      const hex = parseHex(raw);
      if (!hex) continue;
      const label = labelForHex(hex);
      if (!seen.has(label)) seen.set(label, hex);
    }
  }
  return [...seen.entries()].map(([label, hex]) => ({ label, hex }));
}

async function loadApprovedShirtBundle(
  shirtId: string | null | undefined,
): Promise<PublicApprovedShirt | null> {
  if (!shirtId) return null;
  const db = getDb();
  const [shirt] = await db
    .select()
    .from(teamShirts)
    .where(and(eq(teamShirts.id, shirtId), eq(teamShirts.status, "APPROVED")))
    .limit(1);
  if (!shirt?.approvedVersionId) return null;

  const [version] = await db
    .select()
    .from(teamShirtVersions)
    .where(eq(teamShirtVersions.id, shirt.approvedVersionId))
    .limit(1);
  if (!version || version.status !== "APPROVED") return null;

  return {
    shirtId: shirt.id,
    versionId: version.id,
    kitType: shirt.kitType,
    versionNumber: version.versionNumber,
    svgConfig: shirtConfigFromVersion(version),
    bodyColour: version.bodyColour,
    secondaryColour: version.secondaryColour,
    patternType: version.patternType,
  };
}

export async function getOrCreateCompetitionShirtPage(competitionId: string, seasonId: string) {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(shirtLibraryCompetitionPages)
    .where(
      and(
        eq(shirtLibraryCompetitionPages.competitionId, competitionId),
        eq(shirtLibraryCompetitionPages.seasonId, seasonId),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [inserted] = await db
    .insert(shirtLibraryCompetitionPages)
    .values({
      competitionId,
      seasonId,
      status: "DRAFT",
      subtitle: "Official Team Colours · Sponsor-Free Shirt Designs",
    })
    .returning();
  return inserted!;
}

/** Sync visible teams + approved shirt IDs onto the page snapshot. */
export async function syncCompetitionShirtPageTeams(pageId: string) {
  const db = getDb();
  const [page] = await db
    .select()
    .from(shirtLibraryCompetitionPages)
    .where(eq(shirtLibraryCompetitionPages.id, pageId))
    .limit(1);
  if (!page) return { synced: 0 };

  const teamList = await listShirtLibraryTeams(page.competitionId, page.seasonId);
  const shirts = await db
    .select()
    .from(teamShirts)
    .where(
      and(
        eq(teamShirts.competitionId, page.competitionId),
        eq(teamShirts.seasonId, page.seasonId),
        eq(teamShirts.status, "APPROVED"),
      ),
    );

  const byTeamKit = new Map<string, string>();
  for (const s of shirts) {
    byTeamKit.set(`${s.teamId}:${s.kitType}`, s.id);
  }

  const keepTeamIds = new Set(teamList.map((t) => t.id));
  let synced = 0;
  for (const [index, team] of teamList.entries()) {
    const homeShirtId = byTeamKit.get(`${team.id}:HOME`) ?? null;
    const awayShirtId = byTeamKit.get(`${team.id}:AWAY`) ?? null;
    const thirdShirtId = byTeamKit.get(`${team.id}:THIRD`) ?? null;

    const [row] = await db
      .select({ id: shirtLibraryCompetitionPageTeams.id })
      .from(shirtLibraryCompetitionPageTeams)
      .where(
        and(
          eq(shirtLibraryCompetitionPageTeams.pageId, pageId),
          eq(shirtLibraryCompetitionPageTeams.teamId, team.id),
        ),
      )
      .limit(1);

    if (row) {
      await db
        .update(shirtLibraryCompetitionPageTeams)
        .set({
          homeShirtId,
          awayShirtId,
          thirdShirtId,
          sortOrder: index,
          isVisible: true,
          updatedAt: new Date(),
        })
        .where(eq(shirtLibraryCompetitionPageTeams.id, row.id));
    } else {
      await db.insert(shirtLibraryCompetitionPageTeams).values({
        pageId,
        teamId: team.id,
        homeShirtId,
        awayShirtId,
        thirdShirtId,
        sortOrder: index,
        isVisible: true,
      });
    }
    synced += 1;
  }

  // Drop teams that are no longer in the official season roster (e.g. Canada on NC).
  const stale = await db
    .select({
      id: shirtLibraryCompetitionPageTeams.id,
      teamId: shirtLibraryCompetitionPageTeams.teamId,
    })
    .from(shirtLibraryCompetitionPageTeams)
    .where(eq(shirtLibraryCompetitionPageTeams.pageId, pageId));
  for (const row of stale) {
    if (keepTeamIds.has(row.teamId)) continue;
    await db
      .delete(shirtLibraryCompetitionPageTeams)
      .where(eq(shirtLibraryCompetitionPageTeams.id, row.id));
  }

  await db
    .update(shirtLibraryCompetitionPages)
    .set({ updatedAt: new Date() })
    .where(eq(shirtLibraryCompetitionPages.id, pageId));

  return { synced };
}

export async function setCompetitionShirtPageStatus(
  competitionId: string,
  seasonId: string,
  status: ShirtLibraryPageStatus,
) {
  const page = await getOrCreateCompetitionShirtPage(competitionId, seasonId);
  await syncCompetitionShirtPageTeams(page.id);
  const db = getDb();
  const [updated] = await db
    .update(shirtLibraryCompetitionPages)
    .set({
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : page.publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(shirtLibraryCompetitionPages.id, page.id))
    .returning();
  return updated!;
}

export async function listPublishedShirtLibraryCompetitions() {
  const db = getDb();
  const pages = await db
    .select({
      pageId: shirtLibraryCompetitionPages.id,
      status: shirtLibraryCompetitionPages.status,
      publishedAt: shirtLibraryCompetitionPages.publishedAt,
      competitionId: competitions.id,
      name: competitions.name,
      slug: competitions.slug,
      competitionType: competitions.competitionType,
      countryName: competitions.countryName,
      region: competitions.region,
      catalogGroup: competitions.catalogGroup,
      seasonId: competitionSeasons.id,
      seasonLabel: competitionSeasons.label,
      seasonSlug: competitionSeasons.slug,
      seasonYear: competitionSeasons.year,
      isActive: competitionSeasons.isActive,
    })
    .from(shirtLibraryCompetitionPages)
    .innerJoin(competitions, eq(competitions.id, shirtLibraryCompetitionPages.competitionId))
    .innerJoin(
      competitionSeasons,
      eq(competitionSeasons.id, shirtLibraryCompetitionPages.seasonId),
    )
    .where(eq(shirtLibraryCompetitionPages.status, "PUBLISHED"))
    .orderBy(asc(competitions.name), desc(competitionSeasons.year));

  const byComp = new Map<string, (typeof pages)[number][]>();
  for (const p of pages) {
    const list = byComp.get(p.competitionId) ?? [];
    list.push(p);
    byComp.set(p.competitionId, list);
  }

  const cards = [];
  for (const [, list] of byComp) {
    const latest = list.find((p) => p.isActive) ?? list[0]!;
    const status = await getCompetitionShirtStatus(latest.competitionId, latest.seasonId);
    cards.push({
      competitionId: latest.competitionId,
      name: latest.name,
      slug: latest.slug,
      competitionType: latest.competitionType,
      countryName: latest.countryName,
      region: latest.region,
      catalogGroup: latest.catalogGroup,
      seasonId: latest.seasonId,
      seasonLabel: latest.seasonLabel,
      seasonSlug: latest.seasonSlug,
      seasonYear: latest.seasonYear,
      teamCount: status.summary.teamCount,
      homeApproved: status.summary.homeApproved,
      awayApproved: status.summary.awayApproved,
      fullyApproved: status.summary.fullyApproved,
      readinessPct: status.summary.readinessPct,
      approvedShirtCount: status.summary.homeApproved + status.summary.awayApproved,
      href: `/shirt-library/${latest.slug}/${latest.seasonSlug}`,
    });
  }
  return cards;
}

export async function getCompetitionFlags(
  competitionId: string,
  seasonId: string,
): Promise<CompetitionFlag[]> {
  const teamList = await listShirtLibraryTeams(competitionId, seasonId);
  const [comp] = await getDb()
    .select({ countryName: competitions.countryName, region: competitions.region })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  const names = new Set<string>();
  for (const t of teamList) {
    if (t.countryName?.trim()) names.add(t.countryName.trim());
  }
  if (names.size === 0 && comp?.countryName?.trim()) {
    names.add(comp.countryName.trim());
  }

  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((countryName) => {
      const iso = countryNameToIsoCode(countryName);
      return { countryName, iso, flagUrl: flagUrlForIso(iso) };
    });
}

export async function getCompetitionMapLocations(
  competitionId: string,
  seasonId: string,
): Promise<CompetitionMapLocation[]> {
  const teamList = await listShirtLibraryTeams(competitionId, seasonId);
  if (!teamList.length) return [];
  const db = getDb();
  const ids = teamList.map((t) => t.id);
  const teamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      slug: teams.slug,
      shortName: teams.shortName,
      homeVenueId: teams.homeVenueId,
      countryName: teams.countryName,
    })
    .from(teams)
    .where(inArray(teams.id, ids));

  const venueIds = teamRows.map((t) => t.homeVenueId).filter((id): id is string => Boolean(id));
  const venueRows =
    venueIds.length === 0
      ? []
      : await db.select().from(venues).where(inArray(venues.id, venueIds));
  const venueMap = new Map(venueRows.map((v) => [v.id, v]));

  const out: CompetitionMapLocation[] = [];
  for (const t of teamRows) {
    if (!t.homeVenueId) continue;
    const venue = venueMap.get(t.homeVenueId);
    if (
      !venue ||
      venue.latitude == null ||
      venue.longitude == null ||
      !Number.isFinite(venue.latitude) ||
      !Number.isFinite(venue.longitude)
    ) {
      continue;
    }
    out.push({
      teamId: t.id,
      teamName: t.name,
      shortName: t.shortName,
      slug: t.slug,
      clubHref: `/teams/${t.slug}`,
      latitude: venue.latitude,
      longitude: venue.longitude,
      venueName: venue.name,
      city: venue.city,
      countryName: venue.countryName ?? t.countryName,
    });
  }
  return out;
}

export async function getCompetitionColourLegend(
  teams: PublicShirtTeamCard[],
): Promise<ColourLegendSwatch[]> {
  const shirts: PublicApprovedShirt[] = [];
  for (const t of teams) {
    if (t.home) shirts.push(t.home);
    if (t.away) shirts.push(t.away);
    if (t.third) shirts.push(t.third);
  }
  return buildColourLegend(shirts);
}

export async function getCompetitionPreviousSeasons(
  competitionId: string,
  currentSeasonId: string,
  competitionSlug: string,
) {
  const seasons = await listShirtLibrarySeasons(competitionId);
  const db = getDb();
  const published = await db
    .select({
      seasonId: shirtLibraryCompetitionPages.seasonId,
      status: shirtLibraryCompetitionPages.status,
    })
    .from(shirtLibraryCompetitionPages)
    .where(
      and(
        eq(shirtLibraryCompetitionPages.competitionId, competitionId),
        eq(shirtLibraryCompetitionPages.status, "PUBLISHED"),
      ),
    );
  const publishedIds = new Set(published.map((p) => p.seasonId));

  return seasons
    .filter((s) => s.id !== currentSeasonId)
    .map((s) => ({
      id: s.id,
      label: s.label,
      slug: s.slug,
      year: s.year,
      isActive: s.isActive,
      isPublished: publishedIds.has(s.id),
      href: `/shirt-library/${competitionSlug}/${s.slug}`,
    }));
}

export async function getCompetitionShirtLibraryPage(input: {
  competitionSlug: string;
  seasonSlug: string;
  preview?: boolean;
}) {
  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, input.competitionSlug))
    .limit(1);
  if (!competition) return null;

  const seasons = await listShirtLibrarySeasons(competition.id);
  const season = seasons.find((s) => seasonMatchesSlug(s, input.seasonSlug));
  if (!season) return null;

  const page = await getOrCreateCompetitionShirtPage(competition.id, season.id);
  if (!input.preview && page.status !== "PUBLISHED") {
    return { blocked: true as const, competition, season, page };
  }

  // Keep published/archived snapshots frozen so historic seasons do not pick up
  // newly approved shirt versions. Draft/preview pages sync live approval state.
  const freezeSnapshot = page.status === "PUBLISHED" || page.status === "ARCHIVED";
  if (!freezeSnapshot) {
    await syncCompetitionShirtPageTeams(page.id);
  } else {
    const [existingTeam] = await db
      .select({ id: shirtLibraryCompetitionPageTeams.id })
      .from(shirtLibraryCompetitionPageTeams)
      .where(eq(shirtLibraryCompetitionPageTeams.pageId, page.id))
      .limit(1);
    if (!existingTeam) {
      await syncCompetitionShirtPageTeams(page.id);
    }
  }

  const pageTeams = await db
    .select()
    .from(shirtLibraryCompetitionPageTeams)
    .where(
      and(
        eq(shirtLibraryCompetitionPageTeams.pageId, page.id),
        eq(shirtLibraryCompetitionPageTeams.isVisible, true),
      ),
    )
    .orderBy(asc(shirtLibraryCompetitionPageTeams.sortOrder));

  const teamIds = pageTeams.map((t) => t.teamId);
  const teamRows =
    teamIds.length === 0
      ? []
      : await db
          .select({
            id: teams.id,
            name: teams.name,
            slug: teams.slug,
            shortName: teams.shortName,
            countryName: teams.countryName,
            imageUrl: teams.imageUrl,
          })
          .from(teams)
          .where(inArray(teams.id, teamIds));
  const teamMap = new Map(teamRows.map((t) => [t.id, t]));

  const cards: PublicShirtTeamCard[] = [];
  for (const pt of pageTeams) {
    const team = teamMap.get(pt.teamId);
    if (!team) continue;
    const [home, away, third] = await Promise.all([
      loadApprovedShirtBundle(pt.homeShirtId),
      loadApprovedShirtBundle(pt.awayShirtId),
      loadApprovedShirtBundle(pt.thirdShirtId),
    ]);
    const approvedCount = [home, away, third].filter(Boolean).length;
    const statusLabel =
      approvedCount === 0
        ? "Shirt Awaiting Approval"
        : approvedCount >= 2
          ? "Approved"
          : "Partly Approved";

    cards.push({
      teamId: team.id,
      name: team.name,
      slug: team.slug,
      shortName: team.shortName,
      countryName: team.countryName,
      countryIso: countryNameToIsoCode(team.countryName),
      imageUrl: team.imageUrl,
      clubHref: `/teams/${team.slug}`,
      detailHref: `/shirt-library/${competition.slug}/${season.slug}/${team.slug}`,
      home,
      away,
      third,
      statusLabel,
    });
  }

  const [flags, mapLocations, readiness, requirements] = await Promise.all([
    getCompetitionFlags(competition.id, season.id),
    getCompetitionMapLocations(competition.id, season.id),
    getCompetitionShirtStatus(competition.id, season.id),
    getOrCreateShirtRequirements(competition.id),
  ]);

  const colourLegend = await getCompetitionColourLegend(cards);

  const previousSeasons = seasons
    .filter((s) => s.id !== season.id)
    .map((s) => ({
      id: s.id,
      label: s.label,
      slug: s.slug,
      year: s.year,
      isActive: s.isActive,
      href: `/shirt-library/${competition.slug}/${s.slug}`,
    }));

  const aboutText =
    page.description?.trim() ||
    competition.bioSummary?.trim() ||
    `${competition.name} brings together ${cards.length} teams${
      competition.countryName ? ` in ${competition.countryName}` : competition.region ? ` across ${competition.region}` : ""
    } for the ${season.label} season.`;

  const publicReadiness = {
    teams: readiness.summary.teamCount,
    homeApproved: readiness.summary.homeApproved,
    awayApproved: readiness.summary.awayApproved,
    thirdApproved: cards.filter((c) => c.third).length,
    readinessPct: readiness.summary.readinessPct,
    homeRequired: requirements.homeRequired,
    awayRequired: requirements.awayRequired,
    thirdRequired: requirements.thirdRequired,
  };

  const accentColour =
    cards.find((c) => c.home)?.home?.bodyColour ??
    cards.find((c) => c.away)?.away?.bodyColour ??
    "#C8102E";

  return {
    blocked: false as const,
    competition: {
      id: competition.id,
      name: competition.name,
      slug: competition.slug,
      competitionType: competition.competitionType,
      countryName: competition.countryName,
      region: competition.region,
      catalogGroup: competition.catalogGroup,
      bioSummary: competition.bioSummary,
      level: competition.level,
      format: competition.format,
      wikipediaUrl: competition.wikipediaUrl,
    },
    season: {
      id: season.id,
      label: season.label,
      slug: season.slug,
      year: season.year,
      isActive: season.isActive,
    },
    page: {
      id: page.id,
      status: page.status as ShirtLibraryPageStatus,
      title: page.title ?? `${competition.name} ${season.label}`,
      subtitle:
        page.subtitle ?? "Official Team Colours · Sponsor-Free Shirt Designs",
      mapEnabled: page.mapEnabled,
      flagsEnabled: page.flagsEnabled,
      colourLegendEnabled: page.colourLegendEnabled,
      aboutSectionEnabled: page.aboutSectionEnabled,
      publishedAt: page.publishedAt,
    },
    teams: cards,
    flags,
    mapLocations,
    colourLegend,
    readiness: publicReadiness,
    previousSeasons,
    about: aboutText,
    facts: {
      competitionType: competition.competitionType,
      season: season.label,
      teams: cards.length,
      countries: flags.map((f) => f.countryName),
      region: competition.region,
      level: competition.level,
      format: competition.format,
      wikipediaUrl: competition.wikipediaUrl,
    },
    accentColour,
  };
}

export async function getTeamShirtLibraryDetailPage(input: {
  competitionSlug: string;
  seasonSlug: string;
  teamSlug: string;
  preview?: boolean;
}) {
  const page = await getCompetitionShirtLibraryPage({
    competitionSlug: input.competitionSlug,
    seasonSlug: input.seasonSlug,
    preview: input.preview,
  });
  if (!page || page.blocked) return page;
  const team = page.teams.find((t) => t.slug === input.teamSlug);
  if (!team) return null;

  const seasons = await listShirtLibrarySeasons(page.competition.id);
  const siblingSeasons = [];
  for (const s of seasons) {
    if (s.id === page.season.id) continue;
    const teamList = await listShirtLibraryTeams(page.competition.id, s.id);
    if (!teamList.some((t) => t.slug === input.teamSlug)) continue;
    siblingSeasons.push({
      id: s.id,
      label: s.label,
      slug: s.slug,
      href: `/shirt-library/${page.competition.slug}/${s.slug}/${input.teamSlug}`,
    });
  }

  return {
    ...page,
    team,
    siblingSeasons,
  };
}

export async function listShirtLibraryCompetitionHub(competitionSlug: string) {
  const db = getDb();
  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.slug, competitionSlug))
    .limit(1);
  if (!competition) return null;

  const seasons = await listShirtLibrarySeasons(competition.id);
  const pages = await db
    .select()
    .from(shirtLibraryCompetitionPages)
    .where(eq(shirtLibraryCompetitionPages.competitionId, competition.id));
  const pageBySeason = new Map(pages.map((p) => [p.seasonId, p]));

  const seasonCards = [];
  for (const s of seasons) {
    const page = pageBySeason.get(s.id);
    const status = await getCompetitionShirtStatus(competition.id, s.id);
    seasonCards.push({
      id: s.id,
      label: s.label,
      slug: s.slug,
      year: s.year,
      isActive: s.isActive,
      pageStatus: (page?.status ?? "DRAFT") as ShirtLibraryPageStatus,
      isPublished: page?.status === "PUBLISHED",
      teamCount: status.summary.teamCount,
      readinessPct: status.summary.readinessPct,
      href: `/shirt-library/${competition.slug}/${s.slug}`,
    });
  }

  return { competition, seasons: seasonCards };
}
