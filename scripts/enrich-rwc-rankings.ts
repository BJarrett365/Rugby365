/**
 * Enrich Rugby World Cup rankings: Wikipedia clubs/countries, merge unknown nations,
 * and pull missing club crests + player photos from Wikipedia page images.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/enrich-rwc-rankings.ts
 */
import { eq, sql } from "drizzle-orm";
import { competitions, coaches, players, referees, teams } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { mergePlayerRecords, mergeRefereeRecords, mergeTeamRecords } from "../apps/web/src/lib/entity-dedup-service";
import { isInternationalLeaderboardTeam } from "../apps/web/src/lib/competition-player-stat-display";
import {
  importRwcSquadClubsForYear,
  RWC_SQUAD_CLUB_YEARS,
} from "../apps/web/src/lib/rwc-squad-club-import-service";
import { pickRankingClubCrest, foldRankingClubKey, looksLikeCrestAssetUrl } from "../apps/web/src/lib/player-ranking-engine";
import {
  canonicalStandingsTeamName,
  isUnknownStandingsTeamName,
  pickCanonicalTeamIdByName,
  resolveTeamNamesFromFixtureSlug,
} from "../apps/web/src/lib/table-lab/standings-fixture-dedupe";
import {
  fetchWikipediaClubLogos,
  fetchWikipediaPlayerHeadshots,
  fetchWikipediaRefereeEnrichment,
  fetchWikipediaThumbnails,
  fetchLanguageWikipediaHeadshots,
  thumbnailForName,
  wikipediaTitleCandidates,
  fetchWikidataThumbnail,
  fetchWikidataLogo,
} from "../apps/web/src/lib/wikipedia-page-image";
import {
  foldRefereeIdentity,
  mergeRefereeClubs,
  refereeClubFallback,
  refereeNationalityFallback,
  sanitizeRefereeClubSet,
} from "../apps/web/src/lib/competition-ranking-math";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function repairUnknownNations() {
  const db = getDb();
  const rows = await db.execute<{
    id: string;
    slug: string;
    home_team_id: string | null;
    away_team_id: string | null;
    home_name: string | null;
    away_name: string | null;
  }>(sql`
    SELECT f.id, f.slug, f.home_team_id, f.away_team_id, ht.name AS home_name, at.name AS away_name
    FROM fixtures f
    JOIN competitions c ON c.id = f.competition_id
    LEFT JOIN teams ht ON ht.id = f.home_team_id
    LEFT JOIN teams at ON at.id = f.away_team_id
    WHERE c.slug = 'rugby-world-cup'
      AND (
        ht.name ILIKE 'unknown%'
        OR at.name ILIKE 'unknown%'
        OR ht.slug LIKE 'orphan-%'
        OR at.slug LIKE 'orphan-%'
      )
  `);
  const catalogRows = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug })
    .from(teams)
    .where(sql`${teams.slug} not like '%__legacy__%'`);
  const catalog = pickCanonicalTeamIdByName(catalogRows);
  const byCanonical = new Map<string, Set<string>>();
  for (const row of rows) {
    const resolved = resolveTeamNamesFromFixtureSlug(row.slug, row.home_name ?? "", row.away_name ?? "");
    const sides = [
      { id: row.home_team_id, name: row.home_name, resolved: resolved.homeName },
      { id: row.away_team_id, name: row.away_name, resolved: resolved.awayName },
    ];
    for (const side of sides) {
      if (!side.id || !isUnknownStandingsTeamName(side.name)) continue;
      const nation = canonicalStandingsTeamName(side.resolved);
      if (!isInternationalLeaderboardTeam(nation)) continue;
      const canonical = catalog.get(nation.toLowerCase());
      if (!canonical || canonical.id === side.id) continue;
      const set = byCanonical.get(canonical.id) ?? new Set();
      set.add(side.id);
      byCanonical.set(canonical.id, set);
    }
  }
  let merged = 0;
  for (const [canonicalId, orphanIds] of byCanonical) {
    const ids = [...orphanIds];
    await mergeTeamRecords(canonicalId, ids, {
      displayName: catalogRows.find((r) => r.id === canonicalId)?.name,
    });
    merged += ids.length;
  }
  console.log(`unknown nations merged=${merged} groups=${byCanonical.size}`);
}

