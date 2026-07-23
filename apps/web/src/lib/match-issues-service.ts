import { and, eq, sql } from "drizzle-orm";
import {
  fixturePlayers,
  fixtures,
  playerMatchPerformanceStats,
  providerEntityMappings,
  referees,
  teamMatchStats,
  teams,
  venues,
} from "@rugby365/db";
import { findWikipediaVenueArticleTitles } from "@rugby365/import-sdk";
import { resolveReferee } from "./entity-admin-service";
import {
  findDuplicatesForFixture,
  mergeFixtureDuplicatePair,
  pickCanonicalFixture,
  scoreFixtureForCanonical,
  type FixtureDedupeRow,
} from "./fixture-dedupe-service";
import { getFixtureById, updateFixture } from "./fixture-admin-service";
import {
  collectMatchWarnings,
  type MatchWarning,
  type MatchWarningCode,
} from "./match-cms-warnings";
import { chatCompletion, getOpenAiApiKey, parseJsonObject } from "./openai-client";
import { writeAuditLog } from "./provider-mapping-service";
import { PROVIDER_RUGBY_DATA } from "./provider-mapping-types";
import { getDb } from "./db";
import { resolveVenue } from "./venue-admin-service";

export type MatchIssueSuggestion = {
  id: string;
  field: "venueId" | "refereeId";
  label: string;
  value: string;
  displayName: string;
  source: "home_venue" | "text_resolve" | "wikipedia" | "duplicate" | "create";
  confidence: number;
  detail?: string | null;
  wikipediaUrl?: string | null;
};

export type MatchDuplicateIssue = {
  otherFixtureId: string;
  slug: string;
  status: string;
  score: number;
  recommendedKeeperId: string;
  externalMatchId: string | null;
  venueId: string | null;
  refereeId: string | null;
  homeScore: number;
  awayScore: number;
};

export type MatchVerificationSummary = {
  source: "rules" | "openai";
  summary: string;
  confirmed: string[];
  missing: string[];
  conflicts: string[];
  confidenceScore: number;
  wikiHints: Array<{ label: string; url: string }>;
};

export type MatchIssuesReport = {
  fixtureId: string;
  matchLabel: string;
  status: string;
  issues: Array<MatchWarning & { severity: "error" | "warning" }>;
  suggestions: MatchIssueSuggestion[];
  duplicates: MatchDuplicateIssue[];
  verification: MatchVerificationSummary;
  counts: {
    issueCount: number;
    suggestionCount: number;
    duplicateCount: number;
  };
};

const WIKI_UA = "Rugby365MatchIssues/1.0 (CMS verification; local)";

function wikiArticleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

async function wikiSearchTitles(query: string, limit = 5): Promise<string[]> {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(limit),
    format: "json",
    origin: "*",
  });
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": WIKI_UA },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { query?: { search?: Array<{ title: string }> } };
  return (data.query?.search ?? []).map((hit) => hit.title);
}

function severityFor(code: MatchWarningCode): "error" | "warning" {
  if (
    code === "competition" ||
    code === "season" ||
    code === "home_team" ||
    code === "away_team" ||
    code === "venue" ||
    code === "referee" ||
    code === "duplicate"
  ) {
    return "error";
  }
  return "warning";
}

function issueHref(code: MatchWarningCode): (id: string) => string {
  return (id: string) => {
    if (code === "lineups") return `/admin/matches/${id}/edit#lineups`;
    if (code === "team_stats") return `/admin/matches/${id}/edit#team-stats`;
    if (code === "player_stats") return `/admin/matches/${id}/edit#player-stats`;
    if (code === "primary_mapping") return `/admin/matches/${id}/edit#sources`;
    return `/admin/matches/${id}/edit#issues`;
  };
}

