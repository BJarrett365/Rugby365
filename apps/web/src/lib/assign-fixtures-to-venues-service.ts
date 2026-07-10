import { alias } from "drizzle-orm/pg-core";
import { and, eq, isNull, or } from "drizzle-orm";
import { fixtures, teams, venues } from "@rugby365/db";
import { getDb } from "./db";
import {
  buildVenueResolver,
  primaryFixtureVenueLabel,
  type CmsVenueRef,
  type FixtureVenueMatch,
} from "./venue-fixture-resolve-service";

const homeTeam = alias(teams, "home_team");
const awayTeam = alias(teams, "away_team");

export type FixtureVenueAssignmentPreview = {
  fixtureId: string;
  slug: string;
  kickoffAt: string | null;
  competitionName: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  venueName: string | null;
  currentVenueId: string | null;
  currentVenueName: string | null;
  suggestedVenueId: string | null;
  suggestedVenueName: string | null;
  matchMethod: FixtureVenueMatch["method"] | null;
};

export type AssignFixturesToVenuesResult = {
  fixturesProcessed: number;
  mapped: number;
  alreadyMapped: number;
  unresolved: number;
  failures: Array<{ fixtureId: string; error: string }>;
  previews: FixtureVenueAssignmentPreview[];
};

async function loadCmsVenues(): Promise<CmsVenueRef[]> {
  const db = getDb();
  return db
    .select({
      id: venues.id,
      name: venues.name,
      slug: venues.slug,
      city: venues.city,
      countryName: venues.countryName,
      teamId: venues.teamId,
    })
    .from(venues);
}

type FixtureJoinRow = {
  fixture: typeof fixtures.$inferSelect;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeVenueId: string | null;
  linkedVenueName: string | null;
};

async function loadFixtureRows(options?: { fixtureId?: string; unmappedOnly?: boolean }) {
  const db = getDb();
  const query = db
    .select({
      fixture: fixtures,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      homeVenueId: homeTeam.homeVenueId,
      linkedVenueName: venues.name,
    })
    .from(fixtures)
    .leftJoin(homeTeam, eq(fixtures.homeTeamId, homeTeam.id))
    .leftJoin(awayTeam, eq(fixtures.awayTeamId, awayTeam.id))
    .leftJoin(venues, eq(fixtures.venueId, venues.id));

  if (options?.fixtureId) {
    return query.where(eq(fixtures.id, options.fixtureId));
  }

  if (options?.unmappedOnly !== false) {
    return query.where(isNull(fixtures.venueId));
  }

  return query;
}

function buildPreviewRow(row: FixtureJoinRow, match: FixtureVenueMatch | null): FixtureVenueAssignmentPreview {
  return {
    fixtureId: row.fixture.id,
    slug: row.fixture.slug,
    kickoffAt: row.fixture.kickoffAt?.toISOString() ?? null,
    competitionName: row.fixture.competitionName,
    homeTeamName: row.homeTeamName,
    awayTeamName: row.awayTeamName,
    venueName: row.fixture.venueName,
    currentVenueId: row.fixture.venueId,
    currentVenueName: row.linkedVenueName,
    suggestedVenueId: match?.venue.id ?? null,
    suggestedVenueName: match?.venue.name ?? null,
    matchMethod: match?.method ?? null,
  };
}

export async function previewFixtureVenueAssignments(input?: {
  fixtureId?: string;
  limit?: number;
}): Promise<FixtureVenueAssignmentPreview[]> {
  const cmsVenues = await loadCmsVenues();
  const resolver = buildVenueResolver(cmsVenues);
  const rows = await loadFixtureRows({ fixtureId: input?.fixtureId, unmappedOnly: true });
  const limit = input?.limit ?? 200;

  return rows.slice(0, limit).map((row) => {
    const match = resolver.resolveFixtureVenue({
      venueName: row.fixture.venueName,
      homeTeamId: row.fixture.homeTeamId,
      homeVenueId: row.homeVenueId,
    });
    return buildPreviewRow(row, match);
  });
}

export async function assignFixturesToVenues(input?: {
  fixtureId?: string;
  venueId?: string;
  dryRun?: boolean;
}): Promise<AssignFixturesToVenuesResult> {
  const db = getDb();
  const cmsVenues = await loadCmsVenues();
  const resolver = buildVenueResolver(cmsVenues);
  const rows = await loadFixtureRows({
    fixtureId: input?.fixtureId,
    unmappedOnly: !input?.fixtureId,
  });

  const result: AssignFixturesToVenuesResult = {
    fixturesProcessed: 0,
    mapped: 0,
    alreadyMapped: 0,
    unresolved: 0,
    failures: [],
    previews: [],
  };

  for (const row of rows) {
    result.fixturesProcessed += 1;
    try {
      if (row.fixture.venueId && !input?.fixtureId) {
        result.alreadyMapped += 1;
        continue;
      }

      const manualVenue = input?.venueId ? resolver.byId.get(input.venueId) : undefined;
      const match =
        manualVenue != null
          ? ({ venue: manualVenue, method: "exact" as const })
          : resolver.resolveFixtureVenue({
              venueName: row.fixture.venueName,
              homeTeamId: row.fixture.homeTeamId,
              homeVenueId: row.homeVenueId,
            });

      const preview = buildPreviewRow(row, match);
      result.previews.push(preview);

      if (!match) {
        result.unresolved += 1;
        continue;
      }

      if (!input?.dryRun) {
        await db
          .update(fixtures)
          .set({
            venueId: match.venue.id,
            venueName: row.fixture.venueName ?? primaryFixtureVenueLabel(match.venue.name),
          })
          .where(eq(fixtures.id, row.fixture.id));
      }

      result.mapped += 1;
    } catch (error) {
      result.failures.push({
        fixtureId: row.fixture.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
