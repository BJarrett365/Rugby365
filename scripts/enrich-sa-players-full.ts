/**
 * Fully enrich South Africa squad + transfer-linked players from Wikipedia
 * (and RugbyPass fill-missing), then refresh career-derived transfers.
 *
 * Usage:
 *   set -a && source .env && set +a
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/enrich-sa-players-full.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/enrich-sa-players-full.ts --limit=40
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/enrich-sa-players-full.ts --player=jean-kleyn
 */
import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { playerTransfers, players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { syncTransfersFromClubCareerStints } from "../apps/web/src/lib/career-transfer-sync-service";
import { enrichPlayerFromWikipedia } from "../apps/web/src/lib/wikipedia-import-service";
import { enrichPlayerFromRugbyPass } from "../apps/web/src/lib/rugbypass-player-import-service";

const SA_ID = "b0000000-0000-4000-8000-000000000001";

/** Explicit wiki titles when name search is unreliable. */
const WIKI_URL_BY_NAME: Record<string, string> = {
  "jean kleyn": "https://en.wikipedia.org/wiki/Jean_Kleyn",
  "siya kolisi": "https://en.wikipedia.org/wiki/Siya_Kolisi",
  "cheslin kolbe": "https://en.wikipedia.org/wiki/Cheslin_Kolbe",
  "eben etzebeth": "https://en.wikipedia.org/wiki/Eben_Etzebeth",
  "handre pollard": "https://en.wikipedia.org/wiki/Handré_Pollard",
  "handré pollard": "https://en.wikipedia.org/wiki/Handré_Pollard",
  "damian de allende": "https://en.wikipedia.org/wiki/Damian_de_Allende",
  "pieter-steph du toit": "https://en.wikipedia.org/wiki/Pieter-Steph_du_Toit",
  "faf de klerk": "https://en.wikipedia.org/wiki/Faf_de_Klerk",
  "malcolm marx": "https://en.wikipedia.org/wiki/Malcolm_Marx",
  "malcom marx": "https://en.wikipedia.org/wiki/Malcolm_Marx",
  "kwagga smith": "https://en.wikipedia.org/wiki/Kwagga_Smith",
  "jesse kriel": "https://en.wikipedia.org/wiki/Jesse_Kriel",
  "francois mostert": "https://en.wikipedia.org/wiki/Franco_Mostert",
  "franco mostert": "https://en.wikipedia.org/wiki/Franco_Mostert",
  "andre esterhuizen": "https://en.wikipedia.org/wiki/André_Esterhuizen",
  "andré esterhuizen": "https://en.wikipedia.org/wiki/André_Esterhuizen",
  "jean-luc du preez": "https://en.wikipedia.org/wiki/Jean-Luc_du_Preez",
  "embrose papier": "https://en.wikipedia.org/wiki/Embrose_Papier",
  "damian willemse": "https://en.wikipedia.org/wiki/Damian_Willemse",
  "cobus reinach": "https://en.wikipedia.org/wiki/Cobus_Reinach",
  "cobus wiese": "https://en.wikipedia.org/wiki/Cobus_Wiese",
  "jasper wiese": "https://en.wikipedia.org/wiki/Jasper_Wiese",
  "jordan els": "https://en.wikipedia.org/wiki/Jordan_Els_(rugby_union)",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function argValue(flag: string): string | null {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : null;
}

async function fetchSquadPlayerNames(): Promise<string[]> {
  const api = new URL("https://en.wikipedia.org/w/api.php");
  api.searchParams.set("action", "parse");
  api.searchParams.set("page", "South Africa national rugby union team");
  api.searchParams.set("prop", "wikitext");
  api.searchParams.set("format", "json");
  api.searchParams.set("formatversion", "2");
  const res = await fetch(api, {
    headers: { "User-Agent": "Rugby365Bot/1.0 (sa-player-enrich; local)" },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { parse?: { wikitext?: string } };
  const text = json.parse?.wikitext ?? "";
  const section = text.split(/==\s*Current squad\s*==/i)[1]?.split(/^==[^=]/m)[0] ?? "";
  const names = new Set<string>();
  for (const match of section.matchAll(/\{\{\s*(?:rlp|rugbyunionplayer|player)\s*\|\s*([^}|]+)/gi)) {
    const name = match[1]!.replace(/_/g, " ").trim();
    if (name.includes(" ")) names.add(name);
  }
  for (const match of section.matchAll(/(?:player|name|captain)\s*=\s*\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/gi)) {
    const name = match[1]!.trim();
    if (name.includes(" ") && !/rugby|stadium|cup/i.test(name)) names.add(name);
  }
  return [...names];
}

async function loadTargets(limit: number, playerFilter: string | null) {
  const db = getDb();

  if (playerFilter) {
    const q = `%${playerFilter.replace(/-/g, " ")}%`;
    return db
      .select({
        id: players.id,
        name: players.name,
        slug: players.slug,
        wikipediaUrl: players.wikipediaUrl,
        archiveSyncedAt: players.archiveSyncedAt,
        heightCm: players.heightCm,
        birthDate: players.birthDate,
      })
      .from(players)
      .where(or(ilike(players.slug, `%${playerFilter}%`), ilike(players.name, q)))
      .limit(limit);
  }

  // Priority: SA internationals who appear in transfers OR are missing core bio, newest first.
  const rows = await db.execute(sql`
    with sa as (
      select p.id, p.name, p.slug, p.wikipedia_url, p.archive_synced_at, p.height_cm, p.birth_date,
        case
          when p.height_cm is null then 0 else 1 end
          + case when p.birth_date is null then 0 else 1 end
          + case when coalesce(p.school, '') = '' then 0 else 1 end
          + case when p.archive_synced_at is null then 0 else 1 end as completeness,
        exists (
          select 1 from player_transfers pt where pt.player_id = p.id
        ) as has_transfer
      from players p
      where p.international_team_id = ${SA_ID}
        and coalesce(p.name, '') <> ''
        and p.name !~* '(rugby union|stadium|captain \\(sports\\)|news24|test match)'
    )
    select id, name, slug, wikipedia_url as "wikipediaUrl", archive_synced_at as "archiveSyncedAt",
           height_cm as "heightCm", birth_date as "birthDate"
    from sa
    order by
      has_transfer desc,
      completeness asc,
      archive_synced_at nulls first,
      name asc
    limit ${limit}
  `);

  const list = Array.isArray(rows) ? rows : ((rows as { rows?: unknown[] }).rows ?? []);
  return list as Array<{
    id: string;
    name: string;
    slug: string;
    wikipediaUrl: string | null;
    archiveSyncedAt: Date | null;
    heightCm: number | null;
    birthDate: string | null;
  }>;
}

async function fixReleasedDestinations() {
  const db = getDb();
  const updated = await db
    .update(playerTransfers)
    .set({ toClub: "Released" })
    .where(
      and(
        eq(playerTransfers.movementType, "released"),
        or(isNull(playerTransfers.toClub), eq(playerTransfers.toClub, "")),
      ),
    )
    .returning({ id: playerTransfers.id });
  return updated.length;
}

async function main() {
  const limit = Number(argValue("--limit") ?? "120");
  const playerFilter = argValue("--player");
  const skipRugbyPass = process.argv.includes("--skip-rugbypass");
  const delayMs = Number(argValue("--delay") ?? "500");

  console.log("→ Patching released transfers with empty destination…");
  const releasedFixed = await fixReleasedDestinations();
  console.log(`  updated ${releasedFixed} released rows → to_club='Released'`);

  // Ensure squad page names are at least resolvable later (linked to SA).
  if (!playerFilter) {
    try {
      const squadNames = await fetchSquadPlayerNames();
      console.log(`→ Current Springboks squad wiki names: ${squadNames.length}`);
    } catch {
      console.log("→ Could not read Current squad (continuing with transfer-linked SA players)");
    }
  }

  const targets = await loadTargets(limit, playerFilter);
  console.log(`→ Enriching ${targets.length} players (limit=${limit})…`);

  let wikiOk = 0;
  let wikiFail = 0;
  let rpOk = 0;
  let transfersSynced = 0;

  for (const [index, player] of targets.entries()) {
    const key = player.name.trim().toLowerCase();
    const sourceUrl = WIKI_URL_BY_NAME[key] ?? player.wikipediaUrl ?? undefined;
    process.stdout.write(`[${index + 1}/${targets.length}] ${player.name}… `);

    try {
      const wiki = await enrichPlayerFromWikipedia(player.id, player.name, {
        fillMissingOnly: false,
        sourceUrl,
      });
      if (wiki.enriched || wiki.careerStints) {
        wikiOk += 1;
        process.stdout.write(`wiki✓(${wiki.careerStints ?? 0} stints) `);
      } else {
        wikiFail += 1;
        process.stdout.write(`wiki·${wiki.reason ?? "noop"} `);
      }

      // Ensure Springbok link sticks for SA enrichment set (Kleyn may also show Ireland).
      const db = getDb();
      await db
        .update(players)
        .set({
          internationalTeamId: SA_ID,
          isPublic: true,
          publishStatus: "published",
        })
        .where(eq(players.id, player.id));
      await db
        .update(players)
        .set({ countryName: "South Africa" })
        .where(and(eq(players.id, player.id), or(isNull(players.countryName), eq(players.countryName, ""))));

      const sync = await syncTransfersFromClubCareerStints(player.id);
      transfersSynced += sync.created + sync.updated;
      process.stdout.write(`xfer+${sync.created}/~${sync.updated} `);

      if (!skipRugbyPass) {
        try {
          const rp = await enrichPlayerFromRugbyPass(player.id, undefined, { skipMatches: true });
          if (rp.enriched) {
            rpOk += 1;
            process.stdout.write("rp✓");
          } else {
            process.stdout.write(`rp·${rp.reason ?? "noop"}`);
          }
        } catch (error) {
          process.stdout.write(`rp✗${error instanceof Error ? error.message.slice(0, 40) : "err"}`);
        }
      }
      process.stdout.write("\n");
    } catch (error) {
      wikiFail += 1;
      console.log(`FAIL ${error instanceof Error ? error.message : error}`);
    }

    await sleep(delayMs);
  }

  const db = getDb();
  const [kleyn] = await db
    .select({
      name: players.name,
      birthDate: players.birthDate,
      heightCm: players.heightCm,
      weightKg: players.weightKg,
      school: players.school,
      university: players.university,
      wikipediaUrl: players.wikipediaUrl,
      clubName: players.clubName,
    })
    .from(players)
    .where(eq(players.id, "d1758b12-08cc-4e9c-a13a-66547425b777"))
    .limit(1);

  console.log("\nSummary:", { wikiOk, wikiFail, rpOk, transfersSynced, targets: targets.length });
  console.log("Jean Kleyn after enrich:", kleyn);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
