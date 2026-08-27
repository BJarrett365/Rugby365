/**
 * Fill remaining bio + rating gaps for the current Springboks squad only.
 *
 * - Preferred foot (kicking foot) from position default when missing
 * - Shirt/squad number from most-common jersey_number
 * - Contract source = unknown when no dates (UI shows "Unknown")
 * - Recalculate intelligence dims (kicking/playmaking/GM/…) + rating history
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs \
 *     scripts/fill-current-springboks-profile-gaps.ts --write
 */
import { eq, sql } from "drizzle-orm";
import { players } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { recalculatePlayerIntelligenceProfile } from "../apps/web/src/lib/player-intelligence-recalc-service";

const SA = "b0000000-0000-4000-8000-000000000001";

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

function defaultPreferredFoot(_position: string | null): string {
  return "Right";
}

async function backfillSquadNumber(playerId: string): Promise<number | null> {
  const db = getDb();
  const rows = await db.execute(sql`
    select jersey_number::int as n, count(*)::int as c
    from fixture_players
    where player_id = ${playerId}::uuid
      and jersey_number is not null
      and jersey_number between 1 and 23
    group by jersey_number
    order by c desc, jersey_number asc
    limit 1
  `);
  const list = Array.isArray(rows) ? rows : (rows as { rows?: Array<{ n: number }> }).rows ?? [];
  const n = list[0]?.n;
  return n != null && Number.isFinite(Number(n)) ? Number(n) : null;
}

function normalizeName(n: string): string {
  return n
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const NAME_ALIASES: Record<string, string[]> = {
  "sacha feinberg mngomezulu": ["sacha mngomezulu", "sacha feinberg-mngomezulu"],
  "ox nche": ["ox nché", "retshegofaditswe nche"],
  "andre esterhuizen": ["andré esterhuizen"],
  "andre hugo venter": ["andre-hugo venter"],
  "pieter steph du toit": ["pieter-steph du toit"],
};

async function findPlayer(name: string) {
  const db = getDb();
  const norm = normalizeName(name);
  const aliases = new Set([norm, ...(NAME_ALIASES[norm] ?? []).map(normalizeName)]);
  const cols = {
    id: players.id,
    name: players.name,
    slug: players.slug,
    preferredFoot: players.preferredFoot,
    squadNumber: players.squadNumber,
    positionName: players.positionName,
    contractSource: players.contractSource,
    contractExpiresOn: players.contractExpiresOn,
    contractStartOn: players.contractStartOn,
  };
  const sa = await db.select(cols).from(players).where(eq(players.internationalTeamId, SA));
  const candidates = sa.filter((p) => {
    const pn = normalizeName(p.name);
    return (
      aliases.has(pn) ||
      [...aliases].some((a) => pn.includes(a) || a.includes(pn) || pn.endsWith(a.split(" ").slice(-1)[0]!))
    );
  });
  if (candidates.length) {
    // Prefer the row with the most fixture appearances when duplicates exist.
    const ranked = await Promise.all(
      candidates.map(async (p) => {
        const c = await db.execute(sql`select count(*)::int as n from fixture_players where player_id = ${p.id}::uuid`);
        const n = (Array.isArray(c) ? c : (c as { rows?: Array<{ n: number }> }).rows ?? [])[0]?.n ?? 0;
        return { p, n: Number(n) };
      }),
    );
    ranked.sort((a, b) => b.n - a.n);
    return ranked[0]!.p;
  }

  // Fallback: name / slug search without SA filter.
  for (const a of aliases) {
    const slugHint = a.replace(/\s+/g, "-");
    const loose = await db.execute(sql`
      select id, name, slug, preferred_foot as "preferredFoot", squad_number as "squadNumber",
             position_name as "positionName", contract_source as "contractSource",
             contract_expires_on as "contractExpiresOn", contract_start_on as "contractStartOn"
      from players
      where lower(regexp_replace(name, '[^a-zA-Z0-9]+', ' ', 'g')) = ${a}
         or slug ilike ${`%${slugHint}%`}
      order by case when international_team_id = ${SA}::uuid then 0 else 1 end
      limit 3
    `);
    const rows = (Array.isArray(loose) ? loose : (loose as { rows?: typeof sa }).rows ?? []) as typeof sa;
    if (rows[0]) return rows[0];
  }
  return null;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

async function main() {
  const write = process.argv.includes("--write");
  const skipIntel = process.argv.includes("--skip-intel");
  const fromArg = process.argv.find((a) => a.startsWith("--from="))?.slice("--from=".length);
  const fromIdx = fromArg ? Math.max(0, Number(fromArg) - 1) : 0;

  const seen = new Set<string>();
  const uniqueNames: string[] = [];
  for (const n of SQUAD_NAMES) {
    const key = normalizeName(n);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueNames.push(n);
  }
  const names = uniqueNames.slice(fromIdx);

  console.log(
    `${write ? "" : "[DRY RUN] "}Fill current Springboks profile gaps (${names.length} players, from #${fromIdx + 1})${skipIntel ? " [skip-intel]" : ""}`,
  );

  const db = getDb();
  let ok = 0;
  let intelOk = 0;
  const missing: string[] = [];

  for (const [i, name] of names.entries()) {
    const idx = fromIdx + i + 1;
    console.log(`[${idx}/${uniqueNames.length}] ${name}`);
    try {
      const row = await findPlayer(name);
      if (!row) {
        console.log("  MISSING");
        missing.push(name);
        continue;
      }

      const foot = row.preferredFoot ?? defaultPreferredFoot(row.positionName);
      let squadNumber = row.squadNumber;
      if (squadNumber == null) squadNumber = await backfillSquadNumber(row.id);

      const needsContractUnknown =
        !row.contractExpiresOn && !row.contractStartOn && !(row.contractSource ?? "").trim();

      if (write) {
        await db
          .update(players)
          .set({
            internationalTeamId: SA,
            countryName: "South Africa",
            preferredFoot: foot ?? undefined,
            squadNumber: squadNumber ?? undefined,
            contractSource: needsContractUnknown ? "unknown" : row.contractSource ?? undefined,
            isPublic: true,
            publishStatus: "published",
            updatedAt: new Date(),
          })
          .where(eq(players.id, row.id));
      }
      console.log(
        `  foot=${foot ?? "—"} shirt=${squadNumber ?? "—"} contract=${needsContractUnknown ? "unknown" : row.contractSource ?? "dated"}`,
      );

      if (!skipIntel && write) {
        try {
          console.log("  → intelligence…");
          const r = await withTimeout(
            recalculatePlayerIntelligenceProfile(row.id),
            90_000,
            "intel",
          );
          console.log(
            `  ← ovr=${r.overall ?? "null"} hist=${r.historyPoints}/${r.samples} conf=${r.confidence}`,
          );
          intelOk += 1;
        } catch (e) {
          console.log(`  ← intel ${e instanceof Error ? e.message : e}`);
        }
      }

      ok += 1;
    } catch (e) {
      console.log(`  FATAL ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log("Done", { ok, intelOk, missing, write });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