async function loadIssueFlags(fixtureId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: fixtures.id,
      status: fixtures.status,
      competitionId: fixtures.competitionId,
      seasonId: fixtures.seasonId,
      homeTeamId: fixtures.homeTeamId,
      awayTeamId: fixtures.awayTeamId,
      venueId: fixtures.venueId,
      refereeId: fixtures.refereeId,
      venueName: fixtures.venueName,
      refereeName: fixtures.refereeName,
      kickoffAt: fixtures.kickoffAt,
      homeScore: fixtures.homeScore,
      awayScore: fixtures.awayScore,
      externalMatchId: fixtures.externalMatchId,
      sport365Url: fixtures.sport365Url,
      planetRugbyUrl: fixtures.planetRugbyUrl,
      hasLineups: sql<boolean>`(
        exists(select 1 from ${fixturePlayers} fp where fp.fixture_id = ${fixtures.id})
        or (${fixtures.providerSnapshot} -> 'lineups') is not null
      )`,
      hasTeamStats: sql<boolean>`exists(
        select 1 from ${teamMatchStats} tms where tms.fixture_id = ${fixtures.id}
      )`,
      hasPlayerStats: sql<boolean>`exists(
        select 1 from ${playerMatchPerformanceStats} pms where pms.fixture_id = ${fixtures.id}
      )`,
    })
    .from(fixtures)
    .where(eq(fixtures.id, fixtureId))
    .limit(1);

  if (!row) return null;

  const [mapping] = await db
    .select({ externalId: providerEntityMappings.externalId })
    .from(providerEntityMappings)
    .where(
      and(
        eq(providerEntityMappings.entityType, "match"),
        eq(providerEntityMappings.provider, PROVIDER_RUGBY_DATA),
        eq(providerEntityMappings.status, "confirmed"),
        eq(providerEntityMappings.rugby365Id, fixtureId),
      ),
    )
    .limit(1);

  return {
    ...row,
    primaryApiMatchId: mapping?.externalId ?? null,
  };
}

async function buildVenueSuggestions(input: {
  venueId: string | null;
  venueName: string | null;
  homeTeamId: string | null;
  duplicates: FixtureDedupeRow[];
}): Promise<MatchIssueSuggestion[]> {
  if (input.venueId) return [];
  const out: MatchIssueSuggestion[] = [];
  const seen = new Set<string>();
  const push = (s: MatchIssueSuggestion) => {
    if (seen.has(s.value)) return;
    seen.add(s.value);
    out.push(s);
  };

  const db = getDb();

  if (input.homeTeamId) {
    const [team] = await db
      .select({ homeVenueId: teams.homeVenueId, name: teams.name })
      .from(teams)
      .where(eq(teams.id, input.homeTeamId))
      .limit(1);
    if (team?.homeVenueId) {
      const [venue] = await db.select().from(venues).where(eq(venues.id, team.homeVenueId)).limit(1);
      if (venue) {
        push({
          id: `venue-home-${venue.id}`,
          field: "venueId",
          label: "Use home club venue",
          value: venue.id,
          displayName: venue.name,
          source: "home_venue",
          confidence: 0.85,
          detail: `${team.name} home ground`,
          wikipediaUrl: venue.wikipediaUrl,
        });
      }
    }
  }

  for (const dup of input.duplicates) {
    if (!dup.venueId) continue;
    const [venue] = await db.select().from(venues).where(eq(venues.id, dup.venueId)).limit(1);
    if (!venue) continue;
    push({
      id: `venue-dup-${venue.id}`,
      field: "venueId",
      label: "Copy venue from duplicate",
      value: venue.id,
      displayName: venue.name,
      source: "duplicate",
      confidence: 0.8,
      detail: `From ${dup.slug}`,
      wikipediaUrl: venue.wikipediaUrl,
    });
  }

  const textName = input.venueName?.trim();
  if (textName) {
    const resolved = await resolveVenue({
      name: textName,
      teamId: input.homeTeamId ?? undefined,
      createIfMissing: false,
    });
    if (resolved) {
      push({
        id: `venue-text-${resolved.id}`,
        field: "venueId",
        label: "Match venue name in CMS",
        value: resolved.id,
        displayName: resolved.name,
        source: "text_resolve",
        confidence: 0.9,
        detail: `Resolved from “${textName}”`,
        wikipediaUrl: resolved.wikipediaUrl,
      });
    }

    try {
      const titles = await findWikipediaVenueArticleTitles(textName);
      for (const title of titles.slice(0, 3)) {
        const slugKey = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const [byWiki] = await db
          .select()
          .from(venues)
          .where(eq(venues.wikipediaUrl, wikiArticleUrl(title)))
          .limit(1);
        const [byName] = byWiki
          ? [byWiki]
          : await db
              .select()
              .from(venues)
              .where(sql`lower(${venues.name}) = ${title.toLowerCase()}`)
              .limit(1);
        if (byName) {
          push({
            id: `venue-wiki-${byName.id}`,
            field: "venueId",
            label: "Wikipedia match in CMS",
            value: byName.id,
            displayName: byName.name,
            source: "wikipedia",
            confidence: 0.75,
            detail: title,
            wikipediaUrl: wikiArticleUrl(title),
          });
        } else {
          out.push({
            id: `venue-wiki-create-${slugKey}`,
            field: "venueId",
            label: "Create venue from Wikipedia",
            value: `__create__:${title}`,
            displayName: title,
            source: "create",
            confidence: 0.55,
            detail: "Will create a CMS venue from the Wikipedia title",
            wikipediaUrl: wikiArticleUrl(title),
          });
        }
      }
    } catch {
      /* wiki optional */
    }
  }

  return out.sort((a, b) => b.confidence - a.confidence);
}