async function enrichClubCrests() {
  const db = getDb();
  const [competition] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.slug, "rugby-world-cup"))
    .limit(1);
  if (!competition) return;
  const clubRows = await db.execute<{ club: string }>(sql`
    SELECT DISTINCT fp.club_name AS club
    FROM fixture_players fp
    JOIN fixtures f ON f.id = fp.fixture_id
    WHERE f.competition_id = ${competition.id}
      AND fp.club_name IS NOT NULL
      AND length(trim(fp.club_name)) > 1
  `);
  const catalog = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug, imageUrl: teams.imageUrl })
    .from(teams)
    .where(sql`${teams.slug} not like '%__legacy__%'`);
  const extraKnown = [
    "Kubota Spears",
    "Kubota Spears Funabashi Tokyo Bay",
    "Kubota Spears Funabashi Tokyo-Bay",
    "Tokyo Sungoliath",
    "Suntory Sungoliath",
    "Saitama Wild Knights",
    "Panasonic Wild Knights",
    "Yokohama Canon Eagles",
    "Canon Eagles",
    "Toyota Verblitz",
  ];
  const missing: string[] = [];
  for (const row of [...clubRows, ...extraKnown.map((club) => ({ club }))]) {
    const crest = pickRankingClubCrest(row.club, catalog);
    if (crest?.imageUrl) continue;
    missing.push(row.club);
  }
  const titles = missing.flatMap((name) => wikipediaTitleCandidates(name, "club"));
  const thumbs = await fetchWikipediaThumbnails(titles);
  const stillMissing = missing.filter((name) => {
    const url = thumbnailForName(thumbs, name, "club");
    return !url || !/logo|crest|badge|shield|emblem/i.test(url);
  });
  const logos = await fetchWikipediaClubLogos(
    stillMissing.flatMap((name) => wikipediaTitleCandidates(name, "club")),
  );
  for (const [title, url] of logos) thumbs.set(title, url);
  let updated = 0;
  let created = 0;
  for (const clubName of missing) {
    let url = thumbnailForName(thumbs, clubName, "club");
    if (!url) {
      for (const title of wikipediaTitleCandidates(clubName, "club")) {
        url = await fetchWikidataLogo(title);
        if (url) break;
      }
    }
    if (!url) continue;
    const existing = pickRankingClubCrest(clubName, catalog);
    if (existing) {
      const team = catalog.find((t) => t.slug === existing.slug);
      if (team && !team.imageUrl) {
        await db.update(teams).set({ imageUrl: url }).where(eq(teams.id, team.id));
        team.imageUrl = url;
        updated += 1;
      }
      continue;
    }
    let slug = slugify(clubName);
    const clash = catalog.some((t) => t.slug === slug);
    if (clash) slug = `${slug}-wiki`;
    await db.insert(teams).values({
      name: clubName,
      slug,
      imageUrl: url,
      sourceProvider: "wikipedia",
      teamType: "club",
      wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(clubName.replace(/ /g, "_"))}`,
    });
    catalog.push({ id: "new", name: clubName, slug, imageUrl: url });
    created += 1;
  }
  console.log(`club crests missing=${missing.length} updated=${updated} created=${created}`);
}

const REFEREE_CLUB_WIKI_TITLES: Record<string, string[]> = {
  rfu: ["Rugby Football Union"],
  irfu: ["Irish Rugby Football Union"],
  ffr: ["French Rugby Federation"],
  wru: ["Welsh Rugby Union"],
  sru: ["Scottish Rugby Union"],
  "sa rugby": ["South African Rugby Union"],
  "new zealand rugby": ["New Zealand Rugby"],
  "rugby australia": ["Rugby Australia"],
  "georgia rugby union": ["Georgia Rugby Union", "Georgian Rugby Union"],
  jrfu: ["Japan Rugby Football Union"],
  uar: ["Argentine Rugby Union"],
  "usa rugby": ["USA Rugby"],
  "fiji rugby": ["Fiji Rugby Union"],
  "samoa rugby": ["Samoa Rugby Union"],
  "rugby canada": ["Rugby Canada"],
  "korea rugby": ["Korea Rugby Union"],
  "sundays well": ["Sundays Well RFC"],
  "old patesians": ["Old Patesians RFC"],
  "london wasps": ["Wasps RFC", "London Wasps"],
  wasps: ["Wasps RFC"],
  "free state": ["Free State Cheetahs"],
  "free state cheetahs": ["Free State Cheetahs"],
  jiki: ["RC Jiki"],
  "rc jiki": ["RC Jiki"],
  "bay of plenty": ["Bay of Plenty Rugby Union"],
  "queensland reds": ["Queensland Reds"],
  reds: ["Queensland Reds"],
  harlequins: ["Harlequin F.C."],
  "bedford blues": ["Bedford Blues"],
  "racing metro": ["Racing 92"],
  "racing métro": ["Racing 92"],
  blackrock: ["Blackrock College RFC"],
  moseley: ["Moseley Rugby Football Club"],
  bruff: ["Bruff RFC"],
  "bruff r.f.c.": ["Bruff RFC"],
  shannon: ["Shannon RFC"],
  "saracens f.c.": ["Saracens F.C."],
  saracens: ["Saracens F.C."],
  "gloucestershire rfu": ["Gloucestershire Rugby Football Union"],
  "kwazulu-natal": ["Sharks (rugby union)", "Natal Sharks"],
  "kwa-zulu natal": ["Sharks (rugby union)"],
  "clanwilliam": ["Clanwilliam RFC"],
  highfield: ["Highfield R.F.C."],
  ballincollig: ["Ballincollig RFC"],
  wanderers: ["Wanderers F.C. (rugby union)", "Wanderers RFC"],
};

function wikiTitlesForRefereeClub(name: string): string[] {
  const key = foldRankingClubKey(name);
  const aliases = REFEREE_CLUB_WIKI_TITLES[key] ?? [];
  return [...new Set([...aliases, name, `${name} RFC`, ...wikipediaTitleCandidates(name, "club")])];
}

async function applyClubLogoToCatalog(
  db: ReturnType<typeof getDb>,
  catalog: Array<{ id: string; name: string; slug: string; imageUrl: string | null }>,
  clubName: string,
  url: string,
): Promise<"updated" | "created" | null> {
  const existing = pickRankingClubCrest(clubName, catalog);
  if (existing) {
    const team = catalog.find((t) => t.slug === existing.slug);
    if (team && !looksLikeCrestAssetUrl(team.imageUrl)) {
      await db.update(teams).set({ imageUrl: url }).where(eq(teams.id, team.id));
      team.imageUrl = url;
      return "updated";
    }
    return null;
  }
  let slug = slugify(clubName);
  if (catalog.some((t) => t.slug === slug)) slug = `${slug}-wiki`;
  const inserted = await db
    .insert(teams)
    .values({
      name: clubName,
      slug,
      imageUrl: url,
      sourceProvider: "wikipedia",
      teamType: "club",
      wikipediaUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(clubName.replace(/ /g, "_"))}`,
    })
    .returning({ id: teams.id });
  catalog.push({ id: inserted[0]?.id ?? "new", name: clubName, slug, imageUrl: url });
  return "created";
}

