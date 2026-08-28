/**
 * Enrich Rugby World Cup rankings: Wikipedia clubs/countries, merge unknown nations,
 * and pull missing club crests + player photos from Wikipedia page images.
 *
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/enrich-rwc-rankings.ts
 */
import { eq, sql } from "drizzle-orm";
import { competitions, coaches, players, referees, teams } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { mergePlayerRecords, mergeTeamRecords } from "../apps/web/src/lib/entity-dedup-service";
import { isInternationalLeaderboardTeam } from "../apps/web/src/lib/competition-player-stat-display";
import {
  importRwcSquadClubsForYear,
  RWC_SQUAD_CLUB_YEARS,
} from "../apps/web/src/lib/rwc-squad-club-import-service";
import { pickRankingClubCrest } from "../apps/web/src/lib/player-ranking-engine";
import {
  canonicalStandingsTeamName,
  isUnknownStandingsTeamName,
  pickCanonicalTeamIdByName,
  resolveTeamNamesFromFixtureSlug,
} from "../apps/web/src/lib/table-lab/standings-fixture-dedupe";
import {
  fetchWikipediaClubLogos,
  fetchWikipediaPersonCountries,
  fetchWikipediaRefereeClubs,
  fetchWikipediaThumbnails,
  thumbnailForName,
  wikipediaTitleCandidates,
  fetchWikidataThumbnail,
} from "../apps/web/src/lib/wikipedia-page-image";

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
    const url = thumbnailForName(thumbs, clubName, "club");
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
  const titles = rows.flatMap((row) =>
    wikipediaTitleCandidates(
      row.name,
      "player",
      row.birth_date ? Number.parseInt(String(row.birth_date).slice(0, 4), 10) : null,
    ),
  );
  const thumbs = await fetchWikipediaThumbnails(titles);
  let updated = 0;
  for (const row of rows) {
    let url = thumbnailForName(thumbs, row.name, "player");
    if (!url) {
      const year = row.birth_date ? Number.parseInt(String(row.birth_date).slice(0, 4), 10) : null;
      for (const title of wikipediaTitleCandidates(row.name, "player", year)) {
        url = await fetchWikidataThumbnail(title);
        if (url) break;
      }
    }
    if (!url) continue;
    await db.update(players).set({ imageUrl: url }).where(eq(players.id, row.id));
    updated += 1;
  }
  console.log(`player images missing=${rows.length} updated=${updated}`);
}

async function enrichRefereeProfiles() {
  const db = getDb();
  const [competition] = await db
    .select({ id: competitions.id })
    .from(competitions)
    .where(eq(competitions.slug, "rugby-world-cup"))
    .limit(1);
  if (!competition) return;
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
    JOIN referee_match_ratings rmr ON rmr.referee_id = r.id
    WHERE rmr.competition_id = ${competition.id}
  `);
  const needImage = rows.filter((row) => !row.image_url);
  const needCountry = rows.filter((row) => !row.country_name && !row.nationality);
  const titles = rows.flatMap((row) => wikipediaTitleCandidates(row.name, "referee"));
  const thumbs = needImage.length ? await fetchWikipediaThumbnails(titles) : new Map<string, string>();
  const countries = needCountry.length
    ? await fetchWikipediaPersonCountries(titles)
    : new Map<string, string>();
  const wikiClubs = await fetchWikipediaRefereeClubs(rows.map((row) => row.name));
  let images = 0;
  let countriesUpdated = 0;
  let clubsUpdated = 0;
  for (const row of rows) {
    const patch: {
      imageUrl?: string;
      countryName?: string;
      nationality?: string;
      socialAccounts?: Record<string, unknown>;
    } = {};
    if (!row.image_url) {
      const url = thumbnailForName(thumbs, row.name, "referee");
      if (url) patch.imageUrl = url;
    }
    if (!row.country_name && !row.nationality) {
      const country = thumbnailForName(countries, row.name, "referee");
      if (country) {
        patch.countryName = country;
        patch.nationality = country;
      }
    }
    const clubs = wikiClubs.get(row.name);
    if (clubs?.clubs.length) {
      const existing =
        row.social_accounts && typeof row.social_accounts === "object"
          ? (row.social_accounts as Record<string, unknown>)
          : {};
      patch.socialAccounts = {
        ...existing,
        rankingClubs: { lastClub: clubs.lastClub, clubs: clubs.clubs },
      };
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
  let updated = 0;
  for (const row of rows) {
    const url = thumbnailForName(thumbs, row.name, "coach");
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
  if (staffOnly || gapsOnly || playersOnly) {
    if (gapsOnly || playersOnly) await enrichPlayerImages(year);
    if (!playersOnly) {
      await enrichRefereeProfiles();
      await enrichCoachImages();
    }
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
  if (!crestsOnly) {
    await enrichPlayerImages(year);
    await enrichRefereeProfiles();
    await enrichCoachImages();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
