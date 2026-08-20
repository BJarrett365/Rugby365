import "server-only";
import { and, gte, lt } from "drizzle-orm";
import { fixtures, teams } from "@rugby365/db";
import { utcInstantFromZonedWallClock } from "@rugby365/import-sdk";
import { getDb } from "./db";
import { addDaysToDateKey } from "./match-schedule-utils";
import { getSupabaseServerClient } from "./supabase-server";

export const SUPABASE_MEDIA_BUCKET = "rugby365-media";
export const SUPABASE_LIVE_BUCKET = "rugby365-live";

export type SupabaseBootstrapResult = {
  ok: boolean;
  mediaBucket: "created" | "exists" | "error";
  liveBucket: "created" | "exists" | "error";
  liveFixturesTable: "ready" | "missing" | "error";
  messages: string[];
};

export type LiveFixtureMirrorRow = {
  rugby365_fixture_id: string;
  rugby_data_match_id: string | null;
  match_date: string;
  kickoff_at: string | null;
  status: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  competition: string | null;
  payload: Record<string, unknown>;
  updated_at: string;
};

async function ensureBucket(name: string, isPublic: boolean): Promise<"created" | "exists" | "error"> {
  const supabase = await getSupabaseServerClient("service");
  const listed = await supabase.storage.listBuckets();
  if (listed.error) return "error";
  if ((listed.data ?? []).some((b) => b.name === name)) return "exists";

  const created = await supabase.storage.createBucket(name, {
    public: isPublic,
    fileSizeLimit: 10 * 1024 * 1024,
  });
  if (created.error) {
    // Race / already exists
    if (/already exists/i.test(created.error.message)) return "exists";
    return "error";
  }
  return "created";
}

export async function bootstrapSupabaseIntegration(): Promise<SupabaseBootstrapResult> {
  const messages: string[] = [];
  const mediaBucket = await ensureBucket(SUPABASE_MEDIA_BUCKET, true);
  const liveBucket = await ensureBucket(SUPABASE_LIVE_BUCKET, true);

  if (mediaBucket === "error") messages.push(`Failed to ensure bucket ${SUPABASE_MEDIA_BUCKET}`);
  else messages.push(`Bucket ${SUPABASE_MEDIA_BUCKET}: ${mediaBucket}`);

  if (liveBucket === "error") messages.push(`Failed to ensure bucket ${SUPABASE_LIVE_BUCKET}`);
  else messages.push(`Bucket ${SUPABASE_LIVE_BUCKET}: ${liveBucket}`);

  let liveFixturesTable: SupabaseBootstrapResult["liveFixturesTable"] = "ready";
  try {
    const supabase = await getSupabaseServerClient("service");
    const probe = await supabase.from("live_fixtures").select("id").limit(1);
    if (probe.error) {
      liveFixturesTable = /schema cache|does not exist|PGRST/i.test(probe.error.message)
        ? "missing"
        : "error";
      messages.push(`live_fixtures: ${probe.error.message}`);
    } else {
      messages.push("live_fixtures table: ready");
    }
  } catch (error) {
    liveFixturesTable = "error";
    messages.push(error instanceof Error ? error.message : "live_fixtures probe failed");
  }

  return {
    ok: mediaBucket !== "error" && liveBucket !== "error" && liveFixturesTable === "ready",
    mediaBucket,
    liveBucket,
    liveFixturesTable,
    messages,
  };
}

export async function getSupabaseIntegrationStatus(): Promise<{
  configured: boolean;
  buckets: string[];
  liveFixturesCount: number | null;
  error?: string;
}> {
  try {
    const supabase = await getSupabaseServerClient("service");
    const buckets = await supabase.storage.listBuckets();
    const countRes = await supabase
      .from("live_fixtures")
      .select("id", { count: "exact", head: true });
    return {
      configured: true,
      buckets: (buckets.data ?? []).map((b) => b.name),
      liveFixturesCount: countRes.count ?? null,
      error: buckets.error?.message ?? countRes.error?.message,
    };
  } catch (error) {
    return {
      configured: false,
      buckets: [],
      liveFixturesCount: null,
      error: error instanceof Error ? error.message : "Status check failed",
    };
  }
}

function dayBounds(dateKey: string, timeZone: string) {
  const start = utcInstantFromZonedWallClock(dateKey, "00:00:00", timeZone);
  const end = utcInstantFromZonedWallClock(addDaysToDateKey(dateKey, 1), "00:00:00", timeZone);
  return { start, end };
}

