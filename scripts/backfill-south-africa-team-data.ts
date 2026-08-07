/**
 * Comprehensive South Africa (Springboks) admin-team backfill.
 *
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-south-africa-team-data.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/backfill-south-africa-team-data.ts --skip-sdms
 */
import { and, desc, eq, or, sql } from "drizzle-orm";
import { fixtures, players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { repairTeamPlayerDisplayNames } from "../apps/web/src/lib/entity-admin-service";
import { enrichFixtureFromSdmsMatch } from "../apps/web/src/lib/planet-rugby-match-import-service";
import { importMatchPerformanceStats } from "../apps/web/src/lib/planet-rugby-player-stats-import-service";
import { resolveCoach, upsertCoachingStaffAssignment } from "../apps/web/src/lib/coach-admin-service";
import { createLegend, getTeamLegends } from "../apps/web/src/lib/legend-admin-service";
import { createInjury, listInjuries } from "../apps/web/src/lib/injury-admin-service";

const SA_ID = "b0000000-0000-4000-8000-000000000001";
const args = process.argv.slice(2);
const skipSdms = args.includes("--skip-sdms");
const sdmsLimit = Number(args.find((a) => a.startsWith("--sdms-limit="))?.split("=")[1] ?? 25);

const COACHING_STAFF: Array<{ name: string; role: string }> = [
  { name: "Rassie Erasmus", role: "head_coach" },
  { name: "Jerry Flannery", role: "defence_coach" },
  { name: "Tony Brown", role: "attack_coach" },
  { name: "Deon Davids", role: "forwards_coach" },
  { name: "Mzwandile Stick", role: "backs_coach" },
  { name: "Daan Human", role: "scrum_coach" },
];

/** Well-known Springbok legends to seed if the player exists. */
const LEGENDS: Array<{ name: string; level: string; era: string; reason: string }> = [
  { name: "Siya Kolisi", level: "icon", era: "2013–", reason: "First black Springbok captain; dual World Cup winner (2019, 2023)." },
  { name: "John Smit", level: "icon", era: "2000–2011", reason: "World Cup–winning captain (2007); most-capped Springbok captain of his era." },
  { name: "Francois Pienaar", level: "icon", era: "1993–1996", reason: "1995 Rugby World Cup–winning captain." },
  { name: "Bryan Habana", level: "icon", era: "2004–2016", reason: "All-time Springbok try-scoring great; 2007 World Cup winner." },
  { name: "Victor Matfield", level: "legend", era: "2001–2015", reason: "World-class lock; 2007 World Cup winner." },
  { name: "Schalk Burger", level: "legend", era: "2003–2015", reason: "World Cup winner; World Rugby Player of the Year 2004." },
  { name: "Jean de Villiers", level: "legend", era: "2002–2015", reason: "Springbok captain and midfield mainstay." },
  { name: "Percy Montgomery", level: "legend", era: "1997–2008", reason: "All-time leading Springbok points scorer." },
  { name: "Joost van der Westhuizen", level: "icon", era: "1993–2003", reason: "Legendary scrum-half; 1995 World Cup winner." },
  { name: "Os du Randt", level: "legend", era: "1994–2007", reason: "Dual World Cup winner (1995, 2007)." },
  { name: "Eben Etzebeth", level: "legend", era: "2012–", reason: "Most-capped Springbok; dual World Cup winner." },
  { name: "Pieter-Steph du Toit", level: "legend", era: "2013–", reason: "World Rugby Player of the Year; dual World Cup winner." },
  { name: "Malcolm Marx", level: "notable", era: "2016–", reason: "Elite World Cup–winning hooker." },
  { name: "Cheslin Kolbe", level: "notable", era: "2018–", reason: "Dual World Cup winner; electrifying wing." },
  { name: "Handré Pollard", level: "notable", era: "2014–", reason: "Dual World Cup winner; pivotal goal-kicker." },
  { name: "Danie Craven", level: "icon", era: "1931–1938", reason: "Springbok legend and transformational rugby administrator." },
];

const AVAILABILITY: Array<{
  name: string;
  injuryType: string;
  bodyArea?: string;
  status: string;
  notes: string;
  sourceUrl: string;
}> = [
  {
    name: "Eben Etzebeth",
    injuryType: "Concussion management",
    bodyArea: "Head",
    status: "out",
    notes: "Managed cautiously due to concussion history; targeted return around August Argentina window per Bok camp updates.",
    sourceUrl: "https://www.thesouthafrican.com/sport/rugby/springboks/springboks-full-injury-update-concern-over-eben-etzebeth-concussion/",
  },
  {
    name: "Siya Kolisi",
    injuryType: "Niggle / managed return",
    bodyArea: "General",
    status: "doubtful",
    notes: "Senior players managed through July Tests; expected available for Argentinaaway window.",
    sourceUrl: "https://www.sabcsport.com/rugby/news/rassie-explains-decision-to-delay-kolisi-and-etzebeth-returns-against-wales",
  },
  {
    name: "Franco Mostert",
    injuryType: "Ankle",
    bodyArea: "Ankle",
    status: "injured",
    notes: "Ankle injury sidelined during early Nations Championship window.",
    sourceUrl: "https://supersport.com/rugby/news/7a1b4278-1285-4a3a-963f-340ddd3026d8/norton-s-injury-sees-louw-called-up-to-boks",
  },
  {
    name: "Lood de Jager",
    injuryType: "Illness / recovery",
    bodyArea: "General",
    status: "doubtful",
    notes: "Unavailable during Scotland/Wales window; managed for later Tests.",
    sourceUrl: "https://www.thesouthafrican.com/sport/rugby/springboks/springboks-full-injury-update-concern-over-eben-etzebeth-concussion/",
  },
  {
    name: "Ox Nché",
    injuryType: "Niggle",
    bodyArea: "General",
    status: "doubtful",
    notes: "Unavailable during early Nations Championship tests while managed.",
    sourceUrl: "https://www.rugbypass.com/news/springboks-make-10-changes-for-scotland-as-rassie-swing-selection-axe/",
  },
  {
    name: "André Esterhuizen",
    injuryType: "Niggle",
    bodyArea: "General",
    status: "doubtful",
    notes: "Unavailable for selection during Scotland week per Bok injury update.",
    sourceUrl: "https://www.thesouthafrican.com/sport/rugby/springboks/springboks-full-injury-update-concern-over-eben-etzebeth-concussion/",
  },
  {
    name: "Ethan Hooker",
    injuryType: "Niggle",
    bodyArea: "General",
    status: "doubtful",
    notes: "Unavailable for selection during Scotland week per Bok injury update.",
    sourceUrl: "https://www.thesouthafrican.com/sport/rugby/springboks/springboks-full-injury-update-concern-over-eben-etzebeth-concussion/",
  },
  {
    name: "Riley Norton",
    injuryType: "Hamstring (grade 3)",
    bodyArea: "Hamstring",
    status: "out",
    notes: "Grade 3 hamstring — estimated 8–10 weeks out from mid/late June 2026 training setback.",
    sourceUrl: "https://www.sabcsport.com/rugby/news/erasmus-explains-louw-omission-for-england-test-confirms-norton-injury",
  },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function findPlayerByName(name: string) {
  const db = getDb();
  const [exact] = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(sql`lower(${players.name}) = ${name.toLowerCase()}`)
    .limit(1);
  if (exact) return exact;
  // Tolerate accents / hyphens
  const needle = name.toLowerCase().replace(/[^a-z0-9]+/g, "%");
  const [fuzzy] = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(sql`lower(${players.name}) like ${`%${needle.replace(/%+/g, "%")}%`}`)
    .limit(1);
  return fuzzy ?? null;
}

/** Published attendances researched from official match reports / BokHist / Lions site. */
const PUBLISHED_ATTENDANCE: Array<{ slug: string; attendance: number; source: string }> = [
  {
    slug: "south-africa-v-barbarians-2026-06-20",
    attendance: 26398,
    source: "SA Rugby match report (Nelson Mandela Bay)",
  },
  {
    slug: "south-africa-v-england-2026-07-04",
    attendance: 52790,
    source: "Nations Championship post-match report (Ellis Park)",
  },
  {
    slug: "south-africa-v-scotland-2026-07-11",
    attendance: 45053,
    source: "Nations Championship post-match report (Loftus Versfeld)",
  },
  {
    slug: "south-africa-v-wales-2026-07-18",
    attendance: 40933,
    source: "Nations Championship post-match report (Kings Park)",
  },
  {
    slug: "new-zealand-v-south-africa-2023-10-28",
    attendance: 80065,
    source: "Wikipedia / Reuters — RWC 2023 final",
  },
  {
    slug: "south-africa-v-british-irish-lions-2021-07-24",
    attendance: 0,
    source: "COVID behind closed doors (Cape Town Stadium)",
  },
  {
    slug: "south-africa-v-british-irish-lions-2021-07-31",
    attendance: 0,
    source: "COVID behind closed doors (Cape Town Stadium)",
  },
  {
    slug: "south-africa-v-british-irish-lions-2021-08-07",
    attendance: 0,
    source: "COVID behind closed doors (Cape Town Stadium)",
  },
  {
    slug: "south-africa-v-argentina-2021-08-14",
    attendance: 0,
    source: "COVID behind closed doors (NMB Stadium) — BokHist 0",
  },
  {
    slug: "argentina-v-south-africa-2021-08-21",
    attendance: 0,
    source: "COVID behind closed doors (NMB Stadium) — BokHist 0",
  },
  {
    slug: "france-go9p0p68-v-south-africa-2018-11-10",
    attendance: 78750,
    source: "BokHist GameID 493 — Stade de France",
  },
  {
    slug: "south-africa-v-british-lions-1997-06-21",
    attendance: 50099,
    source: "British & Irish Lions official archive — Newlands 1st Test",
  },
];

async function seedPublishedAttendances() {
  const db = getDb();
  let updated = 0;
  let skipped = 0;
  let missing = 0;
  for (const entry of PUBLISHED_ATTENDANCE) {
    const [row] = await db
      .select({ id: fixtures.id, attendance: fixtures.attendance })
      .from(fixtures)
      .where(eq(fixtures.slug, entry.slug))
      .limit(1);
    if (!row) {
      missing += 1;
      console.log(`  attendance miss slug: ${entry.slug}`);
      continue;
    }
    if (row.attendance != null) {
      skipped += 1;
      continue;
    }
    await db
      .update(fixtures)
      .set({ attendance: entry.attendance })
      .where(eq(fixtures.id, row.id));
    updated += 1;
    console.log(`  attendance ${entry.slug} → ${entry.attendance} (${entry.source})`);
  }
  return { updated, skipped, missing };
}

async function enrichSdmsForSa() {
  if (skipSdms) {
    console.log("Skipping SDMS (--skip-sdms)");
    return { ok: 0, fail: 0, failures: [] as string[] };
  }
  const db = getDb();
  // Prefer FT fixtures with compact SDMS ids that still lack advanced player stats.
  const missingAdv = await db.execute(sql`
    select f.id, f.slug, f.external_match_id as "externalMatchId", f.kickoff_at as "kickoffAt"
    from fixtures f
    where (f.home_team_id = ${SA_ID} or f.away_team_id = ${SA_ID})
      and f.status = 'full_time'
      and f.external_match_id ~ '^[a-z0-9]{6,12}$'
      and not exists (
        select 1 from player_match_performance_stats p
        where p.fixture_id = f.id
          and p.team_id = ${SA_ID}
          and (p.carries > 0 or p.metres_carried > 0 or p.tackles_completed > 0)
      )
    order by f.kickoff_at desc nulls last
    limit ${sdmsLimit}
  `);
  let rows = missingAdv as unknown as Array<{
    id: string;
    slug: string;
    externalMatchId: string | null;
    kickoffAt: Date | null;
  }>;
  if (!rows.length) {
    rows = await db
      .select({
        id: fixtures.id,
        slug: fixtures.slug,
        externalMatchId: fixtures.externalMatchId,
        kickoffAt: fixtures.kickoffAt,
      })
      .from(fixtures)
      .where(
        and(
          or(eq(fixtures.homeTeamId, SA_ID), eq(fixtures.awayTeamId, SA_ID)),
          sql`${fixtures.externalMatchId} ~ '^[a-z0-9]{6,12}$'`,
        ),
      )
      .orderBy(desc(fixtures.kickoffAt))
      .limit(sdmsLimit);
  }

  console.log(`SDMS enrich candidates: ${rows.length}`);
  let ok = 0;
  let fail = 0;
  const failures: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    process.stdout.write(`[${i + 1}/${rows.length}] ${row.slug} (${row.externalMatchId})… `);
    try {
      await enrichFixtureFromSdmsMatch(row.id, row.externalMatchId!, {
        replaceEvents: false,
      });
      try {
        await importMatchPerformanceStats(row.id, row.externalMatchId!);
      } catch {
        // performance optional if events landed
      }
      ok += 1;
      console.log("ok");
    } catch (e) {
      fail += 1;
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`${row.slug}: ${msg}`);
      console.log("fail", msg.slice(0, 120));
    }
    await sleep(350);
  }
  return { ok, fail, failures };
}

