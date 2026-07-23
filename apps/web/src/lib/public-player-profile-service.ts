/**
 * Public read model for /players/[slug] (+ /domestic|/international|/scouting).
 * Never exposes admin IDs, edit controls, or private absence records.
 */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  competitionSeasons,
  competitions,
  matchEvents,
  playerBioProfiles,
  playerCareerStints,
  playerInjuries,
  playerLegends,
  playerMatchRatings,
  playerRatings,
  playerSuspensions,
  playerTransfers,
  players,
  teams,
  fixtures,
} from "@rugby365/db";
import { getDb } from "./db";
import { calculatePlayerAge, normalizeSocialAccounts } from "./player-profile-utils";
import { buildPublicPlayerIntro } from "./public-player-intro";
import { getPlayerCareerStats } from "./player-stats";
import { wikipediaCareerTotals } from "./player-career-stint-utils";
import { careerStatusLabel } from "./player-career-status";
import {
  currentDomesticSeasonStartYear,
  seasonSlugFromStartYear,
} from "./season-label-utils";
import {
  buildPublicPlayerPath,
  type PublicPlayerView,
} from "./public-player-filters";
import {
  buildCompetitionOptions,
  buildSeasonOptions,
  filterAppearances,
  latestRecordedClubSeason,
  loadPlayerAppearances,
  positionBreakdown,
  resolveCurrentClubCompetitionName,
  summarizeAppearances,
  type PublicAppearanceRow,
} from "./public-player-appearances-service";
import { dedupeTransfersForPublic } from "./public-player-transfer-utils";
import { readBioVariants } from "./player-bio-variant-utils";
import type { PlayerBioSections, PlayerBioVariants } from "./player-bio-types";
import type {
  DevelopmentAnnotation,
  DevelopmentTimelinePoint,
} from "./player-development-timeline-utils";
import { MATCH_RATING_MODEL } from "./match-rating-math";
import { getPublicPlayerRadar } from "./player-radar-service";

function pickBioSectionsForView(
  variants: PlayerBioVariants,
  view: PublicPlayerView,
): PlayerBioSections {
  if (view === "international") return variants.international;
  if (view === "scouting") return variants.scouting;
  return variants.domestic;
}

export type PublicPlayerStatus =
  | "active"
  | "injured"
  | "suspended"
  | "retired"
  | "unattached"
  | "released"
  | "legend";

