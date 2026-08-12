import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { getSupabaseServerClient } from "./supabase-server";

export type SupabaseTableSyncResult = {
  table: string;
  localCount: number;
  upserted: number;
  skipped: boolean;
  error?: string;
};

export type SupabaseFullSyncResult = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  tables: SupabaseTableSyncResult[];
  totalUpserted: number;
  errors: string[];
};

type SyncTableSpec = {
  name: string;
  /** Primary key column(s) for upsert onConflict. */
  onConflict: string;
  /** Optional columns to null on first pass (break circular FKs). */
  nullify?: string[];
  /** Skip syncing this table (secrets / ops noise). */
  skip?: boolean;
  batchSize?: number;
};

/**
 * FK-safe order for mapping primary Rugby365 Postgres → Supabase public schema.
 * Skips credential/ops tables that should stay primary-only.
 */
export const SUPABASE_SYNC_TABLES: SyncTableSpec[] = [
  { name: "sports", onConflict: "id" },
  { name: "teams", onConflict: "id", nullify: ["home_venue_id"] },
  { name: "venues", onConflict: "id" },
  { name: "teams", onConflict: "id" }, // second pass restores home_venue_id
  { name: "competitions", onConflict: "id" },
  { name: "competition_seasons", onConflict: "id" },
  { name: "referees", onConflict: "id" },
  { name: "coaches", onConflict: "id" },
  { name: "players", onConflict: "id", nullify: ["primary_image_id"] },
  { name: "people", onConflict: "id" },
  { name: "fixtures", onConflict: "id", batchSize: 200 },
  { name: "standing_rows", onConflict: "id" },
  { name: "fixture_players", onConflict: "id", batchSize: 400 },
  { name: "match_events", onConflict: "id", batchSize: 400 },
  { name: "team_match_stats", onConflict: "id" },
  { name: "player_match_performance_stats", onConflict: "id", batchSize: 300 },
  { name: "player_season_stats", onConflict: "id" },
  { name: "player_transfers", onConflict: "id" },
  { name: "player_career_stints", onConflict: "id" },
  { name: "player_team_memberships", onConflict: "id" },
  { name: "player_legends", onConflict: "id" },
  { name: "player_images", onConflict: "id" },
  { name: "players", onConflict: "id" }, // second pass restores primary_image_id
  { name: "player_image_learning_rules", onConflict: "id" },
  { name: "player_injuries", onConflict: "id" },
  { name: "player_suspensions", onConflict: "id" },
  { name: "player_ratings", onConflict: "player_id" },
  { name: "player_rating_history", onConflict: "id" },
  { name: "player_value_history", onConflict: "id" },
  { name: "player_value_score_history", onConflict: "id" },
  { name: "player_form_history", onConflict: "id" },
  { name: "player_ranking_history", onConflict: "id" },
  { name: "player_match_ratings", onConflict: "id", batchSize: 300 },
  { name: "player_selection_trends", onConflict: "id" },
  { name: "player_radar_caches", onConflict: "id" },
  { name: "player_external_matches", onConflict: "id" },
  { name: "team_coaching_staff", onConflict: "id" },
  { name: "coach_playing_stints", onConflict: "id" },
  { name: "coach_education", onConflict: "id" },
  { name: "coach_honours", onConflict: "id" },
  { name: "coach_awards", onConflict: "id" },
  { name: "coach_medals", onConflict: "id" },
  { name: "coach_milestones", onConflict: "id" },
  { name: "coach_images", onConflict: "id" },
  { name: "coach_rating_snapshots", onConflict: "id" },
  { name: "coach_rating_history", onConflict: "id" },
  { name: "coach_match_ratings", onConflict: "id" },
  { name: "referee_match_ratings", onConflict: "id" },
  { name: "referee_appointments", onConflict: "id" },
  { name: "fixture_tracker_settings", onConflict: "fixture_id" },
  { name: "fixture_broadcasters", onConflict: "id" },
  { name: "commentary_rules", onConflict: "id" },
  { name: "commentary_templates", onConflict: "id" },
  { name: "commentary_suggestions", onConflict: "id" },
  { name: "match_commentary", onConflict: "id" },
  { name: "rugby_laws", onConflict: "id" },
  { name: "rugby_law_mappings", onConflict: "id" },
  { name: "world_ranking_feeds", onConflict: "category", nullify: ["current_snapshot_id"] },
  { name: "world_ranking_snapshots", onConflict: "id" },
  { name: "world_ranking_rows", onConflict: "id" },
  { name: "world_ranking_leader_spans", onConflict: "id" },
  { name: "world_ranking_team_milestones", onConflict: "id" },
  { name: "award_definitions", onConflict: "id" },
  { name: "achievements", onConflict: "id" },
  { name: "achievement_sources", onConflict: "id" },
  { name: "world_ranking_feeds", onConflict: "category" }, // restore current_snapshot_id
  { name: "live_fixtures", onConflict: "id", skip: true }, // denormalized mirror; use mirror-day
  { name: "integration_settings", onConflict: "id", skip: true },
  { name: "provider_raw_responses", onConflict: "id", skip: true },
  { name: "provider_entity_mappings", onConflict: "id" },
  { name: "data_integration_jobs", onConflict: "id", skip: true },
  { name: "data_integration_conflicts", onConflict: "id", skip: true },
  { name: "data_field_locks", onConflict: "id", skip: true },
  { name: "data_integration_audit_log", onConflict: "id", skip: true },
  { name: "data_integration_metrics", onConflict: "id", skip: true },
  { name: "agent_sandbox_runs", onConflict: "id", skip: true },
  { name: "agent_sandbox_events", onConflict: "id", skip: true },
  { name: "transfer_import_logs", onConflict: "id", skip: true },
  { name: "squad_audit_clubs", onConflict: "id", skip: true },
  { name: "squad_audit_jobs", onConflict: "id", skip: true },
  { name: "squad_audit_players", onConflict: "id", skip: true },
  { name: "squad_audit_log", onConflict: "id", skip: true },
  { name: "ai_enrichment_suggestions", onConflict: "id" },
  { name: "ai_verification_reports", onConflict: "id" },
  { name: "player_bio_profiles", onConflict: "player_id" },
  { name: "player_bio_suggestions", onConflict: "id" },
  { name: "player_bio_history", onConflict: "id" },
  { name: "player_profile_verification_reports", onConflict: "id" },
  { name: "person_bio_profiles", onConflict: "person_id" },
  { name: "person_bio_suggestions", onConflict: "id" },
  { name: "person_bio_history", onConflict: "id" },
  { name: "person_verification_reports", onConflict: "id" },
  { name: "person_intelligence_score_history", onConflict: "id" },
  { name: "commentary_research_findings", onConflict: "id" },
  { name: "reference_products", onConflict: "id" },
];

