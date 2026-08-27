/**
 * Enrich the current Springboks match-day / touring squad (named list).
 * Coaches are skipped. Official springboks.rugby headshots forced primary.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/enrich-current-springboks-squad.ts --write
 */
import { eq, sql } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import {
  fetchSpringboksSquadCards,
  type SpringboksSquadCard,
} from "../apps/web/src/lib/springboks-rugby-parse";
import { registerSpringboksOfficialImage } from "../apps/web/src/lib/player-image-service";
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";
import {
  fetchUltimateRugbyHtml,
  fetchUltimateRugbyPlayerByName,
  parseUltimateRugbyNewsHtml,
} from "../apps/web/src/lib/ultimate-rugby-parse";
import { importUltimateRugbyPlayerProfile } from "../apps/web/src/lib/ultimate-rugby-import-service";
import { syncTransfersFromClubCareerStints } from "../apps/web/src/lib/career-transfer-sync-service";
import { backfillPlayerValueHistory } from "../apps/web/src/lib/player-value-history-service";
import { calculateAndPersistPlayerValue } from "../apps/web/src/lib/player-value-service";
import { recalculatePlayerScoutProfile } from "../apps/web/src/lib/player-scout-intelligence-service";

const SA = "b0000000-0000-4000-8000-000000000001";

/** Current squad names (players only — coaches listed separately and skipped). */
const SQUAD_NAMES = [
  "Thomas du Toit",
  "Wilco Louw",
  "Ox Nché",
  "Ox Nche",
  "Zachary Porthen",
  "Carlu Sadie",
  "Gerhard Steenekamp",
  "Boan Venter",
  "Johan Grobbelaar",
  "Malcolm Marx",
  "Lood de Jager",
  "Eben Etzebeth",
  "Ruan Nortje",
  "Paul de Villiers",
  "Ben-Jason Dixon",
  "Cameron Hanekom",
  "Siya Kolisi",
  "Elrigh Louw",
  "Jasper Wiese",
  "Pieter-Steph du Toit",
  "Franco Mostert",
  "Vincent Tshituka",
  "Marco van Staden",
  "Jan-Hendrik Wessels",
  "Cobus Wiese",
  "Herschel Jantjies",
  "Cobus Reinach",
  "Morne van den Berg",
  "Grant Williams",
  "Manie Libbok",
  "Sacha Feinberg-Mngomezulu",
  "Vusi Moyo",
  "Handre Pollard",
  "Damian de Allende",
  "Andre Esterhuizen",
  "Jesse Kriel",
  "Kurt-Lee Arendse",
  "Aphelele Fassi",
  "Ethan Hooker",
  "Quan Horn",
  "Cheslin Kolbe",
  "Canan Moodie",
  "Edwill van der Merwe",
  "Damian Willemse",
  "Ntuthuko Mchunu",
  "Evan Roos",
  "Andre-Hugo Venter",
  "Jaco Williams",
  "Embrose Papier",
  "Ruben van Heerden",
];

