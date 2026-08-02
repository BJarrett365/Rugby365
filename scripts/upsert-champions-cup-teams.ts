/**
 * Upsert Champions Cup club Wikipedia URLs (and create missing teams).
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/upsert-champions-cup-teams.ts
 */
import { eq } from "drizzle-orm";
import { teams } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { normalizeSlug } from "../apps/web/src/lib/fixture-admin-service";
import { normalizeTeamName, normalizedEntityKey } from "../apps/web/src/lib/entity-normalize";

const CHAMPIONS_CUP_TEAMS: Array<{ name: string; wikipediaUrl: string; shortName?: string }> = [
  { name: "Bath Rugby", wikipediaUrl: "https://en.wikipedia.org/wiki/Bath_Rugby", shortName: "BAT" },
  { name: "Bristol Bears", wikipediaUrl: "https://en.wikipedia.org/wiki/Bristol_Bears", shortName: "BRI" },
  { name: "Exeter Chiefs", wikipediaUrl: "https://en.wikipedia.org/wiki/Exeter_Chiefs", shortName: "EXE" },
  { name: "Gloucester Rugby", wikipediaUrl: "https://en.wikipedia.org/wiki/Gloucester_Rugby", shortName: "GLO" },
  { name: "Harlequins", wikipediaUrl: "https://en.wikipedia.org/wiki/Harlequin_F.C.", shortName: "HAR" },
  { name: "Leicester Tigers", wikipediaUrl: "https://en.wikipedia.org/wiki/Leicester_Tigers", shortName: "LEI" },
  { name: "London Irish", wikipediaUrl: "https://en.wikipedia.org/wiki/London_Irish", shortName: "IRI" },
  { name: "London Wasps", wikipediaUrl: "https://en.wikipedia.org/wiki/Wasps_RFC", shortName: "WAS" },
  { name: "Newcastle Falcons", wikipediaUrl: "https://en.wikipedia.org/wiki/Newcastle_Falcons", shortName: "NEW" },
  { name: "Northampton Saints", wikipediaUrl: "https://en.wikipedia.org/wiki/Northampton_Saints", shortName: "NOR" },
  { name: "Sale Sharks", wikipediaUrl: "https://en.wikipedia.org/wiki/Sale_Sharks", shortName: "SAL" },
  { name: "Saracens", wikipediaUrl: "https://en.wikipedia.org/wiki/Saracens_F.C.", shortName: "SAR" },
  { name: "Aviron Bayonnais", wikipediaUrl: "https://en.wikipedia.org/wiki/Aviron_Bayonnais", shortName: "BAY" },
  { name: "ASM Clermont Auvergne", wikipediaUrl: "https://en.wikipedia.org/wiki/ASM_Clermont_Auvergne", shortName: "CLE" },
  { name: "Biarritz Olympique", wikipediaUrl: "https://en.wikipedia.org/wiki/Biarritz_Olympique", shortName: "BIA" },
  { name: "Bordeaux Bègles", wikipediaUrl: "https://en.wikipedia.org/wiki/Union_Bordeaux_B%C3%A8gles", shortName: "BOR" },
  { name: "Brive", wikipediaUrl: "https://en.wikipedia.org/wiki/CA_Brive", shortName: "BRI" },
  { name: "Castres Olympique", wikipediaUrl: "https://en.wikipedia.org/wiki/Castres_Olympique", shortName: "CAS" },
  { name: "La Rochelle", wikipediaUrl: "https://en.wikipedia.org/wiki/Stade_Rochelais", shortName: "LAR" },
  { name: "Lyon OU", wikipediaUrl: "https://en.wikipedia.org/wiki/Lyon_OU", shortName: "LYO" },
  { name: "Montpellier", wikipediaUrl: "https://en.wikipedia.org/wiki/Montpellier_H%C3%A9rault_Rugby", shortName: "MON" },
  { name: "Pau", wikipediaUrl: "https://en.wikipedia.org/wiki/Section_Paloise", shortName: "PAU" },
  { name: "Perpignan", wikipediaUrl: "https://en.wikipedia.org/wiki/USA_Perpignan", shortName: "PER" },
  { name: "Racing 92", wikipediaUrl: "https://en.wikipedia.org/wiki/Racing_92", shortName: "RAC" },
  { name: "Stade Français", wikipediaUrl: "https://en.wikipedia.org/wiki/Stade_Fran%C3%A7ais", shortName: "SFR" },
  { name: "Toulon", wikipediaUrl: "https://en.wikipedia.org/wiki/RC_Toulonnais", shortName: "TOU" },
  { name: "Toulouse", wikipediaUrl: "https://en.wikipedia.org/wiki/Stade_Toulousain", shortName: "TLS" },
  { name: "Connacht", wikipediaUrl: "https://en.wikipedia.org/wiki/Connacht_Rugby", shortName: "CON" },
  { name: "Leinster", wikipediaUrl: "https://en.wikipedia.org/wiki/Leinster_Rugby", shortName: "LEI" },
  { name: "Munster", wikipediaUrl: "https://en.wikipedia.org/wiki/Munster_Rugby", shortName: "MUN" },
  { name: "Ulster", wikipediaUrl: "https://en.wikipedia.org/wiki/Ulster_Rugby", shortName: "ULS" },
  { name: "Cardiff Rugby", wikipediaUrl: "https://en.wikipedia.org/wiki/Cardiff_Rugby", shortName: "CAR" },
  { name: "Dragons RFC", wikipediaUrl: "https://en.wikipedia.org/wiki/Dragons_RFC", shortName: "DRA" },
  { name: "Ospreys", wikipediaUrl: "https://en.wikipedia.org/wiki/Ospreys_(rugby_union)", shortName: "OSP" },
  { name: "Scarlets", wikipediaUrl: "https://en.wikipedia.org/wiki/Scarlets", shortName: "SCA" },
  { name: "Celtic Warriors", wikipediaUrl: "https://en.wikipedia.org/wiki/Celtic_Warriors", shortName: "CEL" },
  { name: "Neath RFC", wikipediaUrl: "https://en.wikipedia.org/wiki/Neath_RFC", shortName: "NEA" },
  { name: "Pontypridd RFC", wikipediaUrl: "https://en.wikipedia.org/wiki/Pontypridd_RFC", shortName: "PON" },
  { name: "Swansea RFC", wikipediaUrl: "https://en.wikipedia.org/wiki/Swansea_RFC", shortName: "SWA" },
  { name: "Llanelli RFC", wikipediaUrl: "https://en.wikipedia.org/wiki/Llanelli_RFC", shortName: "LLA" },
  { name: "Edinburgh Rugby", wikipediaUrl: "https://en.wikipedia.org/wiki/Edinburgh_Rugby", shortName: "EDI" },
  { name: "Glasgow Warriors", wikipediaUrl: "https://en.wikipedia.org/wiki/Glasgow_Warriors", shortName: "GLA" },
  { name: "Border Reivers", wikipediaUrl: "https://en.wikipedia.org/wiki/Border_Reivers", shortName: "BOR" },
  { name: "Benetton Rugby", wikipediaUrl: "https://en.wikipedia.org/wiki/Benetton_Rugby", shortName: "BEN" },
  { name: "Zebre Parma", wikipediaUrl: "https://en.wikipedia.org/wiki/Zebre_Parma", shortName: "ZEB" },
  { name: "Aironi", wikipediaUrl: "https://en.wikipedia.org/wiki/Aironi", shortName: "AIR" },
  { name: "Viadana", wikipediaUrl: "https://en.wikipedia.org/wiki/Rugby_Viadana", shortName: "VIA" },
  { name: "Bulls", wikipediaUrl: "https://en.wikipedia.org/wiki/Blue_Bulls", shortName: "BUL" },
  { name: "Sharks", wikipediaUrl: "https://en.wikipedia.org/wiki/Sharks_(rugby_union)", shortName: "SHA" },
  { name: "Stormers", wikipediaUrl: "https://en.wikipedia.org/wiki/Stormers", shortName: "STO" },
];

