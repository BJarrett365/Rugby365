/**
 * Bring every public coach onto the Rassie Erasmus profile template:
 * same pages/components, coach-specific data, no invented stats.
 *
 * Does not re-enrich Rassie (his career table is a dedicated seed).
 *
 * Usage:
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/hydrate-coach-public-profiles.ts
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/hydrate-coach-public-profiles.ts --skip-enrich
 *   npx tsx --require ./scripts/stub-server-only.cjs scripts/hydrate-coach-public-profiles.ts --limit=10
 */
import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { coachHonours, coaches, teamCoachingStaff, teams } from "@rugby365/db";
import { assignCurrentCoaches } from "../apps/web/src/lib/assign-current-coaches-service";
import { resolveCoach, updateCoach } from "../apps/web/src/lib/coach-admin-service";
import { teamNameFromAssignmentBio } from "../apps/web/src/lib/coach-career-visibility";
import { setCoachPrimaryImage } from "../apps/web/src/lib/coach-image-service";
import { persistLiteCoachRatingSnapshot } from "../apps/web/src/lib/coach-rating-service";
import {
  buildCoachTeamResolver,
  loadCmsTeamsForCoachAssignment,
} from "../apps/web/src/lib/coach-team-resolve-service";
import { enrichCoachFromWikipedia } from "../apps/web/src/lib/coach-wikipedia-import-service";
import { getDb } from "../apps/web/src/lib/db";
import { fetchWikipediaThumbnails } from "../apps/web/src/lib/wikipedia-page-image";

const RASSIE_ID = "dbe4562a-7255-42c4-bb70-653153c4da3c";