async function buildRefereeSuggestions(input: {
  refereeId: string | null;
  refereeName: string | null;
  duplicates: FixtureDedupeRow[];
}): Promise<MatchIssueSuggestion[]> {
  if (input.refereeId) return [];
  const out: MatchIssueSuggestion[] = [];
  const seen = new Set<string>();
  const push = (s: MatchIssueSuggestion) => {
    if (seen.has(s.value)) return;
    seen.add(s.value);
    out.push(s);
  };
  const db = getDb();

  for (const dup of input.duplicates) {
    if (!dup.refereeId) continue;
    const [ref] = await db.select().from(referees).where(eq(referees.id, dup.refereeId)).limit(1);
    if (!ref) continue;
    push({
      id: `ref-dup-${ref.id}`,
      field: "refereeId",
      label: "Copy referee from duplicate",
      value: ref.id,
      displayName: ref.name,
      source: "duplicate",
      confidence: 0.8,
      detail: `From ${dup.slug}`,
      wikipediaUrl: ref.wikipediaUrl,
    });
  }

  const textName = input.refereeName?.trim();
  if (textName) {
    const resolved = await resolveReferee({ name: textName, createIfMissing: false });
    if (resolved) {
      push({
        id: `ref-text-${resolved.id}`,
        field: "refereeId",
        label: "Match referee name in CMS",
        value: resolved.id,
        displayName: resolved.name,
        source: "text_resolve",
        confidence: 0.9,
        detail: `Resolved from “${textName}”`,
        wikipediaUrl: resolved.wikipediaUrl,
      });
    } else {
      out.push({
        id: `ref-create-${textName.toLowerCase().replace(/\s+/g, "-")}`,
        field: "refereeId",
        label: "Create referee from name",
        value: `__create__:${textName}`,
        displayName: textName,
        source: "create",
        confidence: 0.6,
        detail: "Creates a CMS referee record and links it",
      });
    }

    try {
      const titles = await wikiSearchTitles(`"${textName}" rugby referee`, 4);
      for (const title of titles.slice(0, 3)) {
        const [byWiki] = await db
          .select()
          .from(referees)
          .where(eq(referees.wikipediaUrl, wikiArticleUrl(title)))
          .limit(1);
        if (byWiki) {
          push({
            id: `ref-wiki-${byWiki.id}`,
            field: "refereeId",
            label: "Wikipedia match in CMS",
            value: byWiki.id,
            displayName: byWiki.name,
            source: "wikipedia",
            confidence: 0.72,
            detail: title,
            wikipediaUrl: wikiArticleUrl(title),
          });
        } else {
          out.push({
            id: `ref-wiki-hint-${title.toLowerCase().replace(/\s+/g, "-")}`,
            field: "refereeId",
            label: "Wikipedia candidate",
            value: `__create__:${title}`,
            displayName: title,
            source: "wikipedia",
            confidence: 0.5,
            detail: "Create referee from Wikipedia title",
            wikipediaUrl: wikiArticleUrl(title),
          });
        }
      }
    } catch {
      /* wiki optional */
    }
  }

  return out.sort((a, b) => b.confidence - a.confidence);
}