function serializeRow(row: Record<string, unknown>, nullify?: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (nullify?.includes(key)) {
      out[key] = null;
      continue;
    }
    if (value instanceof Date) {
      out[key] = value.toISOString();
    } else if (typeof value === "bigint") {
      out[key] = Number(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function filterToRemoteColumns(
  payload: Record<string, unknown>[],
  remoteColumns: Set<string> | null,
): Record<string, unknown>[] {
  if (!remoteColumns) return payload;
  return payload.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (remoteColumns.has(key)) out[key] = value;
    }
    return out;
  });
}

const remoteColumnCache = new Map<string, Set<string> | null>();

async function getRemoteColumns(table: string): Promise<Set<string> | null> {
  if (remoteColumnCache.has(table)) return remoteColumnCache.get(table) ?? null;
  const supabase = await getSupabaseServerClient("service");
  const { data, error } = await supabase.from(table).select("*").limit(1);
  if (error) {
    remoteColumnCache.set(table, null);
    return null;
  }
  if (data?.[0]) {
    const cols = new Set(Object.keys(data[0]));
    remoteColumnCache.set(table, cols);
    return cols;
  }
  // Empty table: infer from OpenAPI via a no-op upsert error is unreliable; leave unfiltered.
  remoteColumnCache.set(table, null);
  return null;
}

function asRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

async function countLocalRows(table: string): Promise<number> {
  const db = getDb();
  const rows = asRows<{ count: number }>(
    await db.execute(sql.raw(`SELECT count(*)::int AS count FROM "${table}"`)),
  );
  return Number(rows[0]?.count ?? 0);
}