/** Official Wikipedia articles for current/high-profile coaches missing a stored URL. */
const KNOWN_WIKIPEDIA_URLS: Record<string, string> = {
  "Fabien Galthié": "https://en.wikipedia.org/wiki/Fabien_Galthi%C3%A9",
  "Steve Tandy": "https://en.wikipedia.org/wiki/Steve_Tandy",
  "Scott Robertson": "https://en.wikipedia.org/wiki/Scott_Robertson_(rugby_union)",
  "Joe Schmidt": "https://en.wikipedia.org/wiki/Joe_Schmidt_(rugby_union)",
  "Steve Borthwick": "https://en.wikipedia.org/wiki/Steve_Borthwick",
  "Gregor Townsend": "https://en.wikipedia.org/wiki/Gregor_Townsend",
  "Eddie Jones": "https://en.wikipedia.org/wiki/Eddie_Jones_(rugby_union)",
  "Gonzalo Quesada": "https://en.wikipedia.org/wiki/Gonzalo_Quesada",
  "Felipe Contepomi": "https://en.wikipedia.org/wiki/Felipe_Contepomi",
  "Andy Farrell": "https://en.wikipedia.org/wiki/Andy_Farrell",
  "John Mitchell": "https://en.wikipedia.org/wiki/John_Mitchell_(rugby_union)",
  "Simon Mannix": "https://en.wikipedia.org/wiki/Simon_Mannix",
  "Pablo Bouza": "https://en.wikipedia.org/wiki/Pablo_Bouza",
  "Pablo Lemoine": "https://en.wikipedia.org/wiki/Pablo_Lemoine",
  "Kingsley Jones": "https://en.wikipedia.org/wiki/Kingsley_Jones_(Welsh_rugby_union_player)",
  "Pierre-Henry Broncan": "https://en.wikipedia.org/wiki/Pierre-Henry_Broncan",
  "Mahonri Schwalger": "https://en.wikipedia.org/wiki/Mahonri_Schwalger",
  "Ugo Mola": "https://en.wikipedia.org/wiki/Ugo_Mola",
  "Ronan O'Gara": "https://en.wikipedia.org/wiki/Ronan_O%27Gara",
  "Pat Lam": "https://en.wikipedia.org/wiki/Pat_Lam",
  "Johann van Graan": "https://en.wikipedia.org/wiki/Johann_van_Graan",
  "Warren Gatland": "https://en.wikipedia.org/wiki/Warren_Gatland",
  "Leo Cullen": "https://en.wikipedia.org/wiki/Leo_Cullen_(rugby_union)",
  "Franco Smith": "https://en.wikipedia.org/wiki/Franco_Smith",
  "Jamie Joseph": "https://en.wikipedia.org/wiki/Jamie_Joseph",
  "Tana Umaga": "https://en.wikipedia.org/wiki/Tana_Umaga",
  "Vern Cotter": "https://en.wikipedia.org/wiki/Vern_Cotter",
  "Les Kiss": "https://en.wikipedia.org/wiki/Les_Kiss",
  "Stephen Larkham": "https://en.wikipedia.org/wiki/Stephen_Larkham",
  "Mark McCall": "https://en.wikipedia.org/wiki/Mark_McCall",
  "Rob Baxter": "https://en.wikipedia.org/wiki/Rob_Baxter",
  "John Dobson": "https://en.wikipedia.org/wiki/John_Dobson_(rugby_union)",
  "John Plumtree": "https://en.wikipedia.org/wiki/John_Plumtree",
  "Dan McKellar": "https://en.wikipedia.org/wiki/Dan_McKellar",
  "Patrice Collazo": "https://en.wikipedia.org/wiki/Patrice_Collazo",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function argValue(flag: string): string | null {
  const prefix = `${flag}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

async function printCoverage(label: string) {
  const db = getDb();
  const [row] = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE c.is_public AND c.publish_status = 'published') AS public_coaches,
      count(*) FILTER (
        WHERE c.is_public AND c.publish_status = 'published' AND c.wikipedia_url IS NOT NULL AND c.wikipedia_url <> ''
      ) AS with_wiki,
      count(*) FILTER (
        WHERE c.is_public AND c.publish_status = 'published' AND c.image_url IS NOT NULL AND c.image_url <> ''
      ) AS with_image,
      count(*) FILTER (
        WHERE c.is_public AND c.publish_status = 'published' AND EXISTS (
          SELECT 1 FROM team_coaching_staff a WHERE a.coach_id = c.id
        )
      ) AS with_assignment,
      count(*) FILTER (
        WHERE c.is_public AND c.publish_status = 'published' AND EXISTS (
          SELECT 1 FROM team_coaching_staff a
          WHERE a.coach_id = c.id
            AND a.record_status <> 'conflict'
            AND (a.is_current OR a.show_on_overview OR a.verified_at IS NOT NULL OR a.start_date IS NOT NULL)
        )
      ) AS with_public_assignment,
      count(*) FILTER (
        WHERE c.is_public AND c.publish_status = 'published' AND EXISTS (
          SELECT 1 FROM coach_playing_stints p WHERE p.coach_id = c.id
        )
      ) AS with_playing,
      count(*) FILTER (
        WHERE c.is_public AND c.publish_status = 'published' AND EXISTS (
          SELECT 1 FROM coach_honours h WHERE h.coach_id = c.id
        )
      ) AS with_honours
    FROM coaches c
  `);
  console.log(`\n${label}`, row);
}

async function restoreCanonicalCurrentRows() {
  const db = getDb();
  await db.execute(sql`
    UPDATE team_coaching_staff
    SET show_on_overview = true, record_status = CASE
      WHEN record_status = 'conflict' THEN record_status ELSE 'verified' END,
      verified_at = COALESCE(verified_at, now()),
      updated_at = now()
    WHERE is_current = true AND record_status <> 'conflict'
  `);
  const hidden = await db.execute(sql`
    UPDATE team_coaching_staff AS dup
    SET is_current = false, show_on_overview = false, updated_at = now()
    WHERE dup.import_key LIKE 'current-coach:%'
      AND EXISTS (
        SELECT 1
        FROM team_coaching_staff AS keep
        WHERE keep.coach_id = dup.coach_id
          AND keep.role = dup.role
          AND keep.is_current = true
          AND (keep.import_key IS NULL OR keep.import_key NOT LIKE 'current-coach:%')
      )
  `);
  console.log("  restored Rassie current HC; hid duplicate current-coach rows", hidden);
}