function buildRuleVerification(input: {
  issues: Array<MatchWarning & { severity: "error" | "warning" }>;
  suggestions: MatchIssueSuggestion[];
  duplicates: MatchDuplicateIssue[];
  fixture: {
    venueId: string | null;
    refereeId: string | null;
    homeScore: number;
    awayScore: number;
    status: string;
    competitionId: string | null;
    seasonId: string | null;
    planetRugbyUrl: string | null;
    sport365Url: string | null;
  };
  homeName: string;
  awayName: string;
}): MatchVerificationSummary {
  const confirmed: string[] = [];
  const missing = input.issues.filter((i) => i.code !== "duplicate").map((i) => i.label);
  const conflicts: string[] = [];

  if (input.fixture.competitionId) confirmed.push("Competition mapped");
  if (input.fixture.seasonId) confirmed.push("Season mapped");
  if (input.fixture.venueId) confirmed.push("Venue linked");
  if (input.fixture.refereeId) confirmed.push("Referee linked");
  if (input.fixture.status === "full_time") {
    confirmed.push(`Final score ${input.fixture.homeScore}–${input.fixture.awayScore}`);
  }
  if (input.fixture.planetRugbyUrl) confirmed.push("Planet Rugby URL");
  if (input.fixture.sport365Url) confirmed.push("Sport365 URL");
  if (input.duplicates.length) {
    conflicts.push(
      `${input.duplicates.length} duplicate fixture(s) for ${input.homeName} vs ${input.awayName} on the same day`,
    );
  }

  const wikiHints = input.suggestions
    .filter((s) => s.wikipediaUrl)
    .slice(0, 6)
    .map((s) => ({ label: s.displayName, url: s.wikipediaUrl! }));

  const confidenceScore = Math.max(
    0.15,
    Math.min(
      0.95,
      0.55 +
        confirmed.length * 0.05 -
        missing.length * 0.07 -
        input.duplicates.length * 0.12 +
        Math.min(input.suggestions.length, 3) * 0.03,
    ),
  );

  return {
    source: "rules",
    summary: `${input.homeName} vs ${input.awayName}: ${missing.length} gap(s), ${input.suggestions.length} fix suggestion(s), ${input.duplicates.length} duplicate(s).`,
    confirmed,
    missing,
    conflicts,
    confidenceScore,
    wikiHints,
  };
}