async function enrichRefereeClubCrests() {
  const db = getDb();
  const [competition] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.slug, "rugby-world-cup"))
    .limit(1);
  if (!competition) return;
  const rows = await db.execute<{ name: string; social_accounts: unknown }>(sql`
    SELECT DISTINCT r.name, r.social_accounts
    FROM referees r
    JOIN fixtures f ON f.referee_id = r.id
    WHERE f.competition_id = ${competition.id}
  `);
  const clubNames = new Set<string>();
  for (const row of rows) {
    const stored =
      row.social_accounts && typeof row.social_accounts === "object"
        ? (row.social_accounts as { rankingClubs?: { lastClub?: string; clubs?: string[] } }).rankingClubs
        : null;
    const merged = mergeRefereeClubs(
      refereeClubFallback(row.name),
      stored ? { lastClub: stored.lastClub ?? null, clubs: stored.clubs ?? [] } : null,
    );
    for (const club of merged.clubs) clubNames.add(club);
    if (merged.lastClub) clubNames.add(merged.lastClub);
  }
  for (const titles of Object.values(REFEREE_CLUB_WIKI_TITLES)) {
    for (const title of titles) clubNames.add(title);
  }

  const catalog = await db
    .select({ id: teams.id, name: teams.name, slug: teams.slug, imageUrl: teams.imageUrl })
    .from(teams)
    .where(sql`${teams.slug} not like '%__legacy__%'`);
  const missing = [...clubNames].filter(
    (name) => !looksLikeCrestAssetUrl(pickRankingClubCrest(name, catalog)?.imageUrl),
  );
  const titles = [...new Set(missing.flatMap((name) => wikiTitlesForRefereeClub(name)))];
  const logos = await fetchWikipediaClubLogos(titles);
  const thumbs = await fetchWikipediaThumbnails(titles);
  for (const [title, url] of logos) thumbs.set(title, url);

  let updated = 0;
  let created = 0;
  for (const clubName of missing) {
    const wikiTitles = wikiTitlesForRefereeClub(clubName);
    const candidates = wikiTitles
      .map((title) => thumbs.get(title) ?? thumbnailForName(thumbs, title, "club"))
      .filter((value): value is string => looksLikeCrestAssetUrl(value));
    let url = candidates[0] ?? null;
    if (!url) {
      for (const title of wikiTitles) {
        const logo = await fetchWikidataLogo(title);
        if (looksLikeCrestAssetUrl(logo)) {
          url = logo;
          break;
        }
      }
    }
    if (!url) continue;
    const canonicalName = REFEREE_CLUB_WIKI_TITLES[foldRankingClubKey(clubName)]?.[0] ?? clubName;
    const result = await applyClubLogoToCatalog(db, catalog, canonicalName, url);
    if (result === "updated") updated += 1;
    if (result === "created") created += 1;
  }
  console.log(`referee club crests missing=${missing.length} updated=${updated} created=${created}`);
}

