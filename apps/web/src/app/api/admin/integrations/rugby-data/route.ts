import { NextResponse } from "next/server";
import {
  clearRugbyDataApiCredentials,
  getRugbyDataApiPublicConfig,
  saveRugbyDataApiCredentials,
} from "@/lib/integration-settings-service";
import { testRugbyDataApiConnection } from "@/lib/rugby-data-api-client";
import { syncRugbyDataFixturesForDate } from "@/lib/rugby-data-day-sync-service";
import { discoverRugbyDataLeagues } from "@/lib/rugby-data-discovery-service";
import { pullAllRugbyDataFeeds } from "@/lib/rugby-data-feed-pull-service";
import { buildRugbyDataIngestGapReport } from "@/lib/rugby-data-ingest-gap-report";
import { listIntegrationJobs } from "@/lib/data-integration-job-service";
import { importAllRugbyDataLeagues } from "@/lib/rugby-data-import-service";
import {
  buildRugbyDataImportCoverageReport,
  enrichRugbyDataMatches,
} from "@/lib/rugby-data-match-import-service";
import {
  confirmRugbyDataMapping,
  getRugbyDataMappingSummary,
  ignoreRugbyDataMapping,
  listRugbyDataMappings,
} from "@/lib/rugby-data-mapping-service";
import { apiErrorResponse } from "@/lib/api-errors";
import type { MappingEntityType } from "@/lib/provider-mapping-types";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const view = url.searchParams.get("view");

    if (view === "jobs") {
      const jobs = await listIntegrationJobs({ limit: 20 });
      return NextResponse.json({ ok: true, jobs });
    }

    if (view === "mappings") {
      const status = url.searchParams.get("status") ?? undefined;
      const entityType = url.searchParams.get("entityType") as MappingEntityType | null;
      const mappings = await listRugbyDataMappings({
        status: status as never,
        entityType: entityType ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? 200),
      });
      const summary = await getRugbyDataMappingSummary();
      return NextResponse.json({ ok: true, mappings, summary });
    }

    if (view === "coverage") {
      const report = await buildRugbyDataImportCoverageReport();
      return NextResponse.json({ ok: true, report });
    }

    if (view === "ingest-gaps") {
      const report = await buildRugbyDataIngestGapReport();
      return NextResponse.json({ ok: true, report });
    }

    const config = await getRugbyDataApiPublicConfig();
    return NextResponse.json({
      ...config,
      docsUrl: "/docs/rugby-data-api",
      envTokenOverride: Boolean(process.env.RUGBY_DATA_API_TOKEN?.trim()),
      envBaseUrlOverride: Boolean(process.env.RUGBY_DATA_API_BASE_URL?.trim()),
    });
  } catch (e) {
    return apiErrorResponse(e, "Failed to load Rugby Data API settings");
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (body.action === "clear") {
      await clearRugbyDataApiCredentials();
      const config = await getRugbyDataApiPublicConfig();
      return NextResponse.json({ ok: true, cleared: true, ...config });
    }

    if (body.action === "test") {
      const result = await testRugbyDataApiConnection();
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, message: result.message },
          { status: 400 },
        );
      }
      return NextResponse.json({
        ok: true,
        message: `${result.message} (${result.responseTimeMs}ms)`,
      });
    }

    if (body.action === "sync-day") {
      const dateKey =
        typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
          ? body.date
          : new Date().toISOString().slice(0, 10);
      const result = await syncRugbyDataFixturesForDate(dateKey, {
        syncEvents: body.syncEvents !== false,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "pull-feeds") {
      const result = await pullAllRugbyDataFeeds({
        startedBy: "admin",
        leagueLimit: typeof body.leagueLimit === "number" ? body.leagueLimit : undefined,
        dateSweepDays: typeof body.dateSweepDays === "number" ? body.dateSweepDays : undefined,
        matchLimitPerLeague:
          typeof body.matchLimitPerLeague === "number" ? body.matchLimitPerLeague : undefined,
        includeMatchFeeds: body.includeMatchFeeds !== false,
        includeTeamFeeds: body.includeTeamFeeds !== false,
      });
      const gapReport = await buildRugbyDataIngestGapReport();
      return NextResponse.json({ ok: true, ...result, gapReport });
    }

    if (body.action === "discover") {
      const result = await discoverRugbyDataLeagues({ startedBy: "admin" });
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "import-all") {
      const leagueId = typeof body.leagueId === "number" ? body.leagueId : undefined;
      const result = await importAllRugbyDataLeagues({
        startedBy: "admin",
        leagueIds: leagueId ? [leagueId] : undefined,
        includeDateSweep: body.includeDateSweep !== false,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "enrich-matches") {
      const leagueId = typeof body.leagueId === "number" ? body.leagueId : undefined;
      const limit = typeof body.limit === "number" ? body.limit : 500;
      const status = typeof body.status === "string" ? body.status : "full_time";
      const result = await enrichRugbyDataMatches({
        leagueId,
        limit,
        status,
        startedBy: "admin",
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (body.action === "list-mappings") {
      const mappings = await listRugbyDataMappings({
        entityType: typeof body.entityType === "string" ? (body.entityType as MappingEntityType) : undefined,
        status: typeof body.status === "string" ? (body.status as never) : undefined,
        limit: typeof body.limit === "number" ? body.limit : 200,
      });
      return NextResponse.json({ ok: true, mappings });
    }

    if (body.action === "confirm-mapping") {
      const entityType = body.entityType as MappingEntityType;
      const externalId = String(body.externalId ?? "");
      const rugby365Id = String(body.rugby365Id ?? "");
      if (!entityType || !externalId || !rugby365Id) {
        return NextResponse.json({ ok: false, error: "entityType, externalId and rugby365Id are required" }, { status: 400 });
      }
      const mapping = await confirmRugbyDataMapping({
        entityType,
        externalId,
        rugby365Id,
        rugby365Name: typeof body.rugby365Name === "string" ? body.rugby365Name : undefined,
        confirmedBy: "admin",
        notes: typeof body.notes === "string" ? body.notes : undefined,
      });
      return NextResponse.json({ ok: true, mapping });
    }

    if (body.action === "ignore-mapping") {
      const entityType = body.entityType as MappingEntityType;
      const externalId = String(body.externalId ?? "");
      if (!entityType || !externalId) {
        return NextResponse.json({ ok: false, error: "entityType and externalId are required" }, { status: 400 });
      }
      const mapping = await ignoreRugbyDataMapping({
        entityType,
        externalId,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        userLabel: "admin",
      });
      return NextResponse.json({ ok: true, mapping });
    }

    const apiToken = typeof body.apiToken === "string" ? body.apiToken : undefined;
    const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl : undefined;
    const config = await saveRugbyDataApiCredentials({ apiToken, baseUrl });
    return NextResponse.json({ ok: true, ...config });
  } catch (e) {
    return apiErrorResponse(e, "Failed to save Rugby Data API settings");
  }
}
