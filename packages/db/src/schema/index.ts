import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  date,
  real,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const suggestionStatusEnum = pgEnum("suggestion_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
]);

export const sports = pgTable("sports", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  rulesConfig: jsonb("rules_config"),
});

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    externalProviderId: text("external_provider_id"),
    sourceProvider: text("source_provider").notNull().default("manual"),
    homeVenueId: uuid("home_venue_id"),
    countryName: text("country_name"),
    hemisphere: text("hemisphere"),
    region: text("region"),
    teamType: text("team_type"),
    foundedYear: integer("founded_year"),
    imageUrl: text("image_url"),
    bioSummary: text("bio_summary"),
    wikipediaUrl: text("wikipedia_url"),
    wikidataId: text("wikidata_id"),
    archiveSyncedAt: timestamp("archive_synced_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("teams_external_provider_id_unique")
      .on(table.externalProviderId)
      .where(sql`${table.externalProviderId} is not null`),
  ],
);

export const competitions = pgTable(
  "competitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    externalProviderId: text("external_provider_id"),
    sourceProvider: text("source_provider").notNull().default("manual"),
    stageExternalId: text("stage_external_id"),
    stageName: text("stage_name"),
    competitionType: text("competition_type").notNull().default("domestic"),
    sdmsCompCode: text("sdms_comp_code"),
    planetRugbySlug: text("planet_rugby_slug"),
    bioSummary: text("bio_summary"),
    wikipediaUrl: text("wikipedia_url"),
    wikidataId: text("wikidata_id"),
    archiveSyncedAt: timestamp("archive_synced_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("competitions_external_provider_id_unique")
      .on(table.externalProviderId)
      .where(sql`${table.externalProviderId} is not null`),
    uniqueIndex("competitions_sdms_comp_code_unique")
      .on(table.sdmsCompCode)
      .where(sql`${table.sdmsCompCode} is not null`),
  ],
);

export const competitionSeasons = pgTable(
  "competition_seasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    year: integer("year").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    isDeprecated: boolean("is_deprecated").notNull().default(false),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    sourceProvider: text("source_provider").notNull().default("sdms"),
    championTeamId: uuid("champion_team_id").references(() => teams.id, { onDelete: "set null" }),
    wikipediaSourceUrl: text("wikipedia_source_url"),
  },
  (table) => [
    uniqueIndex("competition_seasons_competition_label_unique").on(
      table.competitionId,
      table.label,
    ),
  ],
);

export const standingRows = pgTable(
  "standing_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => competitionSeasons.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    view: text("view").notNull().default("overall"),
    rank: integer("rank").notNull(),
    played: integer("played").notNull().default(0),
    won: integer("won").notNull().default(0),
    draw: integer("draw").notNull().default(0),
    lost: integer("lost").notNull().default(0),
    pointsFor: integer("points_for").notNull().default(0),
    pointsAgainst: integer("points_against").notNull().default(0),
    pointsDiff: integer("points_diff").notNull().default(0),
    bonusPoints: integer("bonus_points").notNull().default(0),
    tryBonusPoints: integer("try_bonus_points").notNull().default(0),
    losingBonusPoints: integer("losing_bonus_points").notNull().default(0),
    pointsDeduction: integer("points_deduction").notNull().default(0),
    points: integer("points").notNull().default(0),
    form: text("form"),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("standing_rows_season_team_view_unique").on(
      table.seasonId,
      table.teamId,
      table.view,
    ),
  ],
);

export const venues = pgTable(
  "venues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    city: text("city"),
    countryName: text("country_name"),
    capacity: integer("capacity"),
    recordAttendance: integer("record_attendance"),
    teamId: uuid("team_id").references(() => teams.id),
    sourceProvider: text("source_provider").notNull().default("manual"),
    wikipediaUrl: text("wikipedia_url"),
    wikidataId: text("wikidata_id"),
    archiveSyncedAt: timestamp("archive_synced_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("venues_slug_unique").on(table.slug)],
);

export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    externalProviderId: text("external_provider_id"),
    sourceProvider: text("source_provider").notNull().default("manual"),
    positionName: text("position_name"),
    clubName: text("club_name"),
    countryName: text("country_name"),
    nationCode: text("nation_code"),
    clubTeamId: uuid("club_team_id").references(() => teams.id),
    internationalTeamId: uuid("international_team_id").references(() => teams.id),
    fullName: text("full_name"),
    birthDate: date("birth_date"),
    birthPlace: text("birth_place"),
    heightCm: integer("height_cm"),
    weightKg: integer("weight_kg"),
    school: text("school"),
    relatives: text("relatives"),
    positions: jsonb("positions"),
    imageUrl: text("image_url"),
    bioSummary: text("bio_summary"),
    wikipediaUrl: text("wikipedia_url"),
    wikidataId: text("wikidata_id"),
    archiveSyncedAt: timestamp("archive_synced_at", { withTimezone: true }),
    socialAccounts: jsonb("social_accounts").default({}),
    squadNumber: integer("squad_number"),
    rugbypassSlug: text("rugbypass_slug"),
    rugbypassUrl: text("rugbypass_url"),
    rugbypassPlayerId: text("rugbypass_player_id"),
    rugbypassSyncedAt: timestamp("rugbypass_synced_at", { withTimezone: true }),
    careerStatus: text("career_status").notNull().default("active"),
  },
  (table) => [
    uniqueIndex("players_external_provider_id_unique")
      .on(table.externalProviderId)
      .where(sql`${table.externalProviderId} is not null`),
    uniqueIndex("players_rugbypass_slug_unique")
      .on(table.rugbypassSlug)
      .where(sql`${table.rugbypassSlug} is not null`),
    uniqueIndex("players_rugbypass_player_id_unique")
      .on(table.rugbypassPlayerId)
      .where(sql`${table.rugbypassPlayerId} is not null`),
  ],
);