async function copyExistingPlayerPhotos() {
  const db = getDb();
  await db.execute(sql`
    UPDATE players
    SET image_url = badge_image_url
    WHERE (image_url IS NULL OR length(trim(image_url)) = 0)
      AND badge_image_url IS NOT NULL
      AND length(trim(badge_image_url)) > 0
  `);
  await db.execute(sql`
    UPDATE players p
    SET image_url = g.image_url
    FROM (
      SELECT DISTINCT ON (player_id)
        player_id,
        image_url
      FROM player_images
      WHERE archived_at IS NULL
        AND image_url IS NOT NULL
        AND status IN ('approved', 'candidate')
      ORDER BY player_id,
        CASE role WHEN 'primary' THEN 0 WHEN 'legend' THEN 1 WHEN 'portrait' THEN 2 ELSE 3 END,
        confidence_score DESC NULLS LAST
    ) g
    WHERE p.id = g.player_id
      AND (p.image_url IS NULL OR length(trim(p.image_url)) = 0)
  `);
  await db.execute(sql`
    UPDATE players p
    SET image_url = src.image_url
    FROM (
      SELECT DISTINCT ON (lower(trim(name)))
        id,
        name,
        image_url
      FROM players
      WHERE image_url IS NOT NULL
        AND length(trim(image_url)) > 0
      ORDER BY lower(trim(name)), id
    ) src
    WHERE p.id <> src.id
      AND lower(trim(p.name)) = lower(trim(src.name))
      AND (p.image_url IS NULL OR length(trim(p.image_url)) = 0)
  `);
  await db.execute(sql`
    UPDATE players p
    SET image_url = src.image_url
    FROM (
      SELECT DISTINCT ON (lower(trim(pl.name)))
        pl.name,
        pi.image_url
      FROM player_images pi
      JOIN players pl ON pl.id = pi.player_id
      WHERE pi.archived_at IS NULL
        AND pi.image_url IS NOT NULL
        AND pi.status IN ('approved', 'candidate')
      ORDER BY lower(trim(pl.name)),
        CASE pi.role WHEN 'primary' THEN 0 WHEN 'legend' THEN 1 WHEN 'portrait' THEN 2 ELSE 3 END,
        pi.confidence_score DESC NULLS LAST
    ) src
    WHERE lower(trim(p.name)) = lower(trim(src.name))
      AND (p.image_url IS NULL OR length(trim(p.image_url)) = 0)
  `);
  console.log("copied existing player photos from gallery, badge, and duplicate rows");
}