async function seedCoaches() {
  let created = 0;
  let updated = 0;
  for (const entry of COACHING_STAFF) {
    const coach = await resolveCoach({ name: entry.name, createIfMissing: true });
    if (!coach) continue;
    const res = await upsertCoachingStaffAssignment({
      coachId: coach.id,
      teamId: SA_ID,
      role: entry.role,
      isCurrent: true,
      importKey: `sa-staff:2026:${entry.role}:${coach.slug}`,
      notes: "Springboks current coaching group (2026)",
    });
    if (res.created) created += 1;
    else updated += 1;
  }
  return { created, updated };
}

async function seedLegends() {
  const existing = await getTeamLegends(SA_ID);
  const existingPlayerIds = new Set(existing.map((l) => l.playerId));
  let created = 0;
  let missingPlayers = 0;
  let skipped = 0;
  for (const legend of LEGENDS) {
    const player = await findPlayerByName(legend.name);
    if (!player) {
      missingPlayers += 1;
      console.log(`  legend miss player: ${legend.name}`);
      continue;
    }
    if (existingPlayerIds.has(player.id)) {
      skipped += 1;
      continue;
    }
    await createLegend({
      playerId: player.id,
      legendLevel: legend.level,
      legendStatus: "active",
      teamId: SA_ID,
      internationalTeamId: SA_ID,
      countryName: "South Africa",
      era: legend.era,
      reason: legend.reason,
      careerSummary: legend.reason,
      sourceUrl: "https://en.wikipedia.org/wiki/South_Africa_national_rugby_union_team",
    });
    created += 1;
    console.log(`  legend + ${player.name}`);
  }
  return { created, skipped, missingPlayers };
}