/** Prefer matching known aliases so we attach URLs to existing CMS rows. */
const ALIAS_KEYS: Record<string, string[]> = {
  bath: ["bath rugby", "bath"],
  "bristol bears": ["bristol bears", "bristol rugby", "bristol"],
  harlequins: ["harlequins", "harlequin f.c.", "harlequin fc"],
  "london wasps": ["london wasps", "wasps", "wasps rfc"],
  "newcastle falcons": ["newcastle falcons", "newcastle red bulls"],
  "aviron bayonnais": ["aviron bayonnais", "bayonne", "bayonnais"],
  "asm clermont auvergne": ["asm clermont auvergne", "clermont", "clermont auvergne"],
  "bordeaux bègles": ["bordeaux bègles", "bordeaux begles", "union bordeaux bègles", "bordeaux"],
  brive: ["brive", "ca brive"],
  "la rochelle": ["la rochelle", "stade rochelais"],
  "lyon ou": ["lyon ou", "lyon"],
  montpellier: ["montpellier", "montpellier hérault rugby", "montpellier herault rugby"],
  pau: ["pau", "section paloise"],
  perpignan: ["perpignan", "usa perpignan"],
  "stade français": ["stade français", "stade francais"],
  toulon: ["toulon", "rc toulonnais"],
  toulouse: ["toulouse", "stade toulousain"],
  connacht: ["connacht", "connacht rugby"],
  leinster: ["leinster", "leinster rugby"],
  munster: ["munster", "munster rugby"],
  ulster: ["ulster", "ulster rugby"],
  "cardiff rugby": ["cardiff rugby", "cardiff blues", "cardiff"],
  "dragons rfc": ["dragons rfc", "dragons", "newport gwent dragons"],
  ospreys: ["ospreys"],
  scarlets: ["scarlets", "llanelli scarlets"],
  "edinburgh rugby": ["edinburgh rugby", "edinburgh"],
  "glasgow warriors": ["glasgow warriors", "glasgow"],
  "benetton rugby": ["benetton rugby", "benetton", "benetton treviso"],
  "zebre parma": ["zebre parma", "zebre"],
  bulls: ["bulls", "blue bulls", "vodacom bulls"],
  sharks: ["sharks", "cell c sharks", "natal sharks"],
  stormers: ["stormers", "dhl stormers"],
};