async function enrichPlayerImages(year?: number) {
  const db = getDb();
  const [competition] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.slug, "rugby-world-cup"))
    .limit(1);
  if (!competition) return;
  const yearFilter = year
    ? sql`AND pmr.season_id IN (
        SELECT id FROM competition_seasons
        WHERE competition_id = ${competition.id} AND year = ${year}
      )`
    : sql``;
  const rows = await db.execute<{ id: string; name: string; birth_date: string | null }>(sql`
    SELECT DISTINCT p.id, p.name, p.birth_date
    FROM players p
    JOIN player_match_ratings pmr ON pmr.player_id = p.id
    WHERE pmr.competition_id = ${competition.id}
      AND (p.image_url IS NULL OR length(trim(p.image_url)) = 0)
      ${yearFilter}
  `);
  const headshots = await fetchWikipediaPlayerHeadshots(
    rows.map((row) => ({
      name: row.name,
      birthYear: row.birth_date ? Number.parseInt(String(row.birth_date).slice(0, 4), 10) : null,
    })),
  );
  const leftoverNames = rows.filter((row) => !headshots.get(row.name)).map((row) => row.name);
  const translated = leftoverNames.length ? await fetchLanguageWikipediaHeadshots(leftoverNames, ["fr"]) : new Map();
  let updated = 0;
  for (const row of rows) {
    const url = headshots.get(row.name) ?? translated.get(row.name) ?? null;
    if (!url) continue;
    await db.update(players).set({ imageUrl: url }).where(eq(players.id, row.id));
    updated += 1;
  }
  console.log(`player images missing=${rows.length} updated=${updated}`);
}

function isWeakRefereeNation(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  return /county |northern cape|kwa.?zulu|ulster|leinster|munster|connacht|antrim/i.test(value);
}