async function backfillWikipediaVisibility() {
  const db = getDb();
  const assignments = await db.execute(sql`
    UPDATE team_coaching_staff
    SET
      verified_at = COALESCE(verified_at, now()),
      record_status = CASE WHEN record_status = 'conflict' THEN record_status ELSE 'verified' END,
      show_on_overview = CASE
        WHEN import_key LIKE 'wikipedia:%' THEN true
        ELSE show_on_overview
      END,
      updated_at = now()
    WHERE record_status <> 'conflict'
      AND (
        import_key LIKE 'wikipedia:%'
        OR import_key LIKE 'wikipedia-category:%'
        OR COALESCE(source_url, '') ILIKE '%wikipedia%'
      )
      AND coach_id <> ${RASSIE_ID}::uuid
  `);
  const playing = await db.execute(sql`
    UPDATE coach_playing_stints
    SET
      verified_at = COALESCE(verified_at, now()),
      record_status = CASE WHEN record_status = 'conflict' THEN record_status ELSE 'verified' END,
      updated_at = now()
    WHERE record_status <> 'conflict'
      AND source_provider = 'wikipedia'
      AND coach_id <> ${RASSIE_ID}::uuid
  `);
  console.log("  wikipedia assignment visibility", assignments);
  console.log("  wikipedia playing visibility", playing);
}

async function retargetUnknownTeams() {
  const db = getDb();
  const resolver = buildCoachTeamResolver(await loadCmsTeamsForCoachAssignment());
  const rows = await db
    .select({
      id: teamCoachingStaff.id,
      teamId: teamCoachingStaff.teamId,
      bioSummary: teamCoachingStaff.bioSummary,
      teamDisplayName: teamCoachingStaff.teamDisplayName,
      teamName: teams.name,
    })
    .from(teamCoachingStaff)
    .innerJoin(teams, eq(teamCoachingStaff.teamId, teams.id))
    .where(ilike(teams.name, "Unknown team%"));

  let updated = 0;
  for (const row of rows) {
    const label =
      row.teamDisplayName?.trim() || teamNameFromAssignmentBio(row.bioSummary);
    if (!label) continue;
    const resolved = resolver.resolveWikipediaTeamLabel(label);
    if (!resolved || /^unknown team/i.test(resolved.name)) continue;
    await db
      .update(teamCoachingStaff)
      .set({
        teamId: resolved.id,
        teamDisplayName: label,
        updatedAt: new Date(),
      })
      .where(eq(teamCoachingStaff.id, row.id));
    updated += 1;
  }
  console.log(`  retargeted ${updated} / ${rows.length} unknown-team assignments`);
}

async function applyKnownWikipediaUrls() {
  const db = getDb();
  let updated = 0;
  for (const [name, url] of Object.entries(KNOWN_WIKIPEDIA_URLS)) {
    const coach = await resolveCoach({ name, createIfMissing: false });
    if (!coach || coach.id === RASSIE_ID) continue;
    if (coach.wikipediaUrl?.trim()) continue;
    await updateCoach(coach.id, { wikipediaUrl: url });
    updated += 1;
    console.log(`  wiki URL ${name}`);
  }
  const missingFrance = await db
    .select({ id: coaches.id, name: coaches.name, wikipediaUrl: coaches.wikipediaUrl })
    .from(coaches)
    .where(and(ilike(coaches.name, "%Galthi%"), or(isNull(coaches.wikipediaUrl), eq(coaches.wikipediaUrl, ""))));
  for (const row of missingFrance) {
    await updateCoach(row.id, {
      wikipediaUrl: KNOWN_WIKIPEDIA_URLS["Fabien Galthié"],
    });
    updated += 1;
    console.log(`  wiki URL ${row.name}`);
  }
  console.log(`  applied ${updated} known Wikipedia URLs`);
}