export const referees = pgTable(
  "referees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    countryName: text("country_name"),
    externalProviderId: text("external_provider_id"),
    sourceProvider: text("source_provider").notNull().default("manual"),
    birthDate: date("birth_date"),
    nationality: text("nationality"),
    imageUrl: text("image_url"),
    bioSummary: text("bio_summary"),
    wikipediaUrl: text("wikipedia_url"),
    wikidataId: text("wikidata_id"),
    sourceUrl: text("source_url"),
    notes: text("notes"),
    socialAccounts: jsonb("social_accounts").default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("referees_external_provider_id_unique")
      .on(table.externalProviderId)
      .where(sql`${table.externalProviderId} is not null`),
  ],
);

export const playerCareerStints = pgTable(
  "player_career_stints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    careerType: text("career_type").notNull(),
    startYear: integer("start_year"),
    endYear: integer("end_year"),
    yearsLabel: text("years_label").notNull(),
    teamName: text("team_name").notNull(),
    teamId: uuid("team_id").references(() => teams.id),
    apps: integer("apps"),
    points: integer("points"),
    sortOrder: integer("sort_order").notNull().default(0),
    sourceProvider: text("source_provider").notNull().default("wikipedia"),
    sourceUrl: text("source_url"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("player_career_stints_unique").on(
      table.playerId,
      table.careerType,
      table.yearsLabel,
      table.teamName,
    ),
  ],
);

export const coaches = pgTable(
  "coaches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    externalProviderId: text("external_provider_id"),
    sourceProvider: text("source_provider").notNull().default("manual"),
    birthDate: date("birth_date"),
    nationality: text("nationality"),
    imageUrl: text("image_url"),
    bioSummary: text("bio_summary"),
    wikipediaUrl: text("wikipedia_url"),
    wikidataId: text("wikidata_id"),
    sourceUrl: text("source_url"),
    notes: text("notes"),
    socialAccounts: jsonb("social_accounts").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("coaches_external_provider_id_unique")
      .on(table.externalProviderId)
      .where(sql`${table.externalProviderId} is not null`),
  ],
);