export async function mirrorLiveFixturesToSupabase(
  dateKey: string,
  options: { timeZone?: string } = {},
): Promise<{ upserted: number; storagePath: string | null; errors: string[] }> {
  const timeZone = options.timeZone ?? "Europe/London";
  const errors: string[] = [];
  const db = getDb();
  const { start, end } = dayBounds(dateKey, timeZone);

  const fixtureRows = await db
    .select()
    .from(fixtures)
    .where(and(gte(fixtures.kickoffAt, start), lt(fixtures.kickoffAt, end)));
  const teamRows = await db.select({ id: teams.id, name: teams.name }).from(teams);
  const teamById = Object.fromEntries(teamRows.map((t) => [t.id, t.name]));

  const rows: LiveFixtureMirrorRow[] = fixtureRows.map((f) => {
    const snap =
      f.providerSnapshot && typeof f.providerSnapshot === "object"
        ? (f.providerSnapshot as Record<string, unknown>)
        : {};
    const rd =
      snap.rugby_data && typeof snap.rugby_data === "object"
        ? (snap.rugby_data as Record<string, unknown>)
        : {};
    return {
      rugby365_fixture_id: f.id,
      rugby_data_match_id: typeof rd.matchId === "string" ? rd.matchId : f.externalMatchId,
      match_date: dateKey,
      kickoff_at: f.kickoffAt?.toISOString() ?? null,
      status: f.status,
      home_team: (f.homeTeamId && teamById[f.homeTeamId]) || "Home",
      away_team: (f.awayTeamId && teamById[f.awayTeamId]) || "Away",
      home_score: f.homeScore ?? 0,
      away_score: f.awayScore ?? 0,
      competition: f.competitionName,
      payload: {
        slug: f.slug,
        externalMatchId: f.externalMatchId,
        planetRugbyUrl: f.planetRugbyUrl,
        rugby_data: rd,
      },
      updated_at: new Date().toISOString(),
    };
  });

  const supabase = await getSupabaseServerClient("service");
  let upserted = 0;

  if (rows.length > 0) {
    const { error, count } = await supabase.from("live_fixtures").upsert(rows, {
      onConflict: "match_date,home_team,away_team",
      count: "exact",
    });
    if (error) errors.push(error.message);
    else upserted = count ?? rows.length;
  }

  const storagePath = `fixtures/${dateKey}.json`;
  const json = JSON.stringify(
    { dateKey, generatedAt: new Date().toISOString(), count: rows.length, fixtures: rows },
    null,
    2,
  );
  await ensureBucket(SUPABASE_LIVE_BUCKET, true);
  const upload = await supabase.storage.from(SUPABASE_LIVE_BUCKET).upload(storagePath, json, {
    contentType: "application/json",
    upsert: true,
  });
  if (upload.error) {
    errors.push(`storage: ${upload.error.message}`);
    return { upserted, storagePath: null, errors };
  }

  return { upserted, storagePath, errors };
}

/** Upload raw image bytes (e.g. badge cutout PNG) to Supabase media bucket. */
export async function uploadPlayerImageBytesToSupabase(input: {
  playerId: string;
  imageId: string;
  bytes: Buffer | Uint8Array;
  contentType?: string;
  ext?: string;
}): Promise<{ publicUrl: string | null; path: string | null; error?: string }> {
  try {
    const contentType = input.contentType ?? "image/png";
    const ext = input.ext ?? (contentType.includes("webp") ? "webp" : "png");
    const path = `players/${input.playerId}/${input.imageId}.${ext}`;
    await ensureBucket(SUPABASE_MEDIA_BUCKET, true);
    const supabase = await getSupabaseServerClient("service");
    const upload = await supabase.storage.from(SUPABASE_MEDIA_BUCKET).upload(path, input.bytes, {
      contentType,
      upsert: true,
    });
    if (upload.error) {
      return { publicUrl: null, path: null, error: upload.error.message };
    }
    const { data } = supabase.storage.from(SUPABASE_MEDIA_BUCKET).getPublicUrl(path);
    return { publicUrl: data.publicUrl, path };
  } catch (error) {
    return {
      publicUrl: null,
      path: null,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/** Upload coach portrait bytes to Supabase media bucket. */
export async function uploadCoachImageBytesToSupabase(input: {
  coachId: string;
  imageId: string;
  bytes: Buffer | Uint8Array;
  contentType?: string;
  ext?: string;
}): Promise<{ publicUrl: string | null; path: string | null; error?: string }> {
  try {
    const contentType = input.contentType ?? "image/png";
    const ext = input.ext ?? (contentType.includes("webp") ? "webp" : "png");
    const path = `coaches/${input.coachId}/${input.imageId}.${ext}`;
    await ensureBucket(SUPABASE_MEDIA_BUCKET, true);
    const supabase = await getSupabaseServerClient("service");
    const upload = await supabase.storage.from(SUPABASE_MEDIA_BUCKET).upload(path, input.bytes, {
      contentType,
      upsert: true,
    });
    if (upload.error) {
      return { publicUrl: null, path: null, error: upload.error.message };
    }
    const { data } = supabase.storage.from(SUPABASE_MEDIA_BUCKET).getPublicUrl(path);
    return { publicUrl: data.publicUrl, path };
  } catch (error) {
    return {
      publicUrl: null,
      path: null,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

export async function mirrorRemoteImageToSupabase(input: {
  sourceUrl: string;
  playerId: string;
  imageId: string;
}): Promise<{ publicUrl: string | null; path: string | null; error?: string }> {
  try {
    const res = await fetch(input.sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Rugby365Bot/1.0; +https://localhost)",
        Accept: "image/*,*/*",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return { publicUrl: null, path: null, error: `Fetch source failed (${res.status})` };
    }
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext =
      contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const bytes = Buffer.from(await res.arrayBuffer());
    const path = `players/${input.playerId}/${input.imageId}.${ext}`;

    await ensureBucket(SUPABASE_MEDIA_BUCKET, true);
    const supabase = await getSupabaseServerClient("service");
    const upload = await supabase.storage.from(SUPABASE_MEDIA_BUCKET).upload(path, bytes, {
      contentType,
      upsert: true,
    });
    if (upload.error) {
      return { publicUrl: null, path: null, error: upload.error.message };
    }
    const { data } = supabase.storage.from(SUPABASE_MEDIA_BUCKET).getPublicUrl(path);
    return { publicUrl: data.publicUrl, path };
  } catch (error) {
    return {
      publicUrl: null,
      path: null,
      error: error instanceof Error ? error.message : "Mirror failed",
    };
  }
}
