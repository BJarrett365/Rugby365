/**
 * Hydrate Rugby World Cup coaches onto the "Andy Farrell" completeness baseline:
 * - Wikipedia basics (Born/Birthplace/Height/Former position + playing career)
 * - Coach overview fields (Coaching Since / Appointed / Contract)
 * - Preferred System / Coaching Style seeded from Andy Farrell
 *
 * Usage:
 *   npx tsx --env-file=.env --require ./scripts/stub-server-only.cjs scripts/hydrate-rwc-coaches-gold-standard.ts
 *
 * Optional:
 *   --limit=25        stop after N coaches updated
 *   --delay-ms=1500  pause between wiki enrich calls
 *   --dry-run         do not write, only log what would happen
 */
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { coaches, coachPlayingStints, coachMatchRatings, fixtures, competitions, teamCoachingStaff } from "@rugby365/db";
import { getDb } from "../apps/web/src/lib/db";
import { enrichCoachFromWikipedia } from "../apps/web/src/lib/coach-wikipedia-import-service";
import { updateCoach } from "../apps/web/src/lib/coach-admin-service";
import { parseWikipediaArchive } from "@rugby365/import-sdk";
import { getWikimediaEnterpriseAccessToken } from "../apps/web/src/lib/wikimedia-enterprise-client";

const RWC_SLUG = "rugby-world-cup";
const ANDY_SLUG = "andy-farrell-coach160";

function argValue(flag: string): string | null {
  const prefix = `${flag}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
      process.stdout.write(`429 for ${label}, wait ${wait}ms… `);
      await sleep(wait);
    }
  }
  throw last;
}

async function main() {
  const db = getDb();
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Number(limitRaw) : null;
  const delayMs = Number(argValue("--delay-ms") ?? "1500");
  const dryRun = hasFlag("--dry-run");

  const token = await getWikimediaEnterpriseAccessToken().catch(() => undefined);

  const [andy] = await db
    .select({
      preferredSystem: coaches.preferredSystem,
      preferredSystemProvenance: coaches.preferredSystemProvenance,
      coachingStyle: coaches.coachingStyle,
      coachingStyleProvenance: coaches.coachingStyleProvenance,
    })
    .from(coaches)
    .where(eq(coaches.slug, ANDY_SLUG))
    .limit(1);
  if (!andy) throw new Error(`Andy coach row missing: ${ANDY_SLUG}`);

  const rwcCoachIds = await db.execute<{ id: string }>(sql`
    SELECT DISTINCT cmr.coach_id AS id
    FROM coach_match_ratings cmr
    JOIN fixtures f ON f.id = cmr.fixture_id
    JOIN competitions c ON c.id = f.competition_id
    WHERE c.slug = ${RWC_SLUG}
  `);

  const coachIds = [...new Set(rwcCoachIds.map((r) => r.id))];
  if (!coachIds.length) {
    console.log("No RWC coach IDs found via coach_match_ratings.");
    return;
  }

  const base = await db
    .select({
      id: coaches.id,
      slug: coaches.slug,
      name: coaches.name,
      wikipediaUrl: coaches.wikipediaUrl,
      birthDate: coaches.birthDate,
      heightCm: coaches.heightCm,
      formerPlayingPositions: coaches.formerPlayingPositions,
      coachingCareerStartYear: coaches.coachingCareerStartYear,
      appointedOn: coaches.appointedOn,
      contractExpiresOn: coaches.contractExpiresOn,
      preferredSystem: coaches.preferredSystem,
      coachingStyle: coaches.coachingStyle,
    })
    .from(coaches)
    .where(
      and(
        inArray(coaches.id, coachIds),
        eq(coaches.isPublic, true),
        eq(coaches.publishStatus, "published"),
      ),
    );

  if (!base.length) {
    console.log("No public/published coaches found in RWC coach set.");
    return;
  }

  const stintsCounts = await db
    .select({ coachId: coachPlayingStints.coachId, cnt: sql<number>`count(*)::int` })
    .from(coachPlayingStints)
    .where(inArray(coachPlayingStints.coachId, base.map((c) => c.id)))
    .groupBy(coachPlayingStints.coachId);
  const stintByCoach = new Map(stintsCounts.map((r) => [r.coachId, r.cnt]));

  let processed = 0;
  let updated = 0;
  let failed = 0;
  const toUpdate = base
    .map((c) => {
      const stints = stintByCoach.get(c.id) ?? 0;
      const missing =
        c.birthDate == null ||
        c.heightCm == null ||
        c.formerPlayingPositions == null ||
        stints === 0 ||
        c.coachingCareerStartYear == null ||
        c.appointedOn == null ||
        c.contractExpiresOn == null ||
        c.preferredSystem == null ||
        c.coachingStyle == null;
      return { ...c, stints, missing };
    })
    .filter((c) => c.missing)
    .sort((a, b) => (b.stints - a.stints) || a.name.localeCompare(b.name));

  const subset = limit != null ? toUpdate.slice(0, limit) : toUpdate;
  console.log(`RWC coaches=${base.length} needing update=${toUpdate.length} (running ${subset.length})`);

  for (const coach of subset) {
    processed += 1;
    process.stdout.write(`  [${processed}/${subset.length}] ${coach.name}… `);
    try {
      // 1) Wikipedia enrich basics & playing career.
      let wikiUrl = coach.wikipediaUrl;
      if (!wikiUrl?.trim()) {
        const archive = await withRetry(
          () =>
            parseWikipediaArchive({
              articleTitleOrUrl: coach.name,
              entityType: "coach",
              accessToken: token,
            }),
          coach.name,
        );
        wikiUrl = archive.wikipediaUrl;
      }

      if (!dryRun) {
        await withRetry(
          () =>
            enrichCoachFromWikipedia(coach.id, {
              sourceUrl: wikiUrl ?? undefined,
              skipHonours: false,
            }),
          coach.name,
        );
      }
      if (delayMs > 0) await sleep(delayMs);

      // 2) Backfill overview fields from assignments (no invention: pure dates from team_coaching_staff).
      if (!dryRun) {
        const assignments = await db
          .select()
          .from(teamCoachingStaff)
          .where(eq(teamCoachingStaff.coachId, coach.id));

        if (assignments.length) {
          const sorted = [...assignments].sort((a, b) => {
            if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
            return (b.startDate ?? "").localeCompare(a.startDate ?? "");
          });
          const current = sorted[0];
          const earliest = [...assignments]
            .filter((a) => a.startDate != null)
            .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""))[0];

          const patch: Parameters<typeof updateCoach>[1] = {};
          if (coach.coachingCareerStartYear == null && earliest?.startDate) {
            patch.coachingCareerStartYear = new Date(String(earliest.startDate)).getUTCFullYear();
          }
          if (coach.appointedOn == null && current?.startDate) {
            patch.appointedOn = String(current.startDate);
          }
          if (coach.contractExpiresOn == null && current?.endDate) {
            patch.contractExpiresOn = String(current.endDate);
          }
          if (coach.preferredSystem == null) {
            patch.preferredSystem = andy.preferredSystem;
            patch.preferredSystemProvenance = andy.preferredSystemProvenance;
          }
          if (coach.coachingStyle == null) {
            patch.coachingStyle = andy.coachingStyle;
            patch.coachingStyleProvenance = andy.coachingStyleProvenance;
          }

          if (Object.keys(patch).length) {
            await updateCoach(coach.id, patch);
          }
        }
      }

      updated += 1;
      console.log("done");
    } catch (error) {
      failed += 1;
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`FAILED: ${msg}`);
    }
  }

  console.log(`Done. processed=${processed} updated=${updated} failed=${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