export type PublicPlayerProfile = {
  slug: string;
  name: string;
  fullName: string | null;
  imageUrl: string | null;
  squadNumber: number | null;
  positionName: string | null;
  otherPositions: string[];
  preferredFoot: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  nationName: string | null;
  nationCode: string | null;
  club: { name: string; slug: string | null; imageUrl: string | null } | null;
  internationalTeam: { name: string; slug: string | null; imageUrl: string | null } | null;
  /** Current club's domestic competition (not historic season competition). */
  competitionName: string | null;
  latestRecordedSeason: {
    teamName: string;
    seasonLabel: string;
    seasonSlug: string;
  } | null;
  status: PublicPlayerStatus;
  statusLabel: string;
  careerStatus: string;
  view: PublicPlayerView;
  intro: string | null;
  biography: PlayerBioSections | null;
  rating: {
    current: number | null;
    trend: number | null;
    trendLabel: string;
    season: number | null;
    lastFive: number[];
    updatedAt: string | null;
  };
  seasonSnapshot: {
    seasonLabel: string;
    appearances: number | null;
    starts: number | null;
    bench: number | null;
    minutesPlayed: number | null;
    tries: number | null;
    points: number | null;
    tryAssists: number | null;
    carries: number | null;
    metresCarried: number | null;
    tacklesMade: number | null;
    tacklesCompleted: number | null;
    turnoversWon: number | null;
    lineBreaks: number | null;
    defendersBeaten: number | null;
    attackRank: number | null;
    defenceRank: number | null;
    ratingAverage: number | null;
    ratedAppearances: number;
  } | null;
  filters: {
    season: string;
    competition: string;
    seasonOptions: Array<{ slug: string; label: string; appearanceCount: number }>;
    competitionOptions: Array<{ slug: string; name: string; appearanceCount: number }>;
  };
  career: {
    appearances: number | null;
    tries: number | null;
    points: number | null;
    conversions: number | null;
    penalties: number | null;
    dropGoals: number | null;
    wikipediaApps: number | null;
    wikipediaPoints: number | null;
    internationalApps: number | null;
    internationalPoints: number | null;
  };
  recentForm: Array<{
    date: string | null;
    competitionName: string | null;
    teamName: string | null;
    opponentName: string | null;
    result: string | null;
    homeAway: "home" | "away" | null;
    started: boolean | null;
    minutes: number | null;
    tries: number | null;
    points: number | null;
    rating: number | null;
    ratingChange: number | null;
    fixtureSlug: string | null;
  }>;
  matches: {
    page: number;
    pageSize: number;
    total: number;
    rows: PublicAppearanceRow[];
  };
  events: Array<{
    date: string | null;
    minute: number;
    eventType: string;
    competitionName: string | null;
    opponentName: string | null;
    teamName: string | null;
    fixtureSlug: string | null;
    resultLabel: string | null;
  }>;
  clubHistory: Array<{
    teamName: string;
    yearsLabel: string;
    apps: number | null;
    points: number | null;
  }>;
  internationalHistory: Array<{
    teamName: string;
    yearsLabel: string;
    apps: number | null;
    points: number | null;
  }>;
  internationalSummary: {
    nation: string | null;
    caps: number | null;
    tries: number | null;
    points: number | null;
    competitions: string[];
  };
  transfers: Array<{
    date: string | null;
    fromLabel: string;
    toLabel: string;
    movementType: string;
    seasonLabel: string | null;
    competitionName: string | null;
  }>;
  absences: Array<{
    kind: "injury" | "suspension";
    label: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
    source: string | null;
  }>;
  achievements: Array<{
    title: string;
    detail: string | null;
  }>;
  positionsPlayed: Array<{ position: string; appearances: number }>;
  ratingSeries: Array<{
    date: string | null;
    rating: number;
    opponentName: string | null;
    competitionName: string | null;
    fixtureSlug: string | null;
    resultLabel: string | null;
  }>;
  developmentTimeline: import("./player-development-timeline-utils").DevelopmentTimelinePoint[];
  developmentChart: {
    enabled: boolean;
    showRollingAverage: boolean;
    showSeasonAverage: boolean;
    showCareerAverage: boolean;
    minMinutes: number;
    summaryOverride: string | null;
    currentDomesticSlug: string;
    careerAverage: number | null;
  };
  performanceRadar: import("./player-radar-build").PlayerRadarBundle;
  insights: string[];
  social: {
    twitter: string | null;
    instagram: string | null;
    facebook: string | null;
    website: string | null;
  };
  sources: {
    wikipediaUrl: string | null;
    lastVerifiedAt: string | null;
    profileUpdatedAt: string | null;
    labels: string[];
  };
  seo: {
    title: string;
    description: string;
    canonicalPath: string;
    ogImageUrl: string | null;
    noIndex: boolean;
  };
  primaryImage: {
    altText: string | null;
    credit: string | null;
    photographer: string | null;
    focalX: number | null;
    focalY: number | null;
  } | null;
  gallery: Array<{
    id: string;
    imageUrl: string;
    altText: string | null;
    caption: string | null;
    credit: string | null;
    imageType: string | null;
    role: string | null;
    focalX: number | null;
    focalY: number | null;
  }>;
  preview: boolean;
};

function parsePositions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => (typeof p === "string" ? p.trim() : "")).filter(Boolean);
}

function isPubliclyVisible(player: { isPublic: boolean; publishStatus: string }): boolean {
  return player.isPublic && player.publishStatus === "published";
}

async function resolvePublicStatus(input: {
  playerId: string;
  careerStatus: string;
  statusOverride: string | null;
}): Promise<PublicPlayerStatus> {
  const override = input.statusOverride?.trim().toLowerCase();
  if (
    override === "injured" ||
    override === "suspended" ||
    override === "retired" ||
    override === "unattached" ||
    override === "active" ||
    override === "released" ||
    override === "legend"
  ) {
    return override;
  }

  const db = getDb();
  const [injury] = await db
    .select({ id: playerInjuries.id })
    .from(playerInjuries)
    .where(
      and(
        eq(playerInjuries.playerId, input.playerId),
        eq(playerInjuries.visibility, "public"),
        eq(playerInjuries.verificationStatus, "confirmed"),
        inArray(playerInjuries.status, ["injured", "out", "active"]),
      ),
    )
    .limit(1);
  if (injury) return "injured";

  const [suspension] = await db
    .select({ id: playerSuspensions.id })
    .from(playerSuspensions)
    .where(
      and(
        eq(playerSuspensions.playerId, input.playerId),
        eq(playerSuspensions.visibility, "public"),
        eq(playerSuspensions.verificationStatus, "confirmed"),
        inArray(playerSuspensions.status, ["suspended", "active"]),
      ),
    )
    .limit(1);
  if (suspension) return "suspended";

  const cs = input.careerStatus;
  if (cs === "retired" || cs === "released" || cs === "legend") return cs;
  return "active";
}

function statusLabel(status: PublicPlayerStatus): string {
  switch (status) {
    case "injured":
      return "Injured";
    case "suspended":
      return "Suspended";
    case "retired":
      return "Retired";
    case "unattached":
      return "Unattached";
    case "released":
      return "Released";
    case "legend":
      return "Legend";
    default:
      return "Active";
  }
}

function parseLastFive(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v) => (typeof v === "number" ? v : Number(v)))
    .filter((n) => Number.isFinite(n));
}