async function fetchLocalBatch(
  table: string,
  offset: number,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const db = getDb();
  return asRows<Record<string, unknown>>(
    await db.execute(
      sql.raw(`SELECT * FROM "${table}" ORDER BY 1 OFFSET ${offset} LIMIT ${limit}`),
    ),
  );
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

/** Not-null unique text columns: rename remote collisions to free the value. */
const RENAME_UNIQUE_COLUMNS = ["slug", "external_id", "import_key"] as const;

/** Nullable unique text columns: clear remote collisions so local upsert can claim them. */
const NULLIFY_UNIQUE_COLUMNS = [
  "external_provider_id",
  "sdms_comp_code",
  "planet_rugby_slug",
  "rugbypass_slug",
  "rugbypass_player_id",
] as const;

type UniqueColumn = (typeof RENAME_UNIQUE_COLUMNS)[number] | (typeof NULLIFY_UNIQUE_COLUMNS)[number];

function payloadColumns(payload: Record<string, unknown>[]): UniqueColumn[] {
  const sample = payload[0] ?? {};
  return [...RENAME_UNIQUE_COLUMNS, ...NULLIFY_UNIQUE_COLUMNS].filter((column) =>
    Object.prototype.hasOwnProperty.call(sample, column),
  );
}

/**
 * Free unique columns on remote rows that share a value with this payload but a different id.
 * Includes empty-string values (Postgres unique treats '' as a real key).
 */
async function resolveUniqueCollisions(
  table: string,
  payload: Record<string, unknown>[],
  column: UniqueColumn,
): Promise<string | null> {
  const values = [
    ...new Set(
      payload
        .map((row) => row[column])
        .filter((value): value is string => typeof value === "string"),
    ),
  ];
  if (!values.length) return null;

  const supabase = await getSupabaseServerClient("service");
  const remotes: Array<Record<string, unknown>> = [];

  for (const chunk of chunkValues(values, 80)) {
    const existing = await supabase.from(table).select(`id,${column}`).in(column, chunk);
    if (existing.error) {
      if (new RegExp(`column .*${column}.* does not exist`, "i").test(existing.error.message)) {
        return null;
      }
      return existing.error.message;
    }
    remotes.push(...(existing.data ?? []));
  }

  const rename = (RENAME_UNIQUE_COLUMNS as readonly string[]).includes(column);

  for (const remote of remotes) {
    const remoteValue = remote[column];
    if (typeof remoteValue !== "string") continue;
    const local = payload.find((row) => row[column] === remoteValue);
    if (!local || typeof local.id !== "string") continue;
    if (local.id === remote.id) continue;

    if (rename) {
      const base = remoteValue.length > 0 ? remoteValue : "empty";
      const legacy = `${base}__legacy__${String(remote.id).replace(/-/g, "").slice(0, 8)}`;
      const renamed = await supabase.from(table).update({ [column]: legacy }).eq("id", remote.id);
      if (renamed.error) {
        return `${column} collision ${JSON.stringify(remoteValue)}: ${renamed.error.message}`;
      }
      continue;
    }

    const cleared = await supabase.from(table).update({ [column]: null }).eq("id", remote.id);
    if (cleared.error) {
      return `${column} collision ${remoteValue}: ${cleared.error.message}`;
    }
  }
  return null;
}

/**
 * Park unique keys only for rows that already exist remotely.
 * Uses parallel chunked updates (eager full-table parking is too slow).
 */
async function parkPayloadUniqueKeys(
  table: string,
  payload: Record<string, unknown>[],
): Promise<string | null> {
  const columns = payloadColumns(payload);
  if (!columns.length) return null;

  const ids = payload.map((row) => row.id).filter((id): id is string => typeof id === "string");
  if (!ids.length) return null;

  const supabase = await getSupabaseServerClient("service");
  const existingIds: string[] = [];
  for (const chunk of chunkValues(ids, 100)) {
    const { data, error } = await supabase.from(table).select("id").in("id", chunk);
    if (error) return error.message;
    existingIds.push(...(data ?? []).map((row) => row.id as string));
  }
  if (!existingIds.length) return null;

  for (const chunk of chunkValues(existingIds, 25)) {
    const results = await Promise.all(
      chunk.map((id) => {
        const patch: Record<string, unknown> = {};
        for (const column of columns) {
          if ((RENAME_UNIQUE_COLUMNS as readonly string[]).includes(column)) {
            patch[column] = `__sync__${id.replace(/-/g, "").slice(0, 16)}`;
          } else {
            patch[column] = null;
          }
        }
        return supabase.from(table).update(patch).eq("id", id);
      }),
    );
    for (const parked of results) {
      if (parked.error) return `park: ${parked.error.message}`;
    }
  }
  return null;
}

async function upsertPayload(
  table: string,
  onConflict: string,
  payload: Record<string, unknown>[],
): Promise<{ error: string | null; count: number }> {
  const supabase = await getSupabaseServerClient("service");
  const { error, count } = await supabase.from(table).upsert(payload, {
    onConflict,
    count: "exact",
  });
  if (!error) return { error: null, count: count ?? payload.length };

  const isUnique =
    /duplicate key value violates unique constraint/i.test(error.message) ||
    /unique constraint/i.test(error.message);
  if (!isUnique) return { error: error.message, count: 0 };

  // Unique swap / missed collision: park, re-resolve, then row-by-row.
  const parkError = await parkPayloadUniqueKeys(table, payload);
  if (parkError) return { error: parkError, count: 0 };
  for (const column of payloadColumns(payload)) {
    const collisionError = await resolveUniqueCollisions(table, payload, column);
    if (collisionError) return { error: collisionError, count: 0 };
  }

  let ok = 0;
  for (const row of payload) {
    for (const column of payloadColumns([row])) {
      const collisionError = await resolveUniqueCollisions(table, [row], column);
      if (collisionError) return { error: collisionError, count: ok };
    }
    const single = await supabase.from(table).upsert(row, { onConflict, count: "exact" });
    if (single.error) return { error: single.error.message, count: ok };
    ok += single.count ?? 1;
  }
  return { error: null, count: ok };
}

async function syncOneTable(spec: SyncTableSpec): Promise<SupabaseTableSyncResult> {
  if (spec.skip) {
    return { table: spec.name, localCount: 0, upserted: 0, skipped: true };
  }

  const localCount = await countLocalRows(spec.name);
  if (localCount === 0) {
    return { table: spec.name, localCount: 0, upserted: 0, skipped: false };
  }

  const remoteColumns = await getRemoteColumns(spec.name);
  const batchSize = spec.batchSize ?? 250;
  let upserted = 0;
  let offset = 0;

  while (offset < localCount) {
    const batch = await fetchLocalBatch(spec.name, offset, batchSize);
    if (!batch.length) break;

    let payload = filterToRemoteColumns(
      batch.map((row) => serializeRow(row, spec.nullify)),
      remoteColumns,
    );
    if (!payload.length || Object.keys(payload[0] ?? {}).length === 0) {
      return {
        table: spec.name,
        localCount,
        upserted,
        skipped: false,
        error: "No overlapping columns with Supabase schema",
      };
    }
    for (const column of payloadColumns(payload)) {
      const collisionError = await resolveUniqueCollisions(spec.name, payload, column);
      if (collisionError) {
        return {
          table: spec.name,
          localCount,
          upserted,
          skipped: false,
          error: collisionError,
        };
      }
    }

    let upsertResult = await upsertPayload(spec.name, spec.onConflict, payload);

    // Schema cache lag / unexpected extra columns: strip and retry once.
    const missingCol = upsertResult.error?.match(
      /Could not find the '([^']+)' column of '([^']+)' in the schema cache/i,
    );
    if (missingCol) {
      const col = missingCol[1];
      payload = payload.map((row) => {
        const next = { ...row };
        delete next[col];
        return next;
      });
      if (remoteColumns) remoteColumns.delete(col);
      upsertResult = await upsertPayload(spec.name, spec.onConflict, payload);
    }

    if (upsertResult.error) {
      return {
        table: spec.name,
        localCount,
        upserted,
        skipped: false,
        error: upsertResult.error,
      };
    }

    upserted += upsertResult.count;
    offset += batch.length;
  }

  return { table: spec.name, localCount, upserted, skipped: false };
}

export async function syncAllDataToSupabase(options?: {
  tables?: string[];
  onProgress?: (result: SupabaseTableSyncResult, index: number, total: number) => void;
}): Promise<SupabaseFullSyncResult> {
  const startedAt = new Date().toISOString();
  const wanted = options?.tables?.length
    ? new Set(options.tables.map((t) => t.trim()).filter(Boolean))
    : null;

  const specs = SUPABASE_SYNC_TABLES.filter((spec) => !wanted || wanted.has(spec.name));
  const tables: SupabaseTableSyncResult[] = [];
  const errors: string[] = [];
  let totalUpserted = 0;

  for (const [index, spec] of specs.entries()) {
    try {
      const result = await syncOneTable(spec);
      tables.push(result);
      totalUpserted += result.upserted;
      if (result.error) errors.push(`${spec.name}: ${result.error}`);
      options?.onProgress?.(result, index, specs.length);
      if (result.error) {
        // Stop on hard failure so FK dependents don't cascade-noise.
        break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      const result: SupabaseTableSyncResult = {
        table: spec.name,
        localCount: 0,
        upserted: 0,
        skipped: false,
        error: message,
      };
      tables.push(result);
      errors.push(`${spec.name}: ${message}`);
      options?.onProgress?.(result, index, specs.length);
      break;
    }
  }

  return {
    ok: errors.length === 0,
    startedAt,
    finishedAt: new Date().toISOString(),
    tables,
    totalUpserted,
    errors,
  };
}

export async function getSupabaseMappedTableCounts(): Promise<
  Array<{ table: string; supabaseCount: number | null; error?: string }>
> {
  const supabase = await getSupabaseServerClient("service");
  const unique = [...new Set(SUPABASE_SYNC_TABLES.filter((t) => !t.skip).map((t) => t.name))];
  const out: Array<{ table: string; supabaseCount: number | null; error?: string }> = [];

  for (const table of unique) {
    const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
    out.push({
      table,
      supabaseCount: count ?? null,
      error: error?.message,
    });
  }
  return out;
}