async function enrichPublicCoaches(limit: number | null, delayMs: number) {
  const db = getDb();
  const rows = await db
    .select({
      id: coaches.id,
      name: coaches.name,
      slug: coaches.slug,
      wikipediaUrl: coaches.wikipediaUrl,
      imageUrl: coaches.imageUrl,
    })
    .from(coaches)
    .where(
      and(
        eq(coaches.isPublic, true),
        eq(coaches.publishStatus, "published"),
        sql`${coaches.wikipediaUrl} is not null and ${coaches.wikipediaUrl} <> ''`,
      ),
    );

  const honourCounts = await db
    .select({
      coachId: coachHonours.coachId,
      n: sql<number>`count(*)::int`,
    })
    .from(coachHonours)
    .groupBy(coachHonours.coachId);
  const honoursByCoach = new Map(honourCounts.map((row) => [row.coachId, row.n]));

  const assignmentCounts = await db
    .select({
      coachId: teamCoachingStaff.coachId,
      n: sql<number>`count(*)::int`,
    })
    .from(teamCoachingStaff)
    .groupBy(teamCoachingStaff.coachId);
  const assignmentsByCoach = new Map(assignmentCounts.map((row) => [row.coachId, row.n]));

  const ranked = rows
    .filter((row) => row.id !== RASSIE_ID)
    .sort((a, b) => {
      const aScore =
        (assignmentsByCoach.get(a.id) ?? 0) +
        (honoursByCoach.get(a.id) ?? 0) +
        (a.imageUrl ? 2 : 0);
      const bScore =
        (assignmentsByCoach.get(b.id) ?? 0) +
        (honoursByCoach.get(b.id) ?? 0) +
        (b.imageUrl ? 2 : 0);
      return aScore - bScore;
    });

  const subset = limit != null ? ranked.slice(0, limit) : ranked;
  console.log(`  enriching ${subset.length} / ${ranked.length} public coaches with Wikipedia URLs`);

  let ok = 0;
  let failed = 0;
  for (const [index, coach] of subset.entries()) {
    process.stdout.write(`  [${index + 1}/${subset.length}] ${coach.name}… `);
    try {
      const result = await withRetry(
        () => enrichCoachFromWikipedia(coach.id, { skipHonours: true }),
        coach.name,
      );
      if (!coach.imageUrl) {
        const thumbs = await fetchWikipediaThumbnails([
          coach.name,
          `${coach.name} rugby`,
          `${coach.name} rugby coach`,
        ]);
        const url =
          thumbs.get(coach.name) ||
          thumbs.get(`${coach.name} rugby`) ||
          thumbs.get(`${coach.name} rugby coach`);
        if (url) {
          await setCoachPrimaryImage({
            coachId: coach.id,
            imageUrl: url,
            sourceProvider: "wikipedia",
            credit: "Wikipedia",
          });
        }
      }
      console.log(
        result.enriched
          ? `assignments +${result.assignmentsCreated}/~${result.assignmentsUpdated}`
          : result.reason ?? "skipped",
      );
      ok += 1;
    } catch (error) {
      failed += 1;
      console.log("FAILED", error instanceof Error ? error.message : error);
    }
    await sleep(delayMs);
  }
  console.log(`  enrich done ok=${ok} failed=${failed}`);
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      const msg = error instanceof Error ? error.message : String(error);
      if (!/\(429\)|429|rate limit/i.test(msg)) throw error;
      const wait = 8000 * (attempt + 1);
      process.stdout.write(`429, wait ${wait}ms… `);
      await sleep(wait);
    }
  }
  throw last;
}