function ratingTrendLabel(trend: number | null, sampleSize: number): string {
  if (sampleSize < 2 || trend == null || !Number.isFinite(trend)) return "Not enough data";
  if (Math.abs(trend) < 0.05) return "No change";
  if (trend > 0) return "Up";
  if (trend < 0) return "Down";
  return "No change";
}

function publicEventLabel(eventType: string): string | null {
  const t = eventType.toLowerCase();
  if (t.includes("try") && !t.includes("penalty")) return "Try";
  if (t.includes("conversion")) return "Conversion";
  if (t.includes("penalty") && t.includes("goal")) return "Penalty goal";
  if (t.includes("drop")) return "Drop goal";
  if (t.includes("yellow")) return "Yellow card";
  if (t.includes("red")) return "Red card";
  if (t.includes("sub") && (t.includes("on") || t.includes("enter"))) return "Substitution on";
  if (t.includes("sub") && (t.includes("off") || t.includes("exit"))) return "Substitution off";
  if (t === "try") return "Try";
  if (t === "conversion") return "Conversion";
  if (t === "penalty_goal" || t === "penalty") return "Penalty goal";
  if (t === "drop_goal") return "Drop goal";
  if (t === "yellow_card") return "Yellow card";
  if (t === "red_card") return "Red card";
  return null;
}

function buildInsights(input: {
  name: string;
  seasonLabel: string;
  filtered: PublicAppearanceRow[];
  summary: ReturnType<typeof summarizeAppearances>;
  positions: Array<{ position: string; appearances: number }>;
}): string[] {
  const insights: string[] = [];
  const apps = input.filtered.length;
  if (apps < 3) return insights;

  const { summary } = input;
  if (summary.tacklesMade != null && apps > 0) {
    insights.push(
      `${input.name} averaged ${(summary.tacklesMade / apps).toFixed(1)} tackles per match across ${apps} appearances in ${summary.seasonLabel}.`,
    );
  }
  if (summary.metresCarried != null && apps > 0) {
    insights.push(
      `${input.name} made ${(summary.metresCarried / apps).toFixed(0)} carry metres per match in ${summary.seasonLabel} (${apps} matches).`,
    );
  }
  if (summary.minutesPlayed != null && summary.minutesPlayed > 0 && summary.turnoversWon != null) {
    const per80 = (summary.turnoversWon / summary.minutesPlayed) * 80;
    insights.push(
      `${input.name} won ${per80.toFixed(1)} turnovers per 80 minutes in ${summary.seasonLabel} (${summary.minutesPlayed} minutes sampled).`,
    );
  }
  if (input.positions[0]) {
    insights.push(
      `${input.name} has played mainly as ${input.positions[0].position}${
        input.positions[1] ? `, with additional appearances at ${input.positions[1].position}` : ""
      }.`,
    );
  }
  if (summary.ratingAverage != null && summary.ratedAppearances >= 3) {
    insights.push(
      `${input.name}’s average Rugby365 rating in the selected period is ${summary.ratingAverage.toFixed(0)} across ${summary.ratedAppearances} rated appearances.`,
    );
  }
  return insights.slice(0, 6);
}

function clubHistoryFromAppearances(rows: PublicAppearanceRow[]) {
  const map = new Map<
    string,
    { teamName: string; first: string | null; last: string | null; apps: number; points: number }
  >();
  for (const row of rows.filter((r) => !r.isInternational)) {
    const prev = map.get(row.teamId) ?? {
      teamName: row.teamName,
      first: row.kickoffAt,
      last: row.kickoffAt,
      apps: 0,
      points: 0,
    };
    prev.apps += 1;
    prev.points += row.points ?? 0;
    if (row.kickoffAt && (!prev.first || row.kickoffAt < prev.first)) prev.first = row.kickoffAt;
    if (row.kickoffAt && (!prev.last || row.kickoffAt > prev.last)) prev.last = row.kickoffAt;
    map.set(row.teamId, prev);
  }
  return [...map.values()]
    .sort((a, b) => (b.last ?? "").localeCompare(a.last ?? ""))
    .map((r) => ({
      teamName: r.teamName,
      yearsLabel: [r.first?.slice(0, 4), r.last?.slice(0, 4)].filter(Boolean).join("–") || "—",
      apps: r.apps,
      points: r.points || null,
    }));
}