const COACHES = [
  "Rassie Erasmus",
  "Tony Brown",
  "Mzwandile Stick",
  "Jerry Flannery",
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function defaultPreferredFoot(position: string | null): string | null {
  if (!position) return null;
  const p = position.toLowerCase();
  if (/fly|centre|center|full.?back|wing|scrum.?half|out.?half|stand.?off/.test(p)) return "Right";
  return null;
}

async function findPlayer(name: string) {
  const db = getDb();
  const n = normName(name);
  const slugGuess = n.replace(/\s+/g, "-").replace(/'/g, "");
  const r = await db.execute(sql`
    select id, name, slug, wikipedia_url as "wikipediaUrl", image_url as "imageUrl",
           preferred_foot as "preferredFoot", squad_number as "squadNumber",
           position_name as "positionName"
    from players
    where lower(name) = lower(${name})
       or lower(translate(name, 'éëêèáàäöôúùüñÉ', 'eeeeaaaouuunE')) = ${n}
       or slug = ${slugGuess}
       or slug like ${`${slugGuess}-%`}
       or name ilike ${`%${name.replace(/-/g, " ")}%`}
    order by
      case when lower(name) = lower(${name}) then 0
           when slug = ${slugGuess} then 1
           when slug like ${`${slugGuess}-%`} then 2
           else 3 end,
      length(slug) asc
    limit 1
  `);
  const rows = Array.isArray(r) ? r : ((r as { rows?: unknown[] }).rows ?? []);
  return (rows[0] ?? null) as {
    id: string;
    name: string;
    slug: string;
    wikipediaUrl: string | null;
    imageUrl: string | null;
    preferredFoot: string | null;
    squadNumber: number | null;
    positionName: string | null;
  } | null;
}

async function backfillSquadNumber(playerId: string): Promise<number | null> {
  const db = getDb();
  const j = await db.execute(sql`
    select jersey_number as n, count(*)::int as c
    from fixture_players
    where player_id = ${playerId} and jersey_number is not null and jersey_number > 0
    group by jersey_number
    order by c desc, jersey_number asc
    limit 1
  `);
  const rows = Array.isArray(j) ? j : ((j as { rows?: { n: number }[] }).rows ?? []);
  return rows[0]?.n != null ? Number(rows[0].n) : null;
}

function matchSquadCard(
  name: string,
  cards: SpringboksSquadCard[],
): SpringboksSquadCard | null {
  const n = normName(name);
  return (
    cards.find((c) => normName(c.name) === n) ??
    cards.find((c) => normName(`${c.firstName} ${c.lastName}`) === n) ??
    cards.find((c) => n.includes(normName(c.lastName)) && n.includes(normName(c.firstName.split("-")[0] ?? ""))) ??
    null
  );
}

async function main() {
  const dryRun = !process.argv.includes("--write");
  const delayMs = 350;
  const uniqueNames = [...new Set(SQUAD_NAMES.map((n) => n.trim()))].filter(
    (n) => !/^ox nch/i.test(n) || n === "Ox Nché" || n === "Ox Nche",
  );
  // Dedupe Ox variants to one preferred spelling for lookup order
  const names = uniqueNames.filter((n, i, arr) => {
    if (/^ox nch/i.test(n)) return arr.findIndex((x) => /^ox nch/i.test(x)) === i;
    return true;
  });

  console.log(
    `${dryRun ? "[DRY RUN] " : ""}Current Springboks squad enrich (${names.length} players; coaches skipped: ${COACHES.join(", ")})`,
  );

  let cards: SpringboksSquadCard[] = [];
  try {
    cards = await fetchSpringboksSquadCards();
    console.log(`springboks.rugby cards: ${cards.length}`);
  } catch (e) {
    console.log(`squad fetch failed: ${e instanceof Error ? e.message : e}`);
  }

  const db = getDb();
  const missing: string[] = [];
  let ok = 0;

  for (const [i, name] of names.entries()) {
    console.log(`[${i + 1}/${names.length}] ${name}`);
    const row = await findPlayer(name);
    if (!row) {
      console.log("  MISSING in DB");
      missing.push(name);
      continue;
    }

    const card = matchSquadCard(name, cards);
    if (dryRun) {
      console.log(`  id=${row.id} slug=${row.slug} card=${card?.slug ?? "—"}`);
      continue;
    }

    const foot = row.preferredFoot ?? defaultPreferredFoot(row.positionName ?? card?.position ?? null);
    let squadNumber = row.squadNumber;
    if (squadNumber == null) squadNumber = await backfillSquadNumber(row.id);

    let nextSlug = row.slug;
    if (card && row.slug !== card.slug) {
      const [taken] = await db
        .select({ id: players.id })
        .from(players)
        .where(eq(players.slug, card.slug))
        .limit(1);
      if (!taken || taken.id === row.id) nextSlug = card.slug;
    }

    await db
      .update(players)
      .set({
        slug: nextSlug,
        internationalTeamId: SA,
        countryName: "South Africa",
        positionName: card?.position ?? row.positionName ?? undefined,
        preferredFoot: foot ?? undefined,
        squadNumber: squadNumber ?? undefined,
        isPublic: true,
        publishStatus: "published",
        updatedAt: new Date(),
      })
      .where(eq(players.id, row.id));

    if (card?.imageUrl) {
      const img = await registerSpringboksOfficialImage(row.id, card.imageUrl, {
        sourcePageUrl: card.profileUrl,
        playerName: row.name,
        forcePrimary: true,
      });
      console.log(`  image ${img.reason}`);
    } else {
      console.log("  image no springboks.rugby card");
    }

    try {
      console.log("  → wikipedia…");
      const wiki = await withTimeout(
        enrichPlayerFromWikipedia(row.id, row.name, {
          fillMissingOnly: false,
          sourceUrl: row.wikipediaUrl ?? undefined,
        }),
        90_000,
        "wikipedia",
      );
      console.log(`  ← wiki ${wiki.enriched ? `ok(${wiki.careerStints ?? 0})` : wiki.reason ?? "noop"}`);
    } catch (e) {
      console.log(`  ← wiki ${e instanceof Error ? e.message : e}`);
    }

    try {
      console.log("  → ultimate rugby…");
      const profile = await withTimeout(fetchUltimateRugbyPlayerByName(row.name), 45_000, "ur");
      if (!profile) {
        console.log("  ← ur not_found");
      } else {
        let newsItems: Awaited<ReturnType<typeof parseUltimateRugbyNewsHtml>> = [];
        try {
          const newsHtml = await withTimeout(
            fetchUltimateRugbyHtml(`${profile.url}/news`),
            25_000,
            "ur-news",
          );
          newsItems = parseUltimateRugbyNewsHtml(newsHtml, profile.path);
        } catch {
          newsItems = [];
        }
        const ur = await importUltimateRugbyPlayerProfile(profile, {
          internationalTeamId: SA,
          countryName: "South Africa",
          dryRun: false,
          newsItems,
        });
        console.log(
          `  ← ur ${ur.skipped ?? `ok(bio=${ur.bioChars},stints=${ur.careerStints},news=${ur.newsItems})`}`,
        );
      }
    } catch (e) {
      console.log(`  ← ur ${e instanceof Error ? e.message : e}`);
    }

    try {
      const xfer = await syncTransfersFromClubCareerStints(row.id);
      console.log(`  ← transfers +${xfer.created}/~${xfer.updated}`);
    } catch (e) {
      console.log(`  ← transfers ${e instanceof Error ? e.message : e}`);
    }

    try {
      console.log("  → value…");
      const vh = await withTimeout(
        backfillPlayerValueHistory(row.id, { range: "career" }),
        120_000,
        "value",
      );
      try {
        await withTimeout(calculateAndPersistPlayerValue(row.id), 45_000, "value-live");
      } catch {
        /* optional */
      }
      console.log(`  ← value +${vh.inserted}/skip${vh.skipped}`);
    } catch (e) {
      console.log(`  ← value ${e instanceof Error ? e.message : e}`);
    }

    try {
      console.log("  → scout…");
      await withTimeout(recalculatePlayerScoutProfile(row.id), 90_000, "scout");
      console.log("  ← scout ok");
    } catch (e) {
      console.log(`  ← scout ${e instanceof Error ? e.message : e}`);
    }

    ok += 1;
    await sleep(delayMs);
  }

  console.log("\nDone", { ok, missing, coachesSkipped: COACHES, dryRun });
  if (missing.length) console.log("Still need DB rows for:", missing.join(", "));
  if (dryRun) console.log("Re-run with --write to apply.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