async function hydrateHonoursForPublicCoaches(limit: number | null, delayMs: number) {
  const { hydrateCoachHonoursFromWikipedia } = await import(
    "../apps/web/src/lib/coach-wikipedia-import-service"
  );
  const db = getDb();
  const rows = await db
    .select({
      id: coaches.id,
      name: coaches.name,
      wikipediaUrl: coaches.wikipediaUrl,
    })
    .from(coaches)
    .where(
      and(
        eq(coaches.isPublic, true),
        eq(coaches.publishStatus, "published"),
        sql`${coaches.wikipediaUrl} is not null and ${coaches.wikipediaUrl} <> ''`,
      ),
    );
  const honourCounts = await db
    .select({
      coachId: coachHonours.coachId,
      n: sql<number>`count(*)::int`,
    })
    .from(coachHonours)
    .groupBy(coachHonours.coachId);
  const honoursByCoach = new Map(honourCounts.map((row) => [row.coachId, row.n]));
  const missing = rows.filter((row) => row.id !== RASSIE_ID && (honoursByCoach.get(row.id) ?? 0) === 0);
  const subset = limit != null ? missing.slice(0, limit) : missing;
  console.log(`  honour hydrate ${subset.length} / ${missing.length} coaches with no honours`);
  let added = 0;
  for (const [index, coach] of subset.entries()) {
    process.stdout.write(`  honours [${index + 1}/${subset.length}] ${coach.name}… `);
    try {
      const created = await withRetry(() => hydrateCoachHonoursFromWikipedia(coach.id), coach.name);
      console.log(created > 0 ? `+${created}` : "none");
      added += created;
    } catch (error) {
      console.log("FAILED", error instanceof Error ? error.message : error);
    }
    await sleep(delayMs);
  }
  console.log(`  honour hydrate wrote ${added} rows`);
}

async function persistCurrentCoachSnapshots() {
  const db = getDb();
  const rows = await db
    .select({ id: coaches.id, name: coaches.name })
    .from(teamCoachingStaff)
    .innerJoin(coaches, eq(teamCoachingStaff.coachId, coaches.id))
    .where(eq(teamCoachingStaff.isCurrent, true));
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
  console.log(`  snapshots for ${unique.length} current coaches`);
  for (const coach of unique) {
    process.stdout.write(`  snapshot ${coach.name}… `);
    try {
      const bundle = await persistLiteCoachRatingSnapshot(coach.id, { skipIntelligence: true });
      console.log(
        `rating=${bundle.overallRating ?? "—"} power=${bundle.powerIndex ?? "—"} matches=${bundle.matchCount}`,
      );
    } catch (error) {
      console.log("FAILED", error instanceof Error ? error.message : error);
    }
  }
}

async function main() {
  const skipEnrich = hasFlag("--skip-enrich");
  const skipAssign = hasFlag("--skip-assign");
  const skipSnapshots = hasFlag("--skip-snapshots");
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Number(limitRaw) : null;
  const delayMs = Number(argValue("--delay-ms") ?? "2000");
  const skipHonours = hasFlag("--skip-honours");

  await printCoverage("before");

  console.log("\n1. Wikipedia assignment / playing visibility backfill");
  await backfillWikipediaVisibility();

  console.log("2. Retarget Unknown team assignment rows");
  await retargetUnknownTeams();

  console.log("2b. Restore canonical current rows / hide duplicate current-coach keys");
  await restoreCanonicalCurrentRows();

  if (!skipAssign) {
    console.log("3. Current coach assignments (skip coaches who already have a current row)");
    const assigned = await assignCurrentCoaches();
    console.log(
      `  created=${assigned.assignmentsCreated} updated=${assigned.assignmentsUpdated} demoted=${assigned.demotedPriorCurrent} failures=${assigned.failures.length}`,
    );
    for (const failure of assigned.failures.slice(0, 20)) {
      console.log(`    ${failure.coachName} @ ${failure.teamSlug}: ${failure.error}`);
    }
    await restoreCanonicalCurrentRows();
  }

  console.log("4. Known Wikipedia URLs for current/high-profile coaches");
  await applyKnownWikipediaUrls();

  if (!skipEnrich) {
    console.log("5. Wikipedia enrich (assignments, playing, honours, images)");
    await enrichPublicCoaches(Number.isFinite(limit) ? limit : null, delayMs);
  } else {
    console.log("5. Wikipedia enrich skipped");
  }

  if (!skipHonours) {
    console.log("5b. Wikipedia honours for coaches with none");
    await hydrateHonoursForPublicCoaches(Number.isFinite(limit) ? limit : null, delayMs);
  }

  if (!skipSnapshots) {
    console.log("6. Lite rating snapshots for current assigned coaches");
    await persistCurrentCoachSnapshots();
  }

  await printCoverage("after");
  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