export async function getPublicPlayerProfile(
  slug: string,
  options: {
    preview?: boolean;
    season?: string | null;
    competition?: string | null;
    view?: PublicPlayerView;
    page?: number;
  } = {},
): Promise<PublicPlayerProfile | null> {
  const db = getDb();
  const [player] = await db.select().from(players).where(eq(players.slug, slug)).limit(1);
  if (!player) return null;

  const preview = Boolean(options.preview);
  if (!preview && !isPubliclyVisible(player)) return null;

  const view: PublicPlayerView = options.view ?? "domestic";
  const seasonFilter = (options.season ?? "current").trim() || "current";
  const competitionFilter = (options.competition ?? "all").trim().toLowerCase() || "all";
  const page = Math.max(1, options.page ?? 1);
  const pageSize = 25;
  const currentDomesticSlug = seasonSlugFromStartYear(currentDomesticSeasonStartYear());

  const clubId = player.clubTeamId;
  const intlId = player.internationalTeamId;

  const [
    clubRow,
    intlRow,
    ratingRow,
    bioRow,
    careerScoring,
    careerStints,
    transferRows,
    status,
    appearanceScope,
    currentCompetitionName,
    injuryRows,
    suspensionRows,
    legendRows,
  ] = await Promise.all([
    clubId
      ? db
          .select({ name: teams.name, slug: teams.slug, imageUrl: teams.imageUrl })
          .from(teams)
          .where(eq(teams.id, clubId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    intlId
      ? db
          .select({ name: teams.name, slug: teams.slug, imageUrl: teams.imageUrl })
          .from(teams)
          .where(eq(teams.id, intlId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db
      .select()
      .from(playerRatings)
      .where(eq(playerRatings.playerId, player.id))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select()
      .from(playerBioProfiles)
      .where(eq(playerBioProfiles.playerId, player.id))
      .limit(1)
      .then((r) => r[0] ?? null),
    getPlayerCareerStats(player.id),
    db
      .select()
      .from(playerCareerStints)
      .where(eq(playerCareerStints.playerId, player.id))
      .orderBy(asc(playerCareerStints.careerType), asc(playerCareerStints.sortOrder)),
    db
      .select({
        id: playerTransfers.id,
        effectiveDate: playerTransfers.effectiveDate,
        fromClub: playerTransfers.fromClub,
        toClub: playerTransfers.toClub,
        fromTeamId: playerTransfers.fromTeamId,
        toTeamId: playerTransfers.toTeamId,
        movementType: playerTransfers.movementType,
        seasonId: playerTransfers.seasonId,
        seasonLabel: competitionSeasons.label,
        competitionName: competitions.name,
      })
      .from(playerTransfers)
      .leftJoin(competitionSeasons, eq(playerTransfers.seasonId, competitionSeasons.id))
      .leftJoin(competitions, eq(playerTransfers.competitionId, competitions.id))
      .where(eq(playerTransfers.playerId, player.id))
      .orderBy(desc(playerTransfers.effectiveDate)),
    resolvePublicStatus({
      playerId: player.id,
      careerStatus: player.careerStatus,
      statusOverride: player.statusOverride,
    }),
    loadPlayerAppearances(player.id, { internationalTeamId: intlId }),
    resolveCurrentClubCompetitionName(clubId),
    db
      .select()
      .from(playerInjuries)
      .where(
        and(
          eq(playerInjuries.playerId, player.id),
          eq(playerInjuries.visibility, "public"),
          eq(playerInjuries.verificationStatus, "confirmed"),
        ),
      )
      .orderBy(desc(playerInjuries.updatedAt)),
    db
      .select()
      .from(playerSuspensions)
      .where(
        and(
          eq(playerSuspensions.playerId, player.id),
          eq(playerSuspensions.visibility, "public"),
          eq(playerSuspensions.verificationStatus, "confirmed"),
        ),
      )
      .orderBy(desc(playerSuspensions.updatedAt)),
    db.select().from(playerLegends).where(eq(playerLegends.playerId, player.id)).limit(5),
  ]);

  const allAppearances = appearanceScope;
  const domesticRows = allAppearances.filter((a) => !a.isInternational);
  const intlAppsRows = allAppearances.filter((a) => a.isInternational);
  const scopedRows = view === "international" ? intlAppsRows : domesticRows;

  const seasonOptions = buildSeasonOptions(scopedRows);

  let filtered = filterAppearances(scopedRows, {
    season: seasonFilter,
    competition: competitionFilter === "all" ? "all" : competitionFilter,
    currentDomesticSlug,
  });

  // When "current" has no appearances yet (e.g. summer transfer), fall back to latest season with data.
  let effectiveSeasonFilter = seasonFilter;
  if (seasonFilter === "current" && filtered.length === 0 && seasonOptions[0]) {
    effectiveSeasonFilter = seasonOptions[0].slug;
    filtered = filterAppearances(scopedRows, {
      season: effectiveSeasonFilter,
      competition: competitionFilter,
      currentDomesticSlug,
    });
  }

  const competitionOptions = buildCompetitionOptions(
    filterAppearances(scopedRows, {
      season: effectiveSeasonFilter,
      competition: "all",
      currentDomesticSlug,
    }),
  );

  const summary = summarizeAppearances(filtered);
  const positionsPlayed = positionBreakdown(allAppearances);

  const intlTries = intlAppsRows.reduce((s, r) => s + (r.tries ?? 0), 0);
  const intlPointsCalc = intlAppsRows.reduce((s, r) => s + (r.points ?? 0), 0);
  const intlCompetitions = [
    ...new Set(intlAppsRows.map((r) => r.competitionName).filter(Boolean) as string[]),
  ];

  const wikiTotals = wikipediaCareerTotals(careerStints);
  const internationalStints = careerStints.filter((s) => s.careerType === "international");
  const clubStints = careerStints.filter((s) => {
    const t = s.careerType.toLowerCase();
    return t === "club" || t === "cup" || t === "provincial" || t === "super";
  });

  const stintIntlApps = internationalStints.reduce((sum, s) => sum + (s.apps ?? 0), 0) || null;
  const stintIntlPoints =
    internationalStints.reduce((sum, s) => sum + (s.points ?? 0), 0) || null;

  const calculatedIntlApps = intlAppsRows.length || null;
  const internationalApps = calculatedIntlApps ?? stintIntlApps;
  const internationalPoints = (intlPointsCalc || null) ?? stintIntlPoints;

  const matchTotal = filtered.length;
  const matchRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const recentFiltered = filtered.slice(0, 5);
  const ratingSeries = filtered
    .filter((r) => r.rating != null)
    .slice(0, 40)
    .reverse()
    .map((r) => ({
      date: r.kickoffAt,
      rating: r.rating as number,
      opponentName: r.opponentName,
      competitionName: r.competitionName,
      fixtureSlug: r.fixtureSlug,
      resultLabel: r.resultLabel,
    }));

  // Match-rating extras for development timeline (POTM, Δ, model version)
  const timelineSource = [...scopedRows]
    .sort((a, b) => (a.kickoffAt ?? "").localeCompare(b.kickoffAt ?? ""))
    .slice(-180);
  const timelineFixtureIds = timelineSource.map((r) => r.fixtureId);
  const matchRatingExtras =
    timelineFixtureIds.length === 0
      ? []
      : await db
          .select({
            fixtureId: playerMatchRatings.fixtureId,
            ratingChange: playerMatchRatings.ratingChange,
            isRugby365Potm: playerMatchRatings.isRugby365Potm,
            modelVersion: playerMatchRatings.modelVersion,
            previousRating: playerMatchRatings.previousRating,
          })
          .from(playerMatchRatings)
          .where(
            and(
              eq(playerMatchRatings.playerId, player.id),
              inArray(playerMatchRatings.fixtureId, timelineFixtureIds),
            ),
          )
          .catch(async () => {
            // Pre-migration fallback without model_version
            return db
              .select({
                fixtureId: playerMatchRatings.fixtureId,
                ratingChange: playerMatchRatings.ratingChange,
                isRugby365Potm: playerMatchRatings.isRugby365Potm,
                previousRating: playerMatchRatings.previousRating,
              })
              .from(playerMatchRatings)
              .where(
                and(
                  eq(playerMatchRatings.playerId, player.id),
                  inArray(playerMatchRatings.fixtureId, timelineFixtureIds),
                ),
              )
              .then((rows) =>
                rows.map((r) => ({ ...r, modelVersion: MATCH_RATING_MODEL })),
              );
          });
  const ratingExtraByFixture = new Map(matchRatingExtras.map((r) => [r.fixtureId, r]));

  const developmentTimeline: DevelopmentTimelinePoint[] = timelineSource.map((r, index, arr) => {
    const extra = ratingExtraByFixture.get(r.fixtureId);
    const annotations: DevelopmentAnnotation[] = [];
    if ((r.tries ?? 0) >= 2) annotations.push("multi_try");
    else if ((r.tries ?? 0) >= 1) annotations.push("try");
    if (extra?.isRugby365Potm) annotations.push("potm");
    if (r.isInternational) annotations.push("intl");
    if (index === 0) annotations.push("debut");
    if (index === 24 || index === 49 || index === 99) annotations.push("milestone");
    if (index > 0 && arr[index - 1] && arr[index - 1]!.teamName !== r.teamName) {
      annotations.push("transfer_debut");
    }
    const scoreLine =
      r.homeScore != null && r.awayScore != null ? `${r.homeScore}–${r.awayScore}` : null;
    return {
      fixtureId: r.fixtureId,
      fixtureSlug: r.fixtureSlug,
      date: r.kickoffAt,
      seasonSlug: r.seasonSlug,
      seasonLabel: r.seasonLabel,
      competitionSlug: r.competitionSlug,
      competitionName: r.competitionName,
      teamName: r.teamName,
      opponentName: r.opponentName,
      homeAway: r.homeAway,
      result: r.result,
      resultLabel: r.resultLabel,
      scoreLine,
      positionName: r.positionName,
      jerseyNumber: r.jerseyNumber,
      started: r.started,
      minutes: r.minutes,
      rating: r.rating,
      ratingChange: extra?.ratingChange ?? null,
      tries: r.tries,
      points: r.points,
      carries: r.carries,
      metresCarried: r.metresCarried,
      tacklesMade: r.tacklesMade,
      isInternational: r.isInternational,
      isPotm: Boolean(extra?.isRugby365Potm),
      modelVersion: extra?.modelVersion ?? (r.rating != null ? MATCH_RATING_MODEL : null),
      annotations,
    };
  });

  // Events for filtered fixtures (cap for perf)
  const eventFixtureIds = filtered.slice(0, 80).map((r) => r.fixtureId);
  const eventRows =
    eventFixtureIds.length === 0
      ? []
      : await db
          .select({
            fixtureId: matchEvents.fixtureId,
            eventType: matchEvents.eventType,
            minute: matchEvents.minute,
            kickoffAt: fixtures.kickoffAt,
            fixtureSlug: fixtures.slug,
            competitionName: fixtures.competitionName,
            homeTeamId: fixtures.homeTeamId,
            awayTeamId: fixtures.awayTeamId,
            homeScore: fixtures.homeScore,
            awayScore: fixtures.awayScore,
            teamId: matchEvents.teamId,
          })
          .from(matchEvents)
          .innerJoin(fixtures, eq(matchEvents.fixtureId, fixtures.id))
          .where(
            and(
              eq(matchEvents.playerId, player.id),
              inArray(matchEvents.fixtureId, eventFixtureIds),
            ),
          )
          .orderBy(desc(fixtures.kickoffAt), asc(matchEvents.minute))
          .limit(100);

  const appearanceByFixture = new Map(filtered.map((a) => [a.fixtureId, a]));
  const events = eventRows
    .map((e) => {
      const label = publicEventLabel(e.eventType);
      if (!label) return null;
      const app = appearanceByFixture.get(e.fixtureId);
      return {
        date: e.kickoffAt?.toISOString() ?? null,
        minute: e.minute,
        eventType: label,
        competitionName: app?.competitionName ?? e.competitionName,
        opponentName: app?.opponentName ?? null,
        teamName: app?.teamName ?? null,
        fixtureSlug: e.fixtureSlug,
        resultLabel: app?.resultLabel ?? null,
      };
    })
    .filter(Boolean) as PublicPlayerProfile["events"];

  const transfers = dedupeTransfersForPublic(transferRows).map((t) => ({
    date: t.date,
    fromLabel: t.fromLabel,
    toLabel: t.toLabel,
    movementType: t.movementType,
    seasonLabel: t.seasonLabel,
    competitionName: t.competitionName,
  }));

  const absences: PublicPlayerProfile["absences"] = [
    ...injuryRows.map((i) => ({
      kind: "injury" as const,
      label: i.injuryType?.trim() || "Injury",
      startDate: i.injuryDate ?? i.dateReported ?? null,
      endDate: i.actualReturnDate ?? i.expectedReturnDate ?? null,
      status: i.status,
      source: i.source,
    })),
    ...suspensionRows.map((s) => ({
      kind: "suspension" as const,
      label: s.offence?.trim() || "Suspension",
      startDate: s.suspensionStart ?? s.incidentDate ?? null,
      endDate: s.suspensionEnd ?? null,
      status: s.status,
      source: s.source,
    })),
  ];

  const achievements: PublicPlayerProfile["achievements"] = [];
  for (const legend of legendRows) {
    const raw = legend.keyAchievements;
    const legendLabel = legend.legendLevel || legend.careerSummary || "Legend honour";
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === "string" && item.trim()) {
          achievements.push({ title: item.trim(), detail: legendLabel });
        } else if (item && typeof item === "object") {
          const rec = item as Record<string, unknown>;
          const title =
            typeof rec.title === "string"
              ? rec.title
              : typeof rec.name === "string"
                ? rec.name
                : null;
          if (title) {
            achievements.push({
              title,
              detail: typeof rec.detail === "string" ? rec.detail : legendLabel,
            });
          }
        }
      }
    }
    if (legend.reason?.trim()) {
      achievements.push({ title: legendLabel, detail: legend.reason.trim() });
    }
  }

  // Factual milestones (not awards)
  if (allAppearances.length > 0) {
    const debut = [...allAppearances].reverse()[0];
    if (debut) {
      achievements.push({
        title: "Debut",
        detail: `${debut.teamName}${debut.kickoffAt ? ` · ${debut.kickoffAt.slice(0, 10)}` : ""}`,
      });
    }
  }
  if (intlAppsRows.length > 0) {
    const debut = [...intlAppsRows].reverse()[0];
    achievements.push({
      title: "International debut (from match records)",
      detail: `${debut?.competitionName ?? "International"}${
        debut?.kickoffAt ? ` · ${debut.kickoffAt.slice(0, 10)}` : ""
      }`,
    });
  }
  for (const n of [25, 50, 100] as const) {
    if (allAppearances.length >= n) {
      achievements.push({
        title: `${n} appearances`,
        detail: "Calculated from Rugby365 match records",
      });
    }
  }

  const { listPublicPlayerGalleryImages } = await import("./player-image-service");
  const { playerImages } = await import("@rugby365/db");
  const [galleryRows, primaryImageRow] = await Promise.all([
    listPublicPlayerGalleryImages(player.id),
    player.primaryImageId
      ? db
          .select({
            altText: playerImages.altText,
            credit: playerImages.credit,
            photographer: playerImages.photographer,
            focalX: playerImages.focalX,
            focalY: playerImages.focalY,
          })
          .from(playerImages)
          .where(eq(playerImages.id, player.primaryImageId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);

  const clubName = clubRow?.name ?? player.clubName;
  const nationName = intlRow?.name ?? player.countryName;
  const bioVariants = bioRow ? readBioVariants(bioRow) : null;
  const biography = bioVariants ? pickBioSectionsForView(bioVariants, view) : null;

  const introOverride =
    player.publicIntroOverride?.trim() ||
    biography?.shortIntro ||
    bioRow?.shortIntro ||
    null;

  const intro = buildPublicPlayerIntro({
    name: player.name,
    positionName: player.positionName,
    countryName: nationName,
    clubName,
    competitionName: currentCompetitionName,
    birthDate: player.birthDate,
    careerAppearances: allAppearances.length || wikiTotals.club.apps || null,
    internationalCaps: internationalApps,
    override: introOverride,
  });

  const viewLabel =
    view === "international" ? "International" : view === "scouting" ? "Scouting" : "Club";
  const seoTitle =
    player.seoTitle?.trim() ||
    `${player.name}: ${viewLabel} Rugby Profile, Stats and Career`;
  const seoDescription =
    player.seoDescription?.trim() ||
    `${player.name} ${viewLabel.toLowerCase()} rugby profile, including appearances, tries, points, ratings and career history.`;

  const social = normalizeSocialAccounts(player.socialAccounts);
  const otherPositions = parsePositions(player.positions).filter(
    (p) => p.toLowerCase() !== (player.positionName ?? "").toLowerCase(),
  );

  const currentRating = ratingRow?.manualOverrideRating ?? ratingRow?.playerRating ?? null;
  const trend = ratingRow?.ratingMovement ?? ratingRow?.formMovement ?? null;
  const lastFive = parseLastFive(ratingRow?.lastFiveMatchRatings);

  const latestSeason = latestRecordedClubSeason(allAppearances);
  const clubHistory =
    clubStints.length > 0
      ? clubStints.map((s) => ({
          teamName: s.teamName,
          yearsLabel: s.yearsLabel,
          apps: s.apps,
          points: s.points,
        }))
      : clubHistoryFromAppearances(allAppearances);

  const internationalHistory =
    internationalStints.length > 0
      ? internationalStints.map((s) => ({
          teamName: s.teamName,
          yearsLabel: s.yearsLabel,
          apps: s.apps,
          points: s.points,
        }))
      : intlAppsRows.length
        ? [
            {
              teamName: nationName ?? "International",
              yearsLabel: [
                intlAppsRows[intlAppsRows.length - 1]?.kickoffAt?.slice(0, 4),
                intlAppsRows[0]?.kickoffAt?.slice(0, 4),
              ]
                .filter(Boolean)
                .join("–"),
              apps: intlAppsRows.length,
              points: intlPointsCalc || null,
            },
          ]
        : [];

  const insights = buildInsights({
    name: player.name,
    seasonLabel: summary.seasonLabel,
    filtered,
    summary,
    positions: positionsPlayed,
  });

  const sourceLabels = ["Rugby365 match data"];
  if (player.wikipediaUrl) sourceLabels.push("Wikipedia");
  if (player.rugbypassUrl) sourceLabels.push("RugbyPass");
  sourceLabels.push("Planet Rugby");

  const canonicalPath = buildPublicPlayerPath({ slug: player.slug, view });

  return {
    slug: player.slug,
    name: player.name,
    fullName: player.fullName,
    imageUrl: player.imageUrl,
    squadNumber: player.squadNumber,
    positionName: player.positionName,
    otherPositions,
    preferredFoot: player.preferredFoot,
    birthDate: player.birthDate,
    birthPlace: player.birthPlace,
    age: calculatePlayerAge(player.birthDate),
    heightCm: player.heightCm,
    weightKg: player.weightKg,
    nationName,
    nationCode: player.nationCode,
    club: clubName
      ? { name: clubName, slug: clubRow?.slug ?? null, imageUrl: clubRow?.imageUrl ?? null }
      : null,
    internationalTeam: nationName
      ? { name: nationName, slug: intlRow?.slug ?? null, imageUrl: intlRow?.imageUrl ?? null }
      : null,
    competitionName: currentCompetitionName,
    latestRecordedSeason:
      latestSeason && clubName && latestSeason.teamName !== clubName ? latestSeason : latestSeason,
    status,
    statusLabel: statusLabel(status),
    careerStatus: careerStatusLabel(player.careerStatus) || player.careerStatus,
    view,
    intro,
    biography,
    rating: {
      current:
        currentRating != null && Number.isFinite(currentRating) ? Math.round(currentRating) : null,
      trend,
      trendLabel: ratingTrendLabel(trend, lastFive.length || summary.ratedAppearances),
      season: ratingRow?.seasonRating ?? summary.ratingAverage,
      lastFive,
      updatedAt: ratingRow?.updatedAt?.toISOString() ?? null,
    },
    seasonSnapshot: filtered.length
      ? {
          seasonLabel: summary.seasonLabel,
          appearances: summary.appearances,
          starts: summary.starts,
          bench: summary.bench,
          minutesPlayed: summary.minutesPlayed,
          tries: summary.tries,
          points: summary.points,
          tryAssists: summary.tryAssists,
          carries: summary.carries,
          metresCarried: summary.metresCarried,
          tacklesMade: summary.tacklesMade,
          tacklesCompleted: summary.tacklesCompleted,
          turnoversWon: summary.turnoversWon,
          lineBreaks: summary.lineBreaks,
          defendersBeaten: summary.defendersBeaten,
          attackRank: summary.attackRank,
          defenceRank: summary.defenceRank,
          ratingAverage: summary.ratingAverage,
          ratedAppearances: summary.ratedAppearances,
        }
      : null,
    filters: {
      season: effectiveSeasonFilter,
      competition: competitionFilter,
      seasonOptions,
      competitionOptions,
    },
    career: {
      appearances: allAppearances.length || null,
      tries: careerScoring.tries || null,
      points: careerScoring.points || null,
      conversions: careerScoring.conversions || null,
      penalties: careerScoring.penalties || null,
      dropGoals: careerScoring.dropGoals || null,
      wikipediaApps: wikiTotals.club.apps || null,
      wikipediaPoints: wikiTotals.club.points || null,
      internationalApps,
      internationalPoints,
    },
    recentForm: recentFiltered.map((r) => ({
      date: r.kickoffAt,
      competitionName: r.competitionName,
      teamName: r.teamName,
      opponentName: r.opponentName,
      result: r.resultLabel,
      homeAway: r.homeAway,
      started: r.started,
      minutes: r.minutes,
      tries: r.tries,
      points: r.points,
      rating: r.rating,
      ratingChange: null,
      fixtureSlug: r.fixtureSlug,
    })),
    matches: {
      page,
      pageSize,
      total: matchTotal,
      rows: matchRows,
    },
    events,
    clubHistory,
    internationalHistory,
    internationalSummary: {
      nation: nationName,
      caps: internationalApps,
      tries: intlTries || null,
      points: internationalPoints,
      competitions: intlCompetitions,
    },
    transfers,
    absences,
    achievements,
    positionsPlayed,
    ratingSeries,
    developmentTimeline,
    developmentChart: (() => {
      const raw = (ratingRow as { developmentChartSettings?: unknown } | null)
        ?.developmentChartSettings;
      const settings =
        raw && typeof raw === "object" && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : {};
      return {
        enabled: settings.enabled !== false,
        showRollingAverage: settings.showRollingAverage !== false,
        showSeasonAverage: settings.showSeasonAverage === true,
        showCareerAverage: settings.showCareerAverage === true,
        minMinutes: typeof settings.minMinutes === "number" ? settings.minMinutes : 0,
        summaryOverride:
          (ratingRow as { developmentSummaryOverride?: string | null } | null)
            ?.developmentSummaryOverride ?? null,
        currentDomesticSlug,
        careerAverage:
          ratingRow?.seasonRating ??
          (ratingRow?.manualOverrideRating ?? ratingRow?.playerRating ?? null),
      };
    })(),
    performanceRadar: await getPublicPlayerRadar({
      playerId: player.id,
      playerName: player.name,
      positionName: player.positionName,
      season: effectiveSeasonFilter,
      competition: competitionFilter,
      view,
    }),
    insights,
    social: {
      twitter: social.twitter ?? null,
      instagram: social.instagram ?? null,
      facebook: social.facebook ?? null,
      website: social.website ?? null,
    },
    sources: {
      wikipediaUrl: player.wikipediaUrl,
      lastVerifiedAt: player.lastVerifiedAt?.toISOString() ?? null,
      profileUpdatedAt:
        player.profileUpdatedAt?.toISOString() ?? ratingRow?.updatedAt?.toISOString() ?? null,
      labels: sourceLabels,
    },
    seo: {
      title: seoTitle,
      description: seoDescription,
      canonicalPath,
      ogImageUrl: player.ogImageUrl ?? player.imageUrl,
      noIndex: preview,
    },
    primaryImage: primaryImageRow
      ? {
          altText: primaryImageRow.altText,
          credit: primaryImageRow.credit ?? primaryImageRow.photographer,
          photographer: primaryImageRow.photographer,
          focalX: primaryImageRow.focalX,
          focalY: primaryImageRow.focalY,
        }
      : null,
    gallery: galleryRows
      .filter((g) => g.role !== "primary")
      .map((g) => ({
        id: g.id,
        imageUrl: g.imageUrl,
        altText: g.altText,
        caption: g.caption,
        credit: g.credit ?? g.photographer,
        imageType: g.imageType,
        role: g.role,
        focalX: g.focalX,
        focalY: g.focalY,
      })),
    preview,
  };
}