async function mergeSuffixedRwcReferees() {
  const db = getDb();
  const rows = await db.execute<{ id: string; name: string }>(sql`
    SELECT DISTINCT r.id, r.name
    FROM referees r
    JOIN fixtures f ON f.referee_id = r.id
    JOIN competitions c ON c.id = f.competition_id
    WHERE c.slug = 'rugby-world-cup'
  `);
  const byCanonical = new Map<string, { id: string; name: string }[]>();
  for (const row of rows) {
    const key = foldRefereeIdentity(row.name);
    if (!key) continue;
    const list = byCanonical.get(key) ?? [];
    list.push(row);
    byCanonical.set(key, list);
  }
  let merged = 0;
  for (const [, group] of byCanonical) {
    if (group.length < 2) continue;
    const canonical =
      group.find((row) => foldRefereeIdentity(row.name) === row.name.toLowerCase()) ??
      group.find((row) => !/\([^)]+\)$/.test(row.name)) ??
      group[0]!;
    const dups = group.filter((row) => row.id !== canonical.id).map((row) => row.id);
    if (!dups.length) continue;
    await mergeRefereeRecords(canonical.id, dups);
    merged += dups.length;
    console.log(`merged ${dups.length} → ${canonical.name}`);
  }
  console.log(`rwc referee identity merges=${merged}`);
}

async function enrichRefereeProfiles() {
  const db = getDb();
  const [competition] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.slug, "rugby-world-cup"))
    .limit(1);
  if (!competition) return;
  await mergeSuffixedRwcReferees();
  const rows = await db.execute<{
    id: string;
    name: string;
    image_url: string | null;
    country_name: string | null;
    nationality: string | null;
    social_accounts: unknown;
  }>(sql`
    SELECT DISTINCT r.id, r.name, r.image_url, r.country_name, r.nationality, r.social_accounts
    FROM referees r
    JOIN fixtures f ON f.referee_id = r.id
    WHERE f.competition_id = ${competition.id}
  `);
  const wiki = await fetchWikipediaRefereeEnrichment(rows.map((row) => row.name));
  const missingImageNames = rows.filter((row) => !row.image_url).map((row) => row.name);
  const translated = missingImageNames.length
    ? await fetchLanguageWikipediaHeadshots(missingImageNames, ["fr"])
    : new Map<string, string>();
  let images = 0;
  let countriesUpdated = 0;
  let clubsUpdated = 0;
  for (const row of rows) {
    const page = wiki.get(row.name);
    const fallbackNation = refereeNationalityFallback(row.name);
    const wikiNation = page?.country ?? null;
    const currentNation = row.country_name || row.nationality;
    const nation =
      fallbackNation ??
      wikiNation ??
      (isWeakRefereeNation(currentNation) ? null : currentNation);
    const clubs = sanitizeRefereeClubSet(
      mergeRefereeClubs(refereeClubFallback(row.name), page?.clubs ?? null),
    );
    const existing =
      row.social_accounts && typeof row.social_accounts === "object"
        ? (row.social_accounts as Record<string, unknown>)
        : {};
    const patch: {
      imageUrl?: string;
      countryName?: string;
      nationality?: string;
      socialAccounts?: Record<string, unknown>;
    } = {};
    if (!row.image_url && page?.imageUrl) patch.imageUrl = page.imageUrl;
    if (
      row.image_url &&
      /andy_cole|eoin_doyle|footballer|soccer/i.test(row.image_url)
    ) {
      patch.imageUrl = null;
    }
    if (!row.image_url && !patch.imageUrl && page?.wikipediaTitle) {
      const wikidata = await fetchWikidataThumbnail(page.wikipediaTitle);
      if (wikidata) patch.imageUrl = wikidata;
    }
    if (!row.image_url && !patch.imageUrl) {
      patch.imageUrl = translated.get(row.name) || undefined;
    }
    if (nation && nation !== currentNation) {
      patch.countryName = nation;
      patch.nationality = nation;
    }
    const nextAccounts = { ...existing };
    if (clubs?.clubs.length) {
      nextAccounts.rankingClubs = { lastClub: clubs.lastClub, clubs: clubs.clubs };
    } else {
      delete nextAccounts.rankingClubs;
    }
    if (JSON.stringify(nextAccounts) !== JSON.stringify(existing)) {
      patch.socialAccounts = nextAccounts;
    }
    if (!Object.keys(patch).length) continue;
    await db.update(referees).set(patch).where(eq(referees.id, row.id));
    if (patch.imageUrl) images += 1;
    if (patch.countryName) countriesUpdated += 1;
    if (patch.socialAccounts) clubsUpdated += 1;
  }
  console.log(
    `referees scanned=${rows.length} images=${images} countries=${countriesUpdated} clubs=${clubsUpdated}`,
  );
}