async function seedAvailability() {
  const existing = await listInjuries({ teamId: SA_ID });
  const existingNames = new Set(
    existing.map((r) => (r.playerName ?? "").toLowerCase()).filter(Boolean),
  );
  let created = 0;
  let skipped = 0;
  let missing = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const row of AVAILABILITY) {
    if (existingNames.has(row.name.toLowerCase())) {
      skipped += 1;
      continue;
    }
    // also try without accents
    const player =
      (await findPlayerByName(row.name)) ??
      (await findPlayerByName(row.name.normalize("NFD").replace(/\p{M}/gu, "")));
    if (!player) {
      missing += 1;
      console.log(`  availability miss player: ${row.name}`);
      continue;
    }
    await createInjury({
      playerId: player.id,
      teamId: SA_ID,
      injuryType: row.injuryType,
      bodyArea: row.bodyArea ?? null,
      status: row.status,
      dateReported: today,
      injuryDate: today,
      source: "editorial_backfill",
      sourceUrl: row.sourceUrl,
      notes: row.notes,
      lastVerifiedDate: today,
    });
    created += 1;
    console.log(`  availability + ${player.name} (${row.status})`);
  }
  return { created, skipped, missing };
}

async function main() {
  console.log("=== South Africa full data backfill ===\n");

  console.log("1) Repair reversed player display names…");
  const names = await repairTeamPlayerDisplayNames(SA_ID);
  console.log(`   updated ${names.count}`, names.updated.slice(0, 15));

  console.log("\n2) Fill South Africa nation / international team on squad-linked players…");
  const db = getDb();
  const saPlayers = await db.execute(sql`
    select distinct p.id, p.name, p.country_name, p.nation_code, p.international_team_id
    from players p
    left join fixture_players fp on fp.player_id = p.id
    where p.club_team_id = ${SA_ID}
       or p.international_team_id = ${SA_ID}
       or fp.team_id = ${SA_ID}
  `);
  const saRows = saPlayers as unknown as Array<{
    id: string;
    name: string;
    country_name: string | null;
    nation_code: string | null;
    international_team_id: string | null;
  }>;
  let nationFilled = 0;
  let intlLinked = 0;
  for (const row of saRows) {
    const patch: Partial<{
      countryName: string;
      nationCode: string;
      internationalTeamId: string;
    }> = {};
    if (!row.country_name?.trim()) patch.countryName = "South Africa";
    if (!row.nation_code?.trim()) patch.nationCode = "ZA";
    if (!row.international_team_id) patch.internationalTeamId = SA_ID;
    if (!Object.keys(patch).length) continue;
    await db.update(players).set(patch).where(eq(players.id, row.id));
    if (patch.countryName || patch.nationCode) nationFilled += 1;
    if (patch.internationalTeamId) intlLinked += 1;
  }
  console.log(`   players=${saRows.length} nationFilled=${nationFilled} intlLinked=${intlLinked}`);

  console.log("\n3) Seed published attendances…");
  console.log("  ", await seedPublishedAttendances());

  console.log("\n4) SDMS enrich recent SA fixtures (lineups / attendance / team+player stats)…");
  const sdms = await enrichSdmsForSa();
  console.log(`   ok=${sdms.ok} fail=${sdms.fail}`);
  if (sdms.failures.length) console.log("   sample failures:", sdms.failures.slice(0, 5));

  console.log("\n5) Coaching staff…");
  console.log("  ", await seedCoaches());

  console.log("\n6) Club legends…");
  console.log("  ", await seedLegends());

  console.log("\n7) Team availability (injuries)…");
  console.log("  ", await seedAvailability());

  console.log("\n8) Roll up team match stats from events (fix empty SDMS shells)…");
  const { spawnSync } = await import("node:child_process");
  const rollup = spawnSync(
    "npx",
    ["tsx", "--require", "./scripts/stub-server-only.cjs", "scripts/sync-sa-team-match-stats-from-events.ts"],
    { cwd: process.cwd(), encoding: "utf8", stdio: "inherit" },
  );
  if (rollup.status !== 0) {
    console.warn("   rollup exited non-zero:", rollup.status);
  }

  const cov = await db.execute(sql`
    select
      (select count(*)::int from fixtures f where (f.home_team_id=${SA_ID} or f.away_team_id=${SA_ID}) and f.status='full_time') as ft_fixtures,
      (select count(distinct tms.fixture_id)::int from team_match_stats tms where tms.team_id=${SA_ID}) as fixtures_with_team_stats,
      (select count(distinct tms.fixture_id)::int from team_match_stats tms where tms.team_id=${SA_ID} and (tms.tries>0 or tms.carries>0 or tms.metres>0)) as team_stats_with_signal,
      (select count(*)::int from fixtures f where (f.home_team_id=${SA_ID} or f.away_team_id=${SA_ID}) and f.status='full_time' and f.attendance is null) as ft_no_attendance,
      (select count(*)::int from team_coaching_staff tcs where tcs.team_id=${SA_ID} and tcs.is_current) as current_coaches,
      (select count(*)::int from player_legends pl where pl.team_id=${SA_ID} or pl.international_team_id=${SA_ID}) as legends,
      (select count(*)::int from player_injuries pi where pi.team_id=${SA_ID} and pi.status in ('injured','out','doubtful','active')) as active_injuries
  `);
  console.log("\n=== Coverage after ===");
  console.log(cov);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
