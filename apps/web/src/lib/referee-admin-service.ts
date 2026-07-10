import { alias, and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { fixtures, matchEvents, players, referees, teams } from "@rugby365/db";
import { getDb } from "./db";

const CARD_EVENT_TYPES = ["yellow_card", "red_card"] as const;

export type RefereeCardEvent = {
  id: string;
  fixtureId: string;
  eventType: "yellow_card" | "red_card";
  minute: number;
  playerName: string | null;
  teamName: string | null;
  fixtureLabel: string | null;
  kickoffAt: string | null;
};

export type RefereeFixtureRow = {
  id: string;
  slug: string;
  kickoffAt: string | null;
  status: string;
  competitionName: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  homeScore: number;
  awayScore: number;
  linkedBy: "referee_id" | "referee_name";
  yellowCount: number;
  redCount: number;
};

export type RefereeListRow = typeof referees.$inferSelect & {
  matchCount: number;
  yellowCardCount: number;
  redCardCount: number;
};

export type RefereeDetail = {
  referee: typeof referees.$inferSelect;
  fixtures: RefereeFixtureRow[];
  yellowCards: RefereeCardEvent[];
  redCards: RefereeCardEvent[];
  stats: {
    matchCount: number;
    yellowCardCount: number;
    redCardCount: number;
    nameOnlyMatchCount: number;
  };
};

function fixtureLabel(home: string | null, away: string | null) {
  if (home && away) return `${home} vs ${away}`;
  return home ?? away ?? "Fixture";
}

function normalizeRefereeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function listRefereesWithStats(): Promise<RefereeListRow[]> {
  const db = getDb();
  const rows = await db.select().from(referees).orderBy(asc(referees.name));

  const matchCounts = await db
    .select({
      refereeId: fixtures.refereeId,
      count: sql<number>`count(*)::int`,
    })
    .from(fixtures)
    .where(sql`${fixtures.refereeId} is not null`)
    .groupBy(fixtures.refereeId);

  const cardCounts = await db
    .select({
      refereeId: fixtures.refereeId,
      eventType: matchEvents.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(matchEvents)
    .innerJoin(fixtures, eq(matchEvents.fixtureId, fixtures.id))
    .where(
      and(
        sql`${fixtures.refereeId} is not null`,
        inArray(matchEvents.eventType, [...CARD_EVENT_TYPES]),
      ),
    )
    .groupBy(fixtures.refereeId, matchEvents.eventType);

  const matchByRef = Object.fromEntries(
    matchCounts.filter((row) => row.refereeId).map((row) => [row.refereeId!, row.count]),
  );
  const yellowByRef: Record<string, number> = {};
  const redByRef: Record<string, number> = {};
  for (const row of cardCounts) {
    if (!row.refereeId) continue;
    if (row.eventType === "yellow_card") yellowByRef[row.refereeId] = row.count;
    if (row.eventType === "red_card") redByRef[row.refereeId] = row.count;
  }

  return rows.map((row) => ({
    ...row,
    matchCount: matchByRef[row.id] ?? 0,
    yellowCardCount: yellowByRef[row.id] ?? 0,
    redCardCount: redByRef[row.id] ?? 0,
  }));
}

export async function getRefereeDetail(id: string): Promise<RefereeDetail | null> {
  const db = getDb();
  const [referee] = await db.select().from(referees).where(eq(referees.id, id)).limit(1);
  if (!referee) return null;

  const homeTeams = alias(teams, "home_teams");
  const awayTeams = alias(teams, "away_teams");
  const normalizedName = normalizeRefereeName(referee.name);

  const linkedFixtureRows = await db
    .select({
      fixture: fixtures,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
    })
    .from(fixtures)
    .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
    .where(eq(fixtures.refereeId, id))
    .orderBy(desc(fixtures.kickoffAt));

  const nameMatchedRows = await db
    .select({
      fixture: fixtures,
      homeTeamName: homeTeams.name,
      awayTeamName: awayTeams.name,
    })
    .from(fixtures)
    .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
    .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
    .where(
      and(
        isNull(fixtures.refereeId),
        sql`lower(trim(${fixtures.refereeName})) = ${normalizedName}`,
      ),
    )
    .orderBy(desc(fixtures.kickoffAt));

  const fixtureMap = new Map<string, RefereeFixtureRow>();
  for (const row of linkedFixtureRows) {
    fixtureMap.set(row.fixture.id, {
      id: row.fixture.id,
      slug: row.fixture.slug,
      kickoffAt: row.fixture.kickoffAt?.toISOString() ?? null,
      status: row.fixture.status,
      competitionName: row.fixture.competitionName,
      homeTeamName: row.homeTeamName,
      awayTeamName: row.awayTeamName,
      homeScore: row.fixture.homeScore,
      awayScore: row.fixture.awayScore,
      linkedBy: "referee_id",
      yellowCount: 0,
      redCount: 0,
    });
  }
  for (const row of nameMatchedRows) {
    if (fixtureMap.has(row.fixture.id)) continue;
    fixtureMap.set(row.fixture.id, {
      id: row.fixture.id,
      slug: row.fixture.slug,
      kickoffAt: row.fixture.kickoffAt?.toISOString() ?? null,
      status: row.fixture.status,
      competitionName: row.fixture.competitionName,
      homeTeamName: row.homeTeamName,
      awayTeamName: row.awayTeamName,
      homeScore: row.fixture.homeScore,
      awayScore: row.fixture.awayScore,
      linkedBy: "referee_name",
      yellowCount: 0,
      redCount: 0,
    });
  }

  const fixtureRows = [...fixtureMap.values()].sort((a, b) =>
    (b.kickoffAt ?? "").localeCompare(a.kickoffAt ?? ""),
  );
  const fixtureIds = fixtureRows.map((row) => row.id);

  const yellowCards: RefereeCardEvent[] = [];
  const redCards: RefereeCardEvent[] = [];

  if (fixtureIds.length > 0) {
    const cardRows = await db
      .select({
        event: matchEvents,
        playerName: players.name,
        teamName: teams.name,
        homeTeamName: homeTeams.name,
        awayTeamName: awayTeams.name,
        kickoffAt: fixtures.kickoffAt,
      })
      .from(matchEvents)
      .innerJoin(fixtures, eq(matchEvents.fixtureId, fixtures.id))
      .leftJoin(players, eq(matchEvents.playerId, players.id))
      .leftJoin(teams, eq(matchEvents.teamId, teams.id))
      .leftJoin(homeTeams, eq(fixtures.homeTeamId, homeTeams.id))
      .leftJoin(awayTeams, eq(fixtures.awayTeamId, awayTeams.id))
      .where(
        and(
          inArray(matchEvents.fixtureId, fixtureIds),
          inArray(matchEvents.eventType, [...CARD_EVENT_TYPES]),
        ),
      )
      .orderBy(desc(fixtures.kickoffAt), desc(matchEvents.minute));

    for (const row of cardRows) {
      const fixture = fixtureMap.get(row.event.fixtureId);
      if (!fixture) continue;

      const card: RefereeCardEvent = {
        id: row.event.id,
        fixtureId: row.event.fixtureId,
        eventType: row.event.eventType as "yellow_card" | "red_card",
        minute: row.event.minute,
        playerName: row.playerName,
        teamName: row.teamName,
        fixtureLabel: fixtureLabel(row.homeTeamName, row.awayTeamName),
        kickoffAt: row.kickoffAt?.toISOString() ?? fixture.kickoffAt,
      };

      if (card.eventType === "yellow_card") {
        fixture.yellowCount += 1;
        yellowCards.push(card);
      } else {
        fixture.redCount += 1;
        redCards.push(card);
      }
    }
  }

  const nameOnlyMatchCount = fixtureRows.filter((row) => row.linkedBy === "referee_name").length;

  return {
    referee,
    fixtures: fixtureRows,
    yellowCards,
    redCards,
    stats: {
      matchCount: fixtureRows.length,
      yellowCardCount: yellowCards.length,
      redCardCount: redCards.length,
      nameOnlyMatchCount,
    },
  };
}

/** Link fixtures that only have referee_name text to this referee record. */
export async function linkRefereeNameOnlyFixtures(refereeId: string) {
  const db = getDb();
  const [referee] = await db.select().from(referees).where(eq(referees.id, refereeId)).limit(1);
  if (!referee) throw new Error("Referee not found");

  const normalizedName = normalizeRefereeName(referee.name);
  const updated = await db
    .update(fixtures)
    .set({ refereeId })
    .where(
      and(
        isNull(fixtures.refereeId),
        or(
          sql`lower(trim(${fixtures.refereeName})) = ${normalizedName}`,
          eq(fixtures.refereeName, referee.name),
        ),
      ),
    )
    .returning({ id: fixtures.id });

  return { linked: updated.length };
}