export const teamCoachingStaff = pgTable(
  "team_coaching_staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    coachId: uuid("coach_id")
      .notNull()
      .references(() => coaches.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id").references(() => competitionSeasons.id, { onDelete: "set null" }),
    role: text("role").notNull(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    isCurrent: boolean("is_current").notNull().default(false),
    bioSummary: text("bio_summary"),
    notes: text("notes"),
    sourceUrl: text("source_url"),
    importKey: text("import_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("team_coaching_staff_import_key_unique")
      .on(table.importKey)
      .where(sql`${table.importKey} is not null`),
  ],
);

export const playerLegends = pgTable(
  "player_legends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    legendStatus: text("legend_status").notNull().default("active"),
    legendLevel: text("legend_level").notNull(),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    competitionId: uuid("competition_id").references(() => competitions.id, { onDelete: "set null" }),
    countryName: text("country_name"),
    internationalTeamId: uuid("international_team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    era: text("era"),
    reason: text("reason"),
    careerSummary: text("career_summary"),
    keyAchievements: jsonb("key_achievements").notNull().default([]),
    notableStats: jsonb("notable_stats").notNull().default({}),
    editorNotes: text("editor_notes"),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("player_legends_player_team_level_unique")
      .on(table.playerId, table.teamId, table.legendLevel)
      .where(sql`${table.teamId} is not null`),
  ],
);

export const playerExternalMatches = pgTable(
  "player_external_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    sourceProvider: text("source_provider").notNull().default("rugbypass"),
    importKey: text("import_key").notNull().unique(),
    fixtureId: uuid("fixture_id").references(() => fixtures.id, { onDelete: "set null" }),
    competitionName: text("competition_name"),
    seasonLabel: text("season_label"),
    teamName: text("team_name"),
    opponentName: text("opponent_name"),
    matchTitle: text("match_title"),
    kickoffAt: timestamp("kickoff_at", { withTimezone: true }),
    squadRole: text("squad_role"),
    minutesPlayed: integer("minutes_played").notNull().default(0),
    tries: integer("tries").notNull().default(0),
    points: integer("points").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    stats: jsonb("stats").notNull().default({}),
    sourceUrl: text("source_url"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const integrationSettings = pgTable("integration_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  config: jsonb("config").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const fixtures = pgTable("fixtures", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  sportId: uuid("sport_id").references(() => sports.id),
  homeTeamId: uuid("home_team_id").references(() => teams.id),
  awayTeamId: uuid("away_team_id").references(() => teams.id),
  competitionId: uuid("competition_id").references(() => competitions.id),
  seasonId: uuid("season_id").references(() => competitionSeasons.id, { onDelete: "set null" }),
  stage: text("stage").notNull().default("regular"),
  competitionName: text("competition_name"),
  kickoffAt: timestamp("kickoff_at", { withTimezone: true }),
  status: text("status").notNull().default("scheduled"),
  homeScore: integer("home_score").notNull().default(0),
  awayScore: integer("away_score").notNull().default(0),
  matchMinute: integer("match_minute").notNull().default(0),
  matchSecond: integer("match_second").notNull().default(0),
  period: text("period").notNull().default("not_started"),
  sport365Url: text("sport365_url"),
  planetRugbyUrl: text("planet_rugby_url"),
  externalMatchId: text("external_match_id"),
  providerSnapshot: jsonb("provider_snapshot"),
  refereeName: text("referee_name"),
  venueName: text("venue_name"),
  isNeutralVenue: boolean("is_neutral_venue").notNull().default(false),
  venueId: uuid("venue_id").references(() => venues.id),
  attendance: integer("attendance"),
  refereeId: uuid("referee_id").references(() => referees.id),
  homeCoachId: uuid("home_coach_id").references(() => coaches.id),
  awayCoachId: uuid("away_coach_id").references(() => coaches.id),
  round: text("round"),
  rugby365PotmPlayerId: uuid("rugby365_potm_player_id").references(() => players.id, {
    onDelete: "set null",
  }),
  officialPotmPlayerId: uuid("official_potm_player_id").references(() => players.id, {
    onDelete: "set null",
  }),
  officialPotmName: text("official_potm_name"),
});

export const playerTransfers = pgTable(
  "player_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    fromClub: text("from_club"),
    toClub: text("to_club"),
    fromTeamId: uuid("from_team_id").references(() => teams.id),
    toTeamId: uuid("to_team_id").references(() => teams.id),
    transferType: text("transfer_type").notNull().default("club"),
    movementType: text("movement_type").notNull().default("permanent"),
    seasonId: uuid("season_id").references(() => competitionSeasons.id, { onDelete: "set null" }),
    competitionId: uuid("competition_id").references(() => competitions.id, { onDelete: "set null" }),
    positionName: text("position_name"),
    effectiveDate: timestamp("effective_date", { withTimezone: true }),
    sourceProvider: text("source_provider").notNull().default("manual"),
    sourceUrl: text("source_url"),
    importKey: text("import_key"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("player_transfers_import_key_unique")
      .on(table.importKey)
      .where(sql`${table.importKey} is not null`),
  ],
);

export const playerTeamMemberships = pgTable(
  "player_team_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => competitionSeasons.id, { onDelete: "cascade" }),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    startDate: date("start_date"),
    endDate: date("end_date"),
    status: text("status").notNull().default("active"),
    sourceProvider: text("source_provider").notNull().default("manual"),
    sourceUrl: text("source_url"),
    notes: text("notes"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("player_team_memberships_player_team_season_unique").on(
      table.playerId,
      table.teamId,
      table.seasonId,
    ),
  ],
);

export const transferImportLogs = pgTable("transfer_import_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceProvider: text("source_provider").notNull().default("wikipedia"),
  sourceUrl: text("source_url").notNull(),
  seasonLabel: text("season_label"),
  competitionId: uuid("competition_id").references(() => competitions.id, { onDelete: "set null" }),
  status: text("status").notNull().default("completed"),
  summary: jsonb("summary").notNull().default({}),
  warnings: jsonb("warnings").notNull().default([]),
  errors: jsonb("errors").notNull().default([]),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

const performanceStatColumns = {
  minutesPlayed: integer("minutes_played").notNull().default(0),
  tries: integer("tries").notNull().default(0),
  points: integer("points").notNull().default(0),
  carries: integer("carries").notNull().default(0),
  metresCarried: integer("metres_carried").notNull().default(0),
  tacklesMade: integer("tackles_made").notNull().default(0),
  tacklesCompleted: integer("tackles_completed").notNull().default(0),
  dominantTackles: integer("dominant_tackles").notNull().default(0),
  turnoversWon: integer("turnovers_won").notNull().default(0),
  tryAssists: integer("try_assists").notNull().default(0),
  lineBreaks: integer("line_breaks").notNull().default(0),
  defendersBeaten: integer("defenders_beaten").notNull().default(0),
  touches: integer("touches").notNull().default(0),
  postContactMetres: integer("post_contact_metres").notNull().default(0),
  ruckArrivalEffectiveness: integer("ruck_arrival_effectiveness").notNull().default(0),
};

const teamMatchSummaryColumns = {
  tries: integer("tries").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  penalties: integer("penalties").notNull().default(0),
  dropGoals: integer("drop_goals").notNull().default(0),
  carries: integer("carries").notNull().default(0),
  metres: integer("metres").notNull().default(0),
  tackles: integer("tackles").notNull().default(0),
  turnoversWon: integer("turnovers_won").notNull().default(0),
};

export const teamMatchStats = pgTable(
  "team_match_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fixtureId: uuid("fixture_id")
      .notNull()
      .references(() => fixtures.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id").references(() => competitionSeasons.id, { onDelete: "set null" }),
    competitionId: uuid("competition_id").references(() => competitions.id, { onDelete: "set null" }),
    side: text("side").notNull(),
    externalMatchId: text("external_match_id"),
    ...teamMatchSummaryColumns,
    sections: jsonb("sections").notNull().default({}),
    sourceProvider: text("source_provider").notNull().default("sdms"),
    importKey: text("import_key"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("team_match_stats_import_key_unique")
      .on(table.importKey)
      .where(sql`${table.importKey} is not null`),
    uniqueIndex("team_match_stats_fixture_team_source_unique").on(
      table.fixtureId,
      table.teamId,
      table.sourceProvider,
    ),
  ],
);

export const playerMatchPerformanceStats = pgTable(
  "player_match_performance_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fixtureId: uuid("fixture_id")
      .notNull()
      .references(() => fixtures.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id").references(() => competitionSeasons.id, { onDelete: "set null" }),
    competitionId: uuid("competition_id").references(() => competitions.id, { onDelete: "set null" }),
    externalMatchId: text("external_match_id"),
    externalPlayerId: text("external_player_id"),
    ...performanceStatColumns,
    extras: jsonb("extras").notNull().default({}),
    sourceProvider: text("source_provider").notNull().default("sdms"),
    importKey: text("import_key"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("player_match_performance_stats_import_key_unique")
      .on(table.importKey)
      .where(sql`${table.importKey} is not null`),
    uniqueIndex("player_match_performance_stats_fixture_player_unique").on(
      table.fixtureId,
      table.playerId,
    ),
  ],
);

export const playerSeasonStats = pgTable(
  "player_season_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => competitionSeasons.id, { onDelete: "cascade" }),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    appearances: integer("appearances").notNull().default(0),
    ...performanceStatColumns,
    attackRank: integer("attack_rank"),
    defenceRank: integer("defence_rank"),
    sourceProvider: text("source_provider").notNull().default("sdms"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("player_season_stats_player_season_team_unique").on(
      table.playerId,
      table.seasonId,
      table.teamId,
    ),
  ],
);

export const fixturePlayers = pgTable(
  "fixture_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fixtureId: uuid("fixture_id")
      .notNull()
      .references(() => fixtures.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    jerseyNumber: integer("jersey_number"),
    squadRole: text("squad_role").notNull(),
    positionName: text("position_name"),
    clubName: text("club_name"),
    tries: integer("tries").notNull().default(0),
    conversions: integer("conversions").notNull().default(0),
    penalties: integer("penalties").notNull().default(0),
    dropGoals: integer("drop_goals").notNull().default(0),
    points: integer("points").notNull().default(0),
  },
  (table) => [uniqueIndex("fixture_players_fixture_player_unique").on(table.fixtureId, table.playerId)],
);

export const matchEvents = pgTable("match_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  fixtureId: uuid("fixture_id")
    .notNull()
    .references(() => fixtures.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  minute: integer("minute").notNull().default(0),
  second: integer("second").notNull().default(0),
  teamId: uuid("team_id").references(() => teams.id),
  playerId: uuid("player_id").references(() => players.id),
  payload: jsonb("payload").notNull().default({}),
  sourceProvider: text("source_provider").default("demo"),
  sequenceNo: integer("sequence_no").notNull(),
});

export const rugbyLaws = pgTable("rugby_laws", {
  id: uuid("id").primaryKey().defaultRandom(),
  lawNumber: text("law_number").notNull(),
  lawVersion: text("law_version").notNull().default("2024"),
  title: text("title").notNull(),
  summary: text("summary"),
  category: text("category").notNull(),
  worldRugbyUrl: text("world_rugby_url"),
});

export const rugbyLawMappings = pgTable("rugby_law_mappings", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: text("event_type").notNull(),
  phaseType: text("phase_type"),
  lawId: uuid("law_id").references(() => rugbyLaws.id),
  notes: text("notes"),
});

export const commentaryTemplates = pgTable("commentary_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  templateKey: text("template_key").notNull(),
  locale: text("locale").notNull().default("en"),
  outputType: text("output_type").notNull(),
  tone: text("tone").notNull().default("neutral"),
  body: text("body").notNull(),
  placeholdersSchema: jsonb("placeholders_schema"),
  priority: integer("priority").notNull().default(100),
  active: boolean("active").notNull().default(true),
  sportId: uuid("sport_id").references(() => sports.id),
});

export const commentaryRules = pgTable("commentary_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  conditions: jsonb("conditions").notNull(),
  templateKeys: jsonb("template_keys").notNull(),
  maxSuggestions: integer("max_suggestions").notNull().default(4),
  cooldownSeconds: integer("cooldown_seconds").notNull().default(0),
  autoApprove: boolean("auto_approve").notNull().default(false),
  outputType: text("output_type").notNull(),
  active: boolean("active").notNull().default(true),
});

export const commentarySuggestions = pgTable("commentary_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  fixtureId: uuid("fixture_id")
    .notNull()
    .references(() => fixtures.id, { onDelete: "cascade" }),
  triggerEventId: uuid("trigger_event_id").references(() => matchEvents.id),
  facts: jsonb("facts").notNull(),
  renderedOptions: jsonb("rendered_options").notNull(),
  status: suggestionStatusEnum("status").notNull().default("pending"),
  selectedIndex: integer("selected_index"),
  operatorId: text("operator_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const matchCommentary = pgTable("match_commentary", {
  id: uuid("id").primaryKey().defaultRandom(),
  fixtureId: uuid("fixture_id")
    .notNull()
    .references(() => fixtures.id, { onDelete: "cascade" }),
  minute: integer("minute").notNull(),
  second: integer("second").notNull().default(0),
  outputType: text("output_type").notNull(),
  locale: text("locale").notNull().default("en"),
  body: text("body").notNull(),
  facts: jsonb("facts"),
  templateId: uuid("template_id").references(() => commentaryTemplates.id),
  suggestionId: uuid("suggestion_id").references(() => commentarySuggestions.id),
  publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source").notNull().default("template"),
  widgetPayload: jsonb("widget_payload"),
});

export const agentApprovalStatusEnum = pgEnum("agent_approval_status", [
  "pending",
  "approved",
  "rejected",
  "auto_accepted",
  "logged_only",
]);

export const agentSandboxRuns = pgTable("agent_sandbox_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  matchExternalId: text("match_external_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  mode: text("mode").notNull().default("assisted"),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  status: text("status").notNull().default("running"),
  pollCount: integer("poll_count").notNull().default(0),
  lastSnapshot: jsonb("last_snapshot"),
  flags: jsonb("flags").notNull().default([]),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const agentSandboxEvents = pgTable("agent_sandbox_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => agentSandboxRuns.id, { onDelete: "cascade" }),
  sequenceNo: integer("sequence_no").notNull(),
  eventOutput: jsonb("event_output").notNull(),
  approvalStatus: agentApprovalStatusEnum("approval_status").notNull().default("pending"),
  operatorNote: text("operator_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const referenceProducts = pgTable("reference_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  sourceUrl: text("source_url"),
  learnFrom: jsonb("learn_from").notNull().default([]),
  doNotCopy: jsonb("do_not_copy").notNull().default([]),
  matchCentrePatterns: jsonb("match_centre_patterns"),
  commentaryPatterns: jsonb("commentary_patterns"),
  dataPatterns: jsonb("data_patterns"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commentaryResearchFindings = pgTable("commentary_research_findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  externalId: text("external_id").notNull().unique(),
  providerSlug: text("provider_slug").notNull(),
  eventType: text("event_type").notNull(),
  category: text("category").notNull(),
  style: jsonb("style").notNull(),
  presentation: jsonb("presentation").notNull(),
  researchNotes: text("research_notes").notNull(),
  templateGuidance: text("template_guidance").notNull(),
  rugby365TemplateKeys: jsonb("rugby365_template_keys").notNull(),
  rugbyLawCategories: jsonb("rugby_law_categories"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const worldRankingSnapshots = pgTable(
  "world_ranking_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: text("category").notNull(),
    effectiveDate: date("effective_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("world_ranking_snapshots_category_effective_unique").on(
      table.category,
      table.effectiveDate,
    ),
  ],
);

export const worldRankingFeeds = pgTable("world_ranking_feeds", {
  category: text("category").primaryKey(),
  label: text("label").notNull(),
  sourceUrl: text("source_url").notNull(),
  currentSnapshotId: uuid("current_snapshot_id").references(() => worldRankingSnapshots.id, {
    onDelete: "set null",
  }),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
});

export const worldRankingRows = pgTable(
  "world_ranking_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => worldRankingSnapshots.id, { onDelete: "cascade" }),
    worldRugbyTeamId: text("world_rugby_team_id").notNull(),
    position: integer("position").notNull(),
    previousPosition: integer("previous_position"),
    points: real("points").notNull(),
    previousPoints: real("previous_points"),
    teamName: text("team_name").notNull(),
    teamAbbreviation: text("team_abbreviation"),
    countryCode: text("country_code"),
    teamId: uuid("team_id").references(() => teams.id),
  },
  (table) => [
    uniqueIndex("world_ranking_rows_snapshot_team_unique").on(
      table.snapshotId,
      table.worldRugbyTeamId,
    ),
  ],
);

export const aiEnrichmentSuggestions = pgTable("ai_enrichment_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  task: text("task").notNull(),
  status: suggestionStatusEnum("status").notNull().default("pending"),
  model: text("model").notNull(),
  promptSystem: text("prompt_system").notNull(),
  promptUser: text("prompt_user").notNull(),
  sourceSnapshot: jsonb("source_snapshot").notNull(),
  suggestions: jsonb("suggestions").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectedBy: text("rejected_by"),
  appliedPatch: jsonb("applied_patch"),
});

export const aiVerificationReports = pgTable("ai_verification_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  status: suggestionStatusEnum("status").notNull().default("pending"),
  model: text("model").notNull(),
  promptSystem: text("prompt_system").notNull(),
  promptUser: text("prompt_user").notNull(),
  sourceSnapshot: jsonb("source_snapshot").notNull(),
  report: jsonb("report").notNull(),
  confidenceScore: real("confidence_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by"),
});

export const playerRatings = pgTable("player_ratings", {
  playerId: uuid("player_id")
    .primaryKey()
    .references(() => players.id, { onDelete: "cascade" }),
  playerRating: real("player_rating"),
  currentAbility: real("current_ability"),
  formScore: real("form_score"),
  teamImportance: real("team_importance"),
  potential: real("potential"),
  reputation: real("reputation"),
  attackRating: real("attack_rating"),
  defenceRating: real("defence_rating"),
  disciplineRating: real("discipline_rating"),
  ageProfile: text("age_profile"),
  ratingConfidence: real("rating_confidence"),
  ratingExplanation: text("rating_explanation"),
  seasonRating: real("season_rating"),
  careerHigh: real("career_high"),
  careerLow: real("career_low"),
  formMovement: real("form_movement"),
  ratingMovement: real("rating_movement"),
  lastFiveMatchRatings: jsonb("last_five_match_ratings").notNull().default([]),
  badges: jsonb("badges").notNull().default([]),
  manualOverrideRating: real("manual_override_rating"),
  manualOverrideReason: text("manual_override_reason"),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }),
  dataPoints: integer("data_points").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per-match Rugby365 Match Ratings (0–10) shown on line-ups. */
export const playerMatchRatings = pgTable(
  "player_match_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fixtureId: uuid("fixture_id")
      .notNull()
      .references(() => fixtures.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    competitionId: uuid("competition_id").references(() => competitions.id, {
      onDelete: "set null",
    }),
    seasonId: uuid("season_id").references(() => competitionSeasons.id, {
      onDelete: "set null",
    }),
    externalPlayerId: text("external_player_id"),
    squadRole: text("squad_role").notNull().default("starter"),
    jerseyNumber: integer("jersey_number"),
    positionName: text("position_name"),
    minutesPlayed: integer("minutes_played").notNull().default(0),
    rating: real("rating"),
    ratingStatus: text("rating_status").notNull().default("unavailable"),
    performanceBand: text("performance_band"),
    ratingExplanation: text("rating_explanation"),
    positiveImpacts: jsonb("positive_impacts").notNull().default([]),
    deductions: jsonb("deductions").notNull().default([]),
    matchContext: jsonb("match_context").notNull().default([]),
    attackContribution: real("attack_contribution"),
    defenceContribution: real("defence_contribution"),
    previousFixtureId: uuid("previous_fixture_id").references(() => fixtures.id, {
      onDelete: "set null",
    }),
    previousRating: real("previous_rating"),
    ratingChange: real("rating_change"),
    performanceTrend: text("performance_trend"),
    selectionPreviousRole: text("selection_previous_role"),
    selectionCurrentRole: text("selection_current_role"),
    selectionTrend: text("selection_trend"),
    selectionBadge: text("selection_badge"),
    isRugby365Potm: boolean("is_rugby365_potm").notNull().default(false),
    isOfficialPotm: boolean("is_official_potm").notNull().default(false),
    manualOverrideRating: real("manual_override_rating"),
    manualOverrideReason: text("manual_override_reason"),
    sourceProvider: text("source_provider").notNull().default("rugby365"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("player_match_ratings_fixture_player_unique").on(table.fixtureId, table.playerId),
  ],
);

/** Selection/status movement between matches (no rating created for non-played matches). */
export const playerSelectionTrends = pgTable(
  "player_selection_trends",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    competitionId: uuid("competition_id").references(() => competitions.id, {
      onDelete: "set null",
    }),
    fixtureId: uuid("fixture_id").references(() => fixtures.id, { onDelete: "set null" }),
    previousFixtureId: uuid("previous_fixture_id").references(() => fixtures.id, {
      onDelete: "set null",
    }),
    currentRole: text("current_role").notNull().default("not_selected"),
    previousRole: text("previous_role"),
    selectionTrend: text("selection_trend").notNull().default("unknown"),
    selectionBadge: text("selection_badge"),
    reason: text("reason"),
    minutesCurrent: integer("minutes_current"),
    minutesPrevious: integer("minutes_previous"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("player_selection_trends_fixture_player_unique")
      .on(table.fixtureId, table.playerId)
      .where(sql`${table.fixtureId} is not null`),
  ],
);

export const playerBioProfiles = pgTable("player_bio_profiles", {
  playerId: uuid("player_id")
    .primaryKey()
    .references(() => players.id, { onDelete: "cascade" }),
  primaryBioType: text("primary_bio_type").notNull().default("domestic"),
  shortIntro: text("short_intro"),
  fullBio: text("full_bio"),
  playingStyle: text("playing_style"),
  strengths: text("strengths"),
  areasToImprove: text("areas_to_improve"),
  careerSummary: text("career_summary"),
  internationalSummary: text("international_summary"),
  currentSeasonSummary: text("current_season_summary"),
  scoutingSummary: text("scouting_summary"),
  ratingExplanation: text("rating_explanation"),
  legendSummary: text("legend_summary"),
  domesticSections: jsonb("domestic_sections").notNull().default({}),
  internationalSections: jsonb("international_sections").notNull().default({}),
  scoutingSections: jsonb("scouting_sections").notNull().default({}),
  domesticUpdatedAt: timestamp("domestic_updated_at", { withTimezone: true }),
  internationalUpdatedAt: timestamp("international_updated_at", { withTimezone: true }),
  scoutingUpdatedAt: timestamp("scouting_updated_at", { withTimezone: true }),
  approvedSuggestionId: uuid("approved_suggestion_id"),
  approvedBy: text("approved_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerBioSuggestions = pgTable("player_bio_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  bioType: text("bio_type").notNull(),
  triggerReason: text("trigger_reason").notNull(),
  status: text("status").notNull().default("draft"),
  suggestedSections: jsonb("suggested_sections").notNull(),
  approvedSections: jsonb("approved_sections"),
  sourceDataSnapshot: jsonb("source_data_snapshot").notNull(),
  verificationReport: jsonb("verification_report"),
  promptVersion: text("prompt_version").notNull(),
  model: text("model").notNull(),
  confidenceScore: real("confidence_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectedBy: text("rejected_by"),
});

export const playerBioHistory = pgTable("player_bio_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  suggestionId: uuid("suggestion_id").references(() => playerBioSuggestions.id, {
    onDelete: "set null",
  }),
  bioType: text("bio_type").notNull(),
  sections: jsonb("sections").notNull(),
  changeSummary: text("change_summary"),
  triggerReason: text("trigger_reason"),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerProfileVerificationReports = pgTable("player_profile_verification_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  suggestionId: uuid("suggestion_id").references(() => playerBioSuggestions.id, {
    onDelete: "set null",
  }),
  sourceFieldsUsed: jsonb("source_fields_used").notNull(),
  sourceUrls: jsonb("source_urls").notNull(),
  missingFields: jsonb("missing_fields").notNull(),
  conflictingFields: jsonb("conflicting_fields").notNull(),
  confidenceScore: real("confidence_score"),
  suggestedEditorAction: text("suggested_editor_action"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roleType: text("role_type").notNull(),
    roleEntityId: uuid("role_entity_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug"),
    birthDate: date("birth_date"),
    nationality: text("nationality"),
    birthPlace: text("birth_place"),
    imageUrl: text("image_url"),
    bioSummary: text("bio_summary"),
    socialAccounts: jsonb("social_accounts").notNull().default({}),
    wikipediaUrl: text("wikipedia_url"),
    wikidataId: text("wikidata_id"),
    sourceUrls: jsonb("source_urls").notNull().default([]),
    currentRole: text("current_role"),
    currentOrganisation: text("current_organisation"),
    verificationStatus: text("verification_status").notNull().default("unverified"),
    confidenceScore: real("confidence_score"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("people_role_entity_unique").on(table.roleType, table.roleEntityId)],
);

export const refereeAppointments = pgTable(
  "referee_appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    refereeId: uuid("referee_id")
      .notNull()
      .references(() => referees.id, { onDelete: "cascade" }),
    fixtureId: uuid("fixture_id").references(() => fixtures.id, { onDelete: "set null" }),
    competitionId: uuid("competition_id").references(() => competitions.id, { onDelete: "set null" }),
    seasonId: uuid("season_id").references(() => competitionSeasons.id, { onDelete: "set null" }),
    appointmentLevel: text("appointment_level"),
    isInternational: boolean("is_international").notNull().default(false),
    isTestMatch: boolean("is_test_match").notNull().default(false),
    kickoffAt: timestamp("kickoff_at", { withTimezone: true }),
    homeTeam: text("home_team"),
    awayTeam: text("away_team"),
    competitionName: text("competition_name"),
    sourceProvider: text("source_provider").notNull().default("rugby365"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("referee_appointments_fixture_unique")
      .on(table.refereeId, table.fixtureId)
      .where(sql`${table.fixtureId} is not null`),
  ],
);

export const personIntelligenceScoreHistory = pgTable("person_intelligence_score_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  roleType: text("role_type").notNull(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  competitionId: uuid("competition_id").references(() => competitions.id, { onDelete: "set null" }),
  seasonId: uuid("season_id").references(() => competitionSeasons.id, { onDelete: "set null" }),
  fixtureId: uuid("fixture_id").references(() => fixtures.id, { onDelete: "set null" }),
  ratingType: text("rating_type").notNull(),
  overallScore: real("overall_score"),
  supportingScores: jsonb("supporting_scores").notNull().default({}),
  explanation: text("explanation"),
  calculationInputs: jsonb("calculation_inputs").notNull().default({}),
  formulaVersion: text("formula_version").notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
  confidenceScore: real("confidence_score"),
  manualOverrideRating: real("manual_override_rating"),
  overrideNotes: text("override_notes"),
  overriddenBy: text("overridden_by"),
  overriddenAt: timestamp("overridden_at", { withTimezone: true }),
});

export const personBioProfiles = pgTable("person_bio_profiles", {
  personId: uuid("person_id")
    .primaryKey()
    .references(() => people.id, { onDelete: "cascade" }),
  primaryBioType: text("primary_bio_type").notNull().default("short_bio"),
  shortIntro: text("short_intro"),
  fullBio: text("full_bio"),
  careerSummary: text("career_summary"),
  ratingExplanation: text("rating_explanation"),
  appointmentSummary: text("appointment_summary"),
  experienceProfile: text("experience_profile"),
  approvedSuggestionId: uuid("approved_suggestion_id"),
  approvedBy: text("approved_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const personBioSuggestions = pgTable("person_bio_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  bioType: text("bio_type").notNull(),
  triggerReason: text("trigger_reason").notNull(),
  status: text("status").notNull().default("pending"),
  suggestedSections: jsonb("suggested_sections").notNull(),
  approvedSections: jsonb("approved_sections"),
  sourceDataSnapshot: jsonb("source_data_snapshot").notNull(),
  verificationReport: jsonb("verification_report"),
  promptVersion: text("prompt_version").notNull(),
  model: text("model").notNull(),
  confidenceScore: real("confidence_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  rejectedAt: timestamp("rejected_at", { withTimezone: true }),
  rejectedBy: text("rejected_by"),
});

export const personBioHistory = pgTable("person_bio_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  suggestionId: uuid("suggestion_id").references(() => personBioSuggestions.id, {
    onDelete: "set null",
  }),
  bioType: text("bio_type").notNull(),
  sections: jsonb("sections").notNull(),
  changeSummary: text("change_summary"),
  triggerReason: text("trigger_reason"),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const personVerificationReports = pgTable("person_verification_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  suggestionId: uuid("suggestion_id").references(() => personBioSuggestions.id, {
    onDelete: "set null",
  }),
  sourceFieldsUsed: jsonb("source_fields_used").notNull(),
  sourceUrls: jsonb("source_urls").notNull(),
  missingFields: jsonb("missing_fields").notNull(),
  conflictingFields: jsonb("conflicting_fields").notNull(),
  confidenceScore: real("confidence_score"),
  suggestedEditorAction: text("suggested_editor_action"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerInjuries = pgTable("player_injuries", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  seasonId: uuid("season_id").references(() => competitionSeasons.id, { onDelete: "set null" }),
  injuryType: text("injury_type"),
  bodyArea: text("body_area"),
  injuryDate: date("injury_date"),
  dateReported: date("date_reported"),
  expectedReturnDate: date("expected_return_date"),
  actualReturnDate: date("actual_return_date"),
  status: text("status").notNull().default("injured"),
  matchesMissed: integer("matches_missed").notNull().default(0),
  source: text("source"),
  sourceUrl: text("source_url"),
  notes: text("notes"),
  lastVerifiedDate: date("last_verified_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerSuspensions = pgTable("player_suspensions", {
  id: uuid("id").primaryKey().defaultRandom(),
  playerId: uuid("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  competitionId: uuid("competition_id").references(() => competitions.id, { onDelete: "set null" }),
  seasonId: uuid("season_id").references(() => competitionSeasons.id, { onDelete: "set null" }),
  fixtureId: uuid("fixture_id").references(() => fixtures.id, { onDelete: "set null" }),
  incidentDate: date("incident_date"),
  offence: text("offence"),
  cardType: text("card_type"),
  hearingDate: date("hearing_date"),
  suspensionStart: date("suspension_start"),
  suspensionEnd: date("suspension_end"),
  matchesSuspended: integer("matches_suspended"),
  matchesServed: integer("matches_served").notNull().default(0),
  matchesRemaining: integer("matches_remaining"),
  status: text("status").notNull().default("suspended"),
  source: text("source"),
  sourceUrl: text("source_url"),
  notes: text("notes"),
  lastVerifiedDate: date("last_verified_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const squadAuditClubs = pgTable("squad_audit_clubs", {
  teamId: uuid("team_id")
    .primaryKey()
    .references(() => teams.id, { onDelete: "cascade" }),
  officialClubName: text("official_club_name").notNull(),
  officialSquadUrl: text("official_squad_url"),
  sourceType: text("source_type").notNull().default("club_website"),
  backupSourceType: text("backup_source_type"),
  importParser: text("import_parser"),
  status: text("status").notNull().default("not_started"),
  competitionId: uuid("competition_id").references(() => competitions.id, { onDelete: "set null" }),
  seasonId: uuid("season_id").references(() => competitionSeasons.id, { onDelete: "set null" }),
  sourceCheckedAt: timestamp("source_checked_at", { withTimezone: true }),
  lastSuccessfulImportAt: timestamp("last_successful_import_at", { withTimezone: true }),
  lastError: text("last_error"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const squadAuditJobs = pgTable("squad_audit_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  seasonId: uuid("season_id").references(() => competitionSeasons.id, { onDelete: "set null" }),
  sourceUrl: text("source_url"),
  jobType: text("job_type").notNull(),
  status: text("status").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  totalPlayers: integer("total_players").notNull().default(0),
  matched: integer("matched").notNull().default(0),
  unmatched: integer("unmatched").notNull().default(0),
  conflicts: integer("conflicts").notNull().default(0),
  report: jsonb("report").notNull().default({}),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const squadAuditPlayers = pgTable("squad_audit_players", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => squadAuditJobs.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  playerId: uuid("player_id").references(() => players.id, { onDelete: "set null" }),
  sourcePlayerName: text("source_player_name").notNull(),
  matchedPlayerName: text("matched_player_name"),
  position: text("position"),
  secondaryPosition: text("secondary_position"),
  squadNumber: integer("squad_number"),
  rugby365Position: text("rugby365_position"),
  rugby365SquadNumber: integer("rugby365_squad_number"),
  rugby365Club: text("rugby365_club"),
  officialClub: text("official_club"),
  matchConfidence: text("match_confidence"),
  reviewStatus: text("review_status").notNull().default("pending"),
  conflictType: text("conflict_type"),
  groupType: text("group_type").notNull(),
  sourceUrl: text("source_url"),
  sourceType: text("source_type"),
  sourceCheckedAt: timestamp("source_checked_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const squadAuditLog = pgTable("squad_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
  jobId: uuid("job_id").references(() => squadAuditJobs.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  userLabel: text("user_label").notNull().default("system"),
  beforeValue: jsonb("before_value"),
  afterValue: jsonb("after_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