async function enrichWithOpenAi(
  report: MatchIssuesReport,
): Promise<MatchVerificationSummary | null> {
  const key = await getOpenAiApiKey();
  if (!key) return null;

  const system = `You are Rugby365's post-match verification assistant.
Use ONLY the provided CMS snapshot. OpenAI is not authoritative.
Wikipedia and CMS database remain sources of truth.
Return strict JSON: summary, confirmed (string[]), missing (string[]), conflicts (string[]), confidenceScore (0-1).
Focus on venue, referee, scores, mapping gaps, and duplicates. Do not invent facts.`;

  const user = `Verify this match after the game.

Report JSON:
${JSON.stringify(
    {
      matchLabel: report.matchLabel,
      status: report.status,
      issues: report.issues.map((i) => ({ code: i.code, label: i.label, severity: i.severity })),
      suggestions: report.suggestions.map((s) => ({
        field: s.field,
        displayName: s.displayName,
        source: s.source,
        confidence: s.confidence,
        detail: s.detail,
      })),
      duplicates: report.duplicates,
      verification: report.verification,
    },
    null,
    2,
  )}`;

  const raw = await chatCompletion({ system, user, json: true, maxTokens: 1200 });
  const parsed = parseJsonObject<{
    summary?: string;
    confirmed?: string[];
    missing?: string[];
    conflicts?: string[];
    confidenceScore?: number;
  }>(raw, {});

  return {
    source: "openai",
    summary: parsed.summary?.trim() || report.verification.summary,
    confirmed: Array.isArray(parsed.confirmed) ? parsed.confirmed.map(String) : report.verification.confirmed,
    missing: Array.isArray(parsed.missing) ? parsed.missing.map(String) : report.verification.missing,
    conflicts: Array.isArray(parsed.conflicts)
      ? parsed.conflicts.map(String)
      : report.verification.conflicts,
    confidenceScore:
      typeof parsed.confidenceScore === "number"
        ? parsed.confidenceScore
        : report.verification.confidenceScore,
    wikiHints: report.verification.wikiHints,
  };
}

export async function getMatchIssuesReport(
  fixtureId: string,
  options?: { useAi?: boolean },
): Promise<MatchIssuesReport | null> {
  const flags = await loadIssueFlags(fixtureId);
  if (!flags) return null;

  const fixture = await getFixtureById(fixtureId);
  if (!fixture) return null;

  const homeName = fixture.homeTeam?.name ?? "Home";
  const awayName = fixture.awayTeam?.name ?? "Away";

  const peerRows = await findDuplicatesForFixture(fixtureId);
  const selfAsRow: FixtureDedupeRow = {
    id: fixture.id,
    slug: fixture.slug,
    homeTeamId: fixture.homeTeamId,
    awayTeamId: fixture.awayTeamId,
    kickoffAt: fixture.kickoffAt,
    competitionId: fixture.competitionId,
    seasonId: fixture.seasonId,
    competitionName: fixture.competitionName,
    status: fixture.status,
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
    sport365Url: fixture.sport365Url,
    planetRugbyUrl: fixture.planetRugbyUrl,
    externalMatchId: fixture.externalMatchId,
    venueId: fixture.venueId,
    venueName: fixture.venueName,
    attendance: fixture.attendance,
    refereeId: fixture.refereeId,
    refereeName: fixture.refereeName,
    homeCoachId: fixture.homeCoachId,
    awayCoachId: fixture.awayCoachId,
    round: fixture.round,
    providerSnapshot: fixture.providerSnapshot,
    rugby365PotmPlayerId: fixture.rugby365PotmPlayerId,
    officialPotmPlayerId: fixture.officialPotmPlayerId,
    officialPotmName: fixture.officialPotmName,
  };

  const duplicates: MatchDuplicateIssue[] = peerRows.map((peer) => {
    const keeper = pickCanonicalFixture([selfAsRow, peer]);
    return {
      otherFixtureId: peer.id,
      slug: peer.slug,
      status: peer.status,
      score: scoreFixtureForCanonical(peer),
      recommendedKeeperId: keeper.id,
      externalMatchId: peer.externalMatchId,
      venueId: peer.venueId,
      refereeId: peer.refereeId,
      homeScore: peer.homeScore,
      awayScore: peer.awayScore,
    };
  });

  const issues: Array<MatchWarning & { severity: "error" | "warning" }> = collectMatchWarnings({
    competitionId: flags.competitionId,
    seasonId: flags.seasonId,
    homeTeamId: flags.homeTeamId,
    awayTeamId: flags.awayTeamId,
    venueId: flags.venueId,
    refereeId: flags.refereeId,
    hasLineups: Boolean(flags.hasLineups),
    hasTeamStats: Boolean(flags.hasTeamStats),
    hasPlayerStats: Boolean(flags.hasPlayerStats),
    primaryApiMatchId: flags.primaryApiMatchId,
    status: flags.status,
  }).map((w) => ({
    ...w,
    href: issueHref(w.code),
    severity: severityFor(w.code),
  }));

  if (duplicates.length) {
    issues.unshift({
      code: "duplicate",
      label: `Possible duplicate (${duplicates.length})`,
      actionLabel: "Merge duplicate",
      href: issueHref("duplicate"),
      severity: "error",
    });
  }

  const suggestions = [
    ...(await buildVenueSuggestions({
      venueId: flags.venueId,
      venueName: flags.venueName,
      homeTeamId: flags.homeTeamId,
      duplicates: peerRows,
    })),
    ...(await buildRefereeSuggestions({
      refereeId: flags.refereeId,
      refereeName: flags.refereeName,
      duplicates: peerRows,
    })),
  ];

  const verification = buildRuleVerification({
    issues,
    suggestions,
    duplicates,
    fixture: flags,
    homeName,
    awayName,
  });

  const report: MatchIssuesReport = {
    fixtureId,
    matchLabel: `${homeName} vs ${awayName}`,
    status: flags.status,
    issues,
    suggestions,
    duplicates,
    verification,
    counts: {
      issueCount: issues.length,
      suggestionCount: suggestions.length,
      duplicateCount: duplicates.length,
    },
  };

  if (options?.useAi) {
    try {
      const ai = await enrichWithOpenAi(report);
      if (ai) report.verification = ai;
    } catch (e) {
      report.verification = {
        ...verification,
        summary: `${verification.summary} (AI verify skipped: ${e instanceof Error ? e.message : "error"})`,
      };
    }
  }

  return report;
}

