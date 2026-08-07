/**
 * Deep South Africa match backfill — England first, then all SA SDMS fixtures.
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-sa-match-depth.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-sa-match-depth.ts --skip-enrich
 */
import { and, eq, sql } from "drizzle-orm";
import { fixtures, players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { enrichFixtureFromSdmsMatch } from "../apps/web/src/lib/planet-rugby-match-import-service";
import { importMatchPerformanceStats } from "../apps/web/src/lib/planet-rugby-player-stats-import-service";
import { upsertTeamMatchStat } from "../apps/web/src/lib/team-match-stats-service";
import { fetchSdmsMatchStats, parseSdmsMatchTeamStats } from "@rugby365/import-sdk";
import { replaceFixtureBroadcasters } from "../apps/web/src/lib/fixture-broadcasters-service";
import { calculateAndPersistPlayerRating } from "../apps/web/src/lib/player-bio-packet-service";
import { updateFixtureSources } from "../apps/web/src/lib/fixture-admin-service";

const SA_ID = "b0000000-0000-4000-8000-000000000001";
const ENG_ID = "1c90fe00-6596-462b-8dc5-bca3704d661f";
const ENG_FX = "abcb9be4-f0ec-42d5-9dc7-32adb096eb23";

const COMP = {
  rwc: "89adedf8-b7cd-494f-b1d4-811334f5f25f",
  eoy: "dc5ed914-373f-444c-aa09-4b2a5d9e3b25",
  summer: "99de2323-fcc1-4915-ad7f-4364e03a92f0",
  nc: "d233e80e-eb2f-41dd-8f23-72e0a31f630b",
  intl: "99de2323-fcc1-4915-ad7f-4364e03a92f0",
};

const args = process.argv.slice(2);
const skipEnrich = args.includes("--skip-enrich");
const sdmsLimit = Number(args.find((a) => a.startsWith("--sdms-limit="))?.split("=")[1] ?? 40);

type HistRow = {
  date: string;
  venue: string;
  homeIsEngland: boolean;
  homeScore: number;
  awayScore: number;
  competition: string;
  competitionId: string;
};

/** From Wikipedia: History of rugby union matches between England and South Africa (home score first). */
const ENGLAND_SA_HISTORY: HistRow[] = [
  { date: "1906-12-08", venue: "Crystal Palace, London", homeIsEngland: true, homeScore: 3, awayScore: 3, competition: "International Matches", competitionId: COMP.intl },
  { date: "1913-01-04", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 3, awayScore: 9, competition: "International Matches", competitionId: COMP.intl },
  { date: "1932-01-02", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 0, awayScore: 7, competition: "International Matches", competitionId: COMP.intl },
  { date: "1952-01-05", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 3, awayScore: 8, competition: "International Matches", competitionId: COMP.intl },
  { date: "1961-01-07", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 0, awayScore: 5, competition: "International Matches", competitionId: COMP.intl },
  { date: "1969-12-20", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 11, awayScore: 8, competition: "International Matches", competitionId: COMP.intl },
  { date: "1972-06-03", venue: "Ellis Park Stadium, Johannesburg", homeIsEngland: false, homeScore: 9, awayScore: 18, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "1984-06-02", venue: "Boet Erasmus Stadium, Port Elizabeth", homeIsEngland: false, homeScore: 33, awayScore: 15, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "1984-06-09", venue: "Ellis Park Stadium, Johannesburg", homeIsEngland: false, homeScore: 35, awayScore: 9, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "1992-11-14", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 33, awayScore: 16, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "1994-06-04", venue: "Loftus Versfeld Stadium, Pretoria", homeIsEngland: false, homeScore: 15, awayScore: 32, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "1994-06-11", venue: "Newlands Stadium, Cape Town", homeIsEngland: false, homeScore: 27, awayScore: 9, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "1995-11-18", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 14, awayScore: 24, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "1997-11-29", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 11, awayScore: 29, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "1998-07-04", venue: "Newlands Stadium, Cape Town", homeIsEngland: false, homeScore: 18, awayScore: 0, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "1998-12-05", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 13, awayScore: 7, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "1999-10-24", venue: "Stade de France, Saint-Denis", homeIsEngland: true, homeScore: 21, awayScore: 44, competition: "Rugby World Cup", competitionId: COMP.rwc },
  { date: "2000-06-17", venue: "Loftus Versfeld Stadium, Pretoria", homeIsEngland: false, homeScore: 18, awayScore: 13, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "2000-06-24", venue: "Free State Stadium, Bloemfontein", homeIsEngland: false, homeScore: 22, awayScore: 27, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "2000-12-02", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 25, awayScore: 17, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "2001-11-24", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 29, awayScore: 9, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "2002-11-23", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 53, awayScore: 3, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "2003-10-18", venue: "Subiaco Oval, Perth", homeIsEngland: true, homeScore: 25, awayScore: 6, competition: "Rugby World Cup", competitionId: COMP.rwc },
  { date: "2004-11-20", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 32, awayScore: 16, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "2006-11-18", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 23, awayScore: 21, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "2006-11-25", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 14, awayScore: 25, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "2007-05-26", venue: "Free State Stadium, Bloemfontein", homeIsEngland: false, homeScore: 58, awayScore: 10, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "2007-06-02", venue: "Loftus Versfeld Stadium, Pretoria", homeIsEngland: false, homeScore: 55, awayScore: 22, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "2007-09-14", venue: "Stade de France, Saint-Denis", homeIsEngland: true, homeScore: 0, awayScore: 36, competition: "Rugby World Cup", competitionId: COMP.rwc },
  { date: "2007-10-20", venue: "Stade de France, Saint-Denis", homeIsEngland: true, homeScore: 6, awayScore: 15, competition: "Rugby World Cup", competitionId: COMP.rwc },
  { date: "2008-11-22", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 6, awayScore: 42, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "2010-11-27", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 11, awayScore: 21, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "2012-06-09", venue: "Kings Park Stadium, Durban", homeIsEngland: false, homeScore: 22, awayScore: 17, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "2012-06-16", venue: "Ellis Park Stadium, Johannesburg", homeIsEngland: false, homeScore: 36, awayScore: 27, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "2012-06-23", venue: "Nelson Mandela Bay Stadium, Port Elizabeth", homeIsEngland: false, homeScore: 14, awayScore: 14, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "2012-11-24", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 15, awayScore: 16, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "2014-11-15", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 28, awayScore: 31, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "2016-11-12", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 37, awayScore: 21, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "2018-06-09", venue: "Ellis Park Stadium, Johannesburg", homeIsEngland: false, homeScore: 42, awayScore: 39, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "2018-06-16", venue: "Free State Stadium, Bloemfontein", homeIsEngland: false, homeScore: 23, awayScore: 12, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "2018-06-23", venue: "Newlands Stadium, Cape Town", homeIsEngland: false, homeScore: 10, awayScore: 25, competition: "Summer Internationals", competitionId: COMP.summer },
  { date: "2018-11-03", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 12, awayScore: 11, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "2019-11-02", venue: "International Stadium, Yokohama", homeIsEngland: true, homeScore: 12, awayScore: 32, competition: "Rugby World Cup", competitionId: COMP.rwc },
  { date: "2021-11-20", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 27, awayScore: 26, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "2022-11-26", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 13, awayScore: 27, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "2023-10-21", venue: "Stade de France, Saint-Denis", homeIsEngland: true, homeScore: 15, awayScore: 16, competition: "Rugby World Cup", competitionId: COMP.rwc },
  { date: "2024-11-16", venue: "Twickenham Stadium, London", homeIsEngland: true, homeScore: 20, awayScore: 29, competition: "End-of-year Internationals", competitionId: COMP.eoy },
  { date: "2026-07-04", venue: "Ellis Park Stadium, Johannesburg", homeIsEngland: false, homeScore: 45, awayScore: 21, competition: "World Rugby Nations Championship", competitionId: COMP.nc },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugFor(date: string, homeIsEngland: boolean) {
  return homeIsEngland
    ? `england-v-south-africa-${date}`
    : `south-africa-v-england-${date}`;
}

async function seedEnglandSaHistory() {
  const db = getDb();
  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const row of ENGLAND_SA_HISTORY) {
    const homeTeamId = row.homeIsEngland ? ENG_ID : SA_ID;
    const awayTeamId = row.homeIsEngland ? SA_ID : ENG_ID;
    const slug = slugFor(row.date, row.homeIsEngland);
    const externalMatchId = `wikipedia:england-south-africa:${row.date}`;
    const kickoffAt = new Date(`${row.date}T15:00:00.000Z`);

    const existing = await db.execute(sql`
      select id, slug from fixtures
      where (home_team_id=${homeTeamId}::uuid and away_team_id=${awayTeamId}::uuid
          or home_team_id=${awayTeamId}::uuid and away_team_id=${homeTeamId}::uuid)
        and kickoff_at::date = ${row.date}::date
      limit 1
    `);
    const hit = (existing as unknown as Array<{ id: string; slug: string }>)[0];
    if (hit) {
      skipped += 1;
      continue;
    }

    // Prefer stable slug; append -wiki if taken.
    let finalSlug = slug;
    const slugTaken = await db.execute(sql`select id from fixtures where slug=${finalSlug} limit 1`);
    if ((slugTaken as unknown as unknown[]).length) finalSlug = `${slug}-wiki`;

    await db.execute(sql`
      insert into fixtures (
        slug, home_team_id, away_team_id, competition_id, competition_name,
        kickoff_at, status, home_score, away_score, venue_name, external_match_id,
        period, match_minute, stage, provider_snapshot
      ) values (
        ${finalSlug},
        ${homeTeamId}::uuid,
        ${awayTeamId}::uuid,
        ${row.competitionId}::uuid,
        ${row.competition},
        ${kickoffAt.toISOString()}::timestamptz,
        'full_time',
        ${row.homeScore},
        ${row.awayScore},
        ${row.venue},
        ${externalMatchId},
        'full_time',
        80,
        'regular',
        ${JSON.stringify({
          primarySource: "wikipedia",
          sourceUrl:
            "https://en.wikipedia.org/wiki/History_of_rugby_union_matches_between_England_and_South_Africa",
        })}::jsonb
      )
    `);
    created += 1;
    console.log(`  + ${finalSlug} ${row.homeScore}-${row.awayScore}`);
  }

  // Ensure 2026 England fixture score/status
  await db.execute(sql`
    update fixtures
    set status='full_time', home_score=45, away_score=21, period='full_time', match_minute=80,
        kickoff_at='2026-07-04 13:00:00+00'
    where id=${ENG_FX}::uuid
  `);
  updated += 1;

  return { created, skipped, updated };
}

async function deepenEnglandMatch() {
  const db = getDb();
  const [fx] = await db.select().from(fixtures).where(eq(fixtures.id, ENG_FX)).limit(1);
  if (!fx?.externalMatchId) return { ok: false, reason: "missing external id" };

  // Sources: keep Planet primary, mark wiki history link in snapshot.
  await updateFixtureSources(ENG_FX, {
    primarySource: "planet_rugby",
    planetRugbyUrl:
      fx.planetRugbyUrl ??
      "https://www.planetrugby.com/matches/46vodwkj/nations-championship/qo6gdo63/south-africa-v-england/2026-07-04",
    externalMatchId: fx.externalMatchId,
  });

  await replaceFixtureBroadcasters(ENG_FX, [
    { broadcasterName: "SuperSport", region: "ZA", platform: "tv", sortOrder: 0 },
    { broadcasterName: "TNT Sports", region: "UK", platform: "tv", sortOrder: 1 },
  ]);

  if (!skipEnrich) {
    try {
      await enrichFixtureFromSdmsMatch(ENG_FX, fx.externalMatchId, {
        replaceEvents: true,
        skipPerformanceStats: false,
      });
    } catch (e) {
      console.warn("england enrich warn", e instanceof Error ? e.message.slice(0, 160) : e);
    }
    try {
      await importMatchPerformanceStats(ENG_FX, fx.externalMatchId);
    } catch (e) {
      console.warn("england stats warn", e instanceof Error ? e.message.slice(0, 160) : e);
    }
    try {
      const bundle = await fetchSdmsMatchStats(fx.externalMatchId);
      if (bundle) {
        for (const parsed of parseSdmsMatchTeamStats(bundle)) {
          const teamId = parsed.side === "home" ? fx.homeTeamId! : fx.awayTeamId!;
          await upsertTeamMatchStat({
            fixtureId: ENG_FX,
            teamId,
            side: parsed.side,
            seasonId: fx.seasonId,
            competitionId: fx.competitionId,
            externalMatchId: fx.externalMatchId,
            stats: parsed,
          });
        }
      }
    } catch {
      /* optional */
    }
  }

  return { ok: true };
}

async function enrichSaSdmsFixtures() {
  if (skipEnrich) return { ok: 0, fail: 0 };
  const db = getDb();
  const rows = await db.execute(sql`
    select f.id, f.slug, f.external_match_id, f.home_team_id, f.away_team_id, f.season_id, f.competition_id
    from fixtures f
    where (f.home_team_id=${SA_ID}::uuid or f.away_team_id=${SA_ID}::uuid)
      and f.status='full_time'
      and f.external_match_id ~ '^[a-z0-9]{6,12}$'
    order by f.kickoff_at desc nulls last
    limit ${sdmsLimit}
  `);

  let ok = 0;
  let fail = 0;
  for (const [i, row] of (rows as any[]).entries()) {
    process.stdout.write(`[${i + 1}/${(rows as any[]).length}] ${row.slug}… `);
    try {
      // Prefer team-stats-only path (reliable); full player enrich can hang on empty squads.
      const bundle = await fetchSdmsMatchStats(row.external_match_id);
      if (bundle) {
        for (const parsed of parseSdmsMatchTeamStats(bundle)) {
          const teamId = parsed.side === "home" ? row.home_team_id : row.away_team_id;
          if (!teamId || !row.competition_id) continue;
          if (parsed.tries + parsed.carries + parsed.metres + parsed.tackles === 0) continue;
          await upsertTeamMatchStat({
            fixtureId: row.id,
            teamId,
            side: parsed.side,
            seasonId: row.season_id,
            competitionId: row.competition_id,
            externalMatchId: row.external_match_id,
            stats: parsed,
          });
        }
      }
      ok += 1;
      console.log("ok");
    } catch (e) {
      fail += 1;
      console.log("fail", e instanceof Error ? e.message.slice(0, 100) : e);
    }
    await sleep(250);
  }
  return { ok, fail };
}

async function rateMissingSaPlayers() {
  const db = getDb();
  const rows = await db.execute(sql`
    select distinct p.id, p.name
    from players p
    join fixture_players fp on fp.player_id=p.id
    join fixtures f on f.id=fp.fixture_id
    left join player_ratings pr on pr.player_id=p.id
    where fp.team_id=${SA_ID}::uuid
      and f.kickoff_at >= now() - interval '36 months'
      and (pr.player_id is null or pr.form_score is null or pr.player_rating is null
           or p.position_name is null or coalesce(trim(p.position_name),'')='')
    order by p.name
    limit 200
  `);
  let rated = 0;
  for (const row of rows as any[]) {
    try {
      await calculateAndPersistPlayerRating(row.id);
      rated += 1;
    } catch {
      /* skip */
    }
  }
  // Also rate named gaps from admin
  for (const name of [
    "Carlu Sadie",
    "Jean-Jacques Kotze",
    "Jean-Jacque Kotze",
    "Ben Dixon",
    "Ben Jason Dixon",
    "Lood de Jager",
    "Francois Louw",
    "Schalk Brits",
  ]) {
    const [p] = await db
      .select({ id: players.id })
      .from(players)
      .where(sql`lower(${players.name}) = ${name.toLowerCase()}`)
      .limit(1);
    if (!p) continue;
    try {
      await calculateAndPersistPlayerRating(p.id);
      rated += 1;
    } catch {
      /* skip */
    }
  }
  return { rated, targets: (rows as any[]).length };
}

const POSITION_SEEDS: Array<{ name: string; position: string }> = [
  { name: "Carlu Sadie", position: "Tighthead Prop" },
  { name: "Jean-Jacques Kotze", position: "Hooker" },
  { name: "Jean-Jacque Kotze", position: "Hooker" },
  { name: "Ben Dixon", position: "Hooker" },
  { name: "Ben Jason Dixon", position: "Hooker" },
  { name: "Lood de Jager", position: "Lock" },
  { name: "Francois Louw", position: "Flanker" },
  { name: "Schalk Brits", position: "Hooker" },
];

async function fillSaPlayerPositions() {
  const db = getDb();
  let updated = 0;
  for (const row of POSITION_SEEDS) {
    const res = await db.execute(sql`
      update players
      set position_name = ${row.position}
      where lower(name) = ${row.name.toLowerCase()}
        and (position_name is null or trim(position_name) = '' or lower(position_name) = 'replacement')
      returning id
    `);
    updated += (res as unknown as unknown[]).length;
  }
  return { updated };
}

const COACH_BIOS: Array<{ name: string; wikipediaUrl: string; bio: string }> = [
  {
    name: "Rassie Erasmus",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Rassie_Erasmus",
    bio: "South Africa head coach (and former Director of Rugby). Led the Springboks to Rugby World Cup titles in 2019 and 2023; previously a Springbok flanker and Stormers / Munster coach.",
  },
  {
    name: "Jerry Flannery",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Jerry_Flannery",
    bio: "Springboks defence / forwards coach. Former Ireland and Munster hooker who moved into coaching after retirement.",
  },
  {
    name: "Tony Brown",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Tony_Brown_(rugby_union)",
    bio: "Springboks attack coach. Former All Blacks fly-half with extensive Super Rugby and international coaching experience in Japan and New Zealand.",
  },
  {
    name: "Deon Davids",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Deon_Davids",
    bio: "Springboks forwards / assistant coach. Long-serving SA Rugby coach including Southern Kings and Junior Springboks pathways.",
  },
  {
    name: "Mzwandile Stick",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Mzwandile_Stick",
    bio: "Springboks assistant coach. Former Springbok sevens captain who joined the national XV coaching group under Rassie Erasmus.",
  },
  {
    name: "Daan Human",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Daan_Human",
    bio: "Springboks scrum coach. Former Springbok prop with coaching spells in Europe and South Africa before rejoining the national setup.",
  },
];

async function seedSaCoachBios() {
  const db = getDb();
  let updated = 0;
  for (const row of COACH_BIOS) {
    const res = await db.execute(sql`
      update coaches
      set bio_summary = coalesce(nullif(trim(bio_summary), ''), ${row.bio}),
          wikipedia_url = coalesce(nullif(trim(wikipedia_url), ''), ${row.wikipediaUrl})
      where lower(name) = ${row.name.toLowerCase()}
      returning id
    `);
    updated += (res as unknown as unknown[]).length;
  }

  // Persist coach ratings via intelligence packet (correct args: packet, teamId)
  const { buildCoachIntelligencePacket, persistCoachIntelligenceScore } = await import(
    "../apps/web/src/lib/coach-intelligence-service"
  );
  const staff = await db.execute(sql`
    select distinct c.id
    from team_coaching_staff tcs
    join coaches c on c.id = tcs.coach_id
    where tcs.team_id = ${SA_ID}::uuid and tcs.is_current = true
  `);
  let rated = 0;
  for (const row of staff as any[]) {
    try {
      const packet = await buildCoachIntelligencePacket(row.id);
      if (packet?.score?.calculatedScore != null) {
        await persistCoachIntelligenceScore(packet, SA_ID);
        rated += 1;
      }
    } catch {
      /* skip */
    }
  }
  return { updated, rated };
}

async function annotateEnglandSources() {
  const db = getDb();
  await db.execute(sql`
    update fixtures
    set provider_snapshot = coalesce(provider_snapshot, '{}'::jsonb) || ${JSON.stringify({
      primarySource: "planet_rugby",
      wikipediaUrl:
        "https://en.wikipedia.org/wiki/History_of_rugby_union_matches_between_England_and_South_Africa",
      sourceUrl:
        "https://en.wikipedia.org/wiki/History_of_rugby_union_matches_between_England_and_South_Africa",
      manualNotes: "Cross-linked Wikipedia England–South Africa history for H2H backfill",
    })}::jsonb,
        planet_rugby_url = coalesce(
          planet_rugby_url,
          'https://www.planetrugby.com/matches/46vodwkj/nations-championship/qo6gdo63/south-africa-v-england/2026-07-04'
        )
    where id = ${ENG_FX}::uuid
  `);
}

async function hideDemoBarbarians() {
  const db = getDb();
  await db.execute(sql`
    update fixtures
    set status='cancelled',
        additional_info=coalesce(nullif(additional_info,''), 'Demo / animation fixture — not an official Test')
    where slug='demo-sa-barb'
  `);
}

async function annotateCancelled2020() {
  const db = getDb();
  await db.execute(sql`
    update fixtures
    set additional_info='Cancelled — Springboks 2020 end-of-year tour not played (COVID-19)'
    where status='cancelled'
      and (home_team_id=${SA_ID}::uuid or away_team_id=${SA_ID}::uuid)
      and kickoff_at >= '2020-11-01' and kickoff_at < '2020-12-01'
  `);
}

async function main() {
  console.log("=== SA match depth backfill ===\n");

  console.log("1) Hide demo Barbarians + annotate COVID cancels…");
  await hideDemoBarbarians();
  await annotateCancelled2020();

  console.log("\n2) Seed England–South Africa historical tests (Wikipedia)…");
  console.log("  ", await seedEnglandSaHistory());

  console.log("\n3) Deepen England 2026 Nations Championship fixture…");
  console.log("  ", await deepenEnglandMatch());
  await annotateEnglandSources();

  console.log("\n4) SDMS team/player stats for recent SA full-time fixtures…");
  console.log("  ", await enrichSaSdmsFixtures());

  console.log("\n5) Fill positions + rate missing SA squad / departed players…");
  console.log("  ", await fillSaPlayerPositions());
  console.log("  ", await rateMissingSaPlayers());

  console.log("\n6) Coach bios + ratings…");
  console.log("  ", await seedSaCoachBios());

  const db = getDb();
  const engSa = await db.execute(sql`
    select count(*)::int as eng_sa_ft
    from fixtures f
    where ((f.home_team_id=${SA_ID}::uuid and f.away_team_id=${ENG_ID}::uuid)
        or (f.home_team_id=${ENG_ID}::uuid and f.away_team_id=${SA_ID}::uuid))
      and f.status='full_time'
  `);
  const carries = await db.execute(sql`
    select count(distinct tms.fixture_id)::int as sa_with_carries
    from team_match_stats tms
    where tms.team_id=${SA_ID}::uuid and tms.carries>0
  `);
  const engFx = await db.execute(sql`
    select home_score, away_score, status, attendance, kickoff_at
    from fixtures where id=${ENG_FX}::uuid
  `);
  console.log("\n=== Coverage ===");
  console.log({ engSa, carries, engFx });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