async function enrichCoachImages() {
  const db = getDb();
  const [competition] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.slug, "rugby-world-cup"))
    .limit(1);
  if (!competition) return;
  const rows = await db.execute<{ id: string; name: string }>(sql`
    SELECT DISTINCT c.id, c.name
    FROM coaches c
    JOIN coach_match_ratings cmr ON cmr.coach_id = c.id
    WHERE cmr.competition_id = ${competition.id}
      AND (c.image_url IS NULL OR length(trim(c.image_url)) = 0)
  `);
  const titles = rows.flatMap((row) => wikipediaTitleCandidates(row.name, "coach"));
  const thumbs = await fetchWikipediaThumbnails(titles);
  const translated = await fetchLanguageWikipediaHeadshots(rows.map((row) => row.name), ["fr"]);
  let updated = 0;
  for (const row of rows) {
    const url = thumbnailForName(thumbs, row.name, "coach") ?? translated.get(row.name) ?? null;
    if (!url) continue;
    await db.update(coaches).set({ imageUrl: url }).where(eq(coaches.id, row.id));
    updated += 1;
  }
  console.log(`coach images missing=${rows.length} updated=${updated}`);
}

async function mergeDuplicateMostert() {
  const db = getDb();
  const rows = await db.execute<{ id: string; name: string }>(sql`
    SELECT id, name FROM players
    WHERE name IN ('Franco Mostert', 'Francois Mostert')
    ORDER BY name
  `);
  const franco = rows.find((r) => r.name === "Franco Mostert");
  const francois = rows.find((r) => r.name === "Francois Mostert");
  if (!franco || !francois) return;
  await mergePlayerRecords(franco.id, [francois.id], { displayName: "Franco Mostert" });
  console.log("merged Francois Mostert → Franco Mostert");
}

async function main() {
  const imagesOnly = process.argv.includes("--images-only");
  const crestsOnly = process.argv.includes("--crests-only");
  const staffOnly = process.argv.includes("--staff-only");
  const gapsOnly = process.argv.includes("--gaps-only");
  const playersOnly = process.argv.includes("--players-only");
  const yearArg = process.argv.find((arg) => arg.startsWith("--year="));
  const year = yearArg ? Number(yearArg.split("=")[1]) : undefined;
  if (process.argv.includes("--coaches-only")) {
    await enrichCoachImages();
    return;
  }
  if (staffOnly || gapsOnly || playersOnly) {
    if (gapsOnly || playersOnly) {
      await copyExistingPlayerPhotos();
      await enrichPlayerImages(year);
      if (playersOnly) await enrichClubCrests();
    }
    if (!playersOnly) {
      await enrichRefereeProfiles();
      await enrichRefereeClubCrests();
      await enrichCoachImages();
    }
    return;
  }
  if (process.argv.includes("--referee-crests-only")) {
    await enrichRefereeClubCrests();
    return;
  }
  if (!imagesOnly && !crestsOnly) {
    const years = year ? ([year] as number[]) : [...RWC_SQUAD_CLUB_YEARS];
    for (const next of years) {
      const result = await importRwcSquadClubsForYear(next);
      console.log(
        `${next}: parsed=${result.parsed} matched=${result.matched} updated=${result.updated} unmatched=${result.unmatched}`,
      );
    }
    await repairUnknownNations();
  }
  if (!crestsOnly) await mergeDuplicateMostert();
  await enrichClubCrests();
  await enrichRefereeClubCrests();
  if (!crestsOnly) {
    await copyExistingPlayerPhotos();
    await enrichPlayerImages(year);
    await enrichRefereeProfiles();
    await enrichCoachImages();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