export async function applyMatchIssueSuggestion(
  fixtureId: string,
  suggestion: Pick<MatchIssueSuggestion, "field" | "value" | "source" | "displayName">,
) {
  let value = suggestion.value;

  if (value.startsWith("__create__:")) {
    const name = value.slice("__create__:".length).trim();
    if (!name) throw new Error("Missing create name");
    if (suggestion.field === "venueId") {
      const fixture = await getFixtureById(fixtureId);
      const venue = await resolveVenue({
        name,
        teamId: fixture?.homeTeamId ?? undefined,
        createIfMissing: true,
      });
      if (!venue) throw new Error("Could not create venue");
      value = venue.id;
    } else {
      const ref = await resolveReferee({ name, createIfMissing: true });
      if (!ref) throw new Error("Could not create referee");
      value = ref.id;
    }
  }

  if (suggestion.field === "venueId") {
    await updateFixture(fixtureId, { venueId: value });
  } else {
    await updateFixture(fixtureId, { refereeId: value });
  }

  await writeAuditLog({
    entityType: "match",
    entityId: fixtureId,
    action: "match_issue_fix_applied",
    field: suggestion.field,
    newValue: { value, displayName: suggestion.displayName, source: suggestion.source },
    source: suggestion.source,
  });

  return getMatchIssuesReport(fixtureId);
}

export async function mergeMatchDuplicate(
  fixtureId: string,
  otherFixtureId: string,
  options?: { keep?: "this" | "other" | "recommended" },
) {
  const peers = await findDuplicatesForFixture(fixtureId);
  const other = peers.find((p) => p.id === otherFixtureId);
  if (!other) throw new Error("Selected fixture is not a duplicate of this match");

  const self = await getFixtureById(fixtureId);
  if (!self) throw new Error("Match not found");

  const selfRow = {
    ...self,
    competitionName: self.competitionName,
  } as FixtureDedupeRow;

  const recommended = pickCanonicalFixture([selfRow, other]);
  const keep = options?.keep ?? "recommended";
  const keeperId =
    keep === "this" ? fixtureId : keep === "other" ? otherFixtureId : recommended.id;
  const loserId = keeperId === fixtureId ? otherFixtureId : fixtureId;

  const action = await mergeFixtureDuplicatePair({ keeperId, loserId, dryRun: false });

  await writeAuditLog({
    entityType: "match",
    entityId: keeperId,
    action: "match_duplicate_merged",
    newValue: action,
    source: "cms",
  });

  return { action, keeperId };
}