function matchKeysFor(name: string): string[] {
  const key = normalizedEntityKey(name, "team").replace(/\|senior$/, "");
  for (const [canonical, aliases] of Object.entries(ALIAS_KEYS)) {
    if (aliases.includes(key) || canonical === key) return aliases;
  }
  return [key];
}

async function main() {
  const db = getDb();
  const all = await db.select().from(teams);
  let created = 0;
  let updated = 0;
  let linked = 0;

  for (const entry of CHAMPIONS_CUP_TEAMS) {
    const name = normalizeTeamName(entry.name);
    const keys = new Set(matchKeysFor(name));
    const existing =
      all.find((row) => keys.has(normalizedEntityKey(row.name, "team").replace(/\|senior$/, ""))) ??
      all.find((row) => row.wikipediaUrl === entry.wikipediaUrl);

    if (existing) {
      const patch: Partial<typeof teams.$inferInsert> = {};
      if (!existing.wikipediaUrl) patch.wikipediaUrl = entry.wikipediaUrl;
      if (!existing.shortName && entry.shortName) patch.shortName = entry.shortName;
      if (Object.keys(patch).length) {
        await db.update(teams).set(patch).where(eq(teams.id, existing.id));
        updated += 1;
        console.log(`update ${existing.name} ← ${entry.wikipediaUrl}`);
      } else {
        linked += 1;
        console.log(`ok     ${existing.name}`);
      }
      continue;
    }

    const slugBase = normalizeSlug(name);
    let slug = slugBase;
    let n = 0;
    while (all.some((row) => row.slug === slug)) {
      n += 1;
      slug = `${slugBase}-cc${n}`;
    }

    const [row] = await db
      .insert(teams)
      .values({
        name,
        slug,
        shortName: entry.shortName ?? null,
        wikipediaUrl: entry.wikipediaUrl,
        sourceProvider: "wikipedia",
      })
      .returning();
    all.push(row!);
    created += 1;
    console.log(`create ${name} (${slug})`);
  }

  console.log(`\nDone. created=${created} updated=${updated} already-ok=${linked}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
