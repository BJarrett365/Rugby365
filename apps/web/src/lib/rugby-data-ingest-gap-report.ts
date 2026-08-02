import { sql } from "drizzle-orm";
import { getDb } from "./db";
import { buildRugbyDataImportCoverageReport } from "./rugby-data-match-import-service";
import {
  RUGBY_DATA_FEED_ENDPOINTS,
  RUGBY_DATA_FEED_FIELDS,
  summarizeFeedCatalog,
  type FeedEndpointSpec,
  type FeedFieldSpec,
  type IngestDisposition,
} from "./rugby-data-feed-catalog";
import { PROVIDER_RUGBY_DATA } from "./provider-mapping-types";

export type RugbyDataIngestGapReport = {
  generatedAt: string;
  summary: {
    catalog: ReturnType<typeof summarizeFeedCatalog>;
    rawResponses: {
      total: number;
      byEntityType: Record<string, number>;
      byImportStatus: Record<string, number>;
    };
    structured: Awaited<ReturnType<typeof buildRugbyDataImportCoverageReport>>;
  };
  notIngested: {
    endpoints: Array<FeedEndpointSpec & { whyNotIngested: string }>;
    fields: Array<FeedFieldSpec & { whyNotIngested: string }>;
  };
  dispositionLegend: Record<IngestDisposition, string>;
};

const DISPOSITION_LEGEND: Record<IngestDisposition, string> = {
  ingested: "Fully mapped into CMS tables by the import/enrich pipeline.",
  partial: "Some fields ingested; others remain in raw payload or extras jsonb only.",
  raw_only: "Pulled into provider_raw_responses but no structured importer writes to CMS tables.",
  not_pulled: "Endpoint not yet called by pull/import jobs.",
  not_in_feed: "Data does not exist in Rugby Data API responses.",
  out_of_scope: "Explicitly excluded from project scope (e.g. FCM favourites).",
  blocked_by_policy: "Ingest blocked by mapping rules, field locks, or SDMS-primary policy.",
};

function whyNotIngested(disposition: IngestDisposition, reason: string): string {
  return `${DISPOSITION_LEGEND[disposition]} ${reason}`.trim();
}

async function countRawResponses() {
  const db = getDb();
  const [totalRow] = await db.execute(sql`
    select count(*)::int as total from provider_raw_responses where provider = ${PROVIDER_RUGBY_DATA}
  `);
  const entityRows = await db.execute(sql`
    select coalesce(entity_type, 'unknown') as entity_type, count(*)::int as cnt
    from provider_raw_responses
    where provider = ${PROVIDER_RUGBY_DATA}
    group by entity_type
  `);
  const statusRows = await db.execute(sql`
    select import_status, count(*)::int as cnt
    from provider_raw_responses
    where provider = ${PROVIDER_RUGBY_DATA}
    group by import_status
  `);

  const total = Number((Array.isArray(totalRow) ? totalRow[0] : totalRow)?.total ?? 0);
  const byEntityType: Record<string, number> = {};
  for (const row of (Array.isArray(entityRows) ? entityRows : [entityRows]) as Array<{
    entity_type: string;
    cnt: number;
  }>) {
    if (row?.entity_type) byEntityType[row.entity_type] = Number(row.cnt);
  }
  const byImportStatus: Record<string, number> = {};
  for (const row of (Array.isArray(statusRows) ? statusRows : [statusRows]) as Array<{
    import_status: string;
    cnt: number;
  }>) {
    if (row?.import_status) byImportStatus[row.import_status] = Number(row.cnt);
  }

  return { total, byEntityType, byImportStatus };
}

export async function buildRugbyDataIngestGapReport(): Promise<RugbyDataIngestGapReport> {
  const structured = await buildRugbyDataImportCoverageReport();
  const rawResponses = await countRawResponses();

  const notIngestedEndpoints = RUGBY_DATA_FEED_ENDPOINTS.filter(
    (row) => row.disposition !== "ingested",
  ).map((row) => ({
    ...row,
    whyNotIngested: whyNotIngested(row.disposition, row.reason),
  }));

  const notIngestedFields = RUGBY_DATA_FEED_FIELDS.map((row) => ({
    ...row,
    whyNotIngested: whyNotIngested(row.disposition, row.reason),
  }));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      catalog: summarizeFeedCatalog(),
      rawResponses,
      structured,
    },
    notIngested: {
      endpoints: notIngestedEndpoints,
      fields: notIngestedFields,
    },
    dispositionLegend: DISPOSITION_LEGEND,
  };
}

export function formatIngestGapReportMarkdown(report: RugbyDataIngestGapReport): string {
  const lines: string[] = [
    "# Rugby Data API — ingest gap report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "## Pull vs ingest",
    "",
    "| Layer | Count |",
    "|-------|-------|",
    `| Raw API responses in DB | ${report.summary.rawResponses.total} |`,
    `| Confirmed provider mappings | ${report.summary.structured.confirmedMappings} |`,
    `| Fixtures with external match id | ${report.summary.structured.fixturesWithExternalId} |`,
    `| Fixture players | ${report.summary.structured.fixturePlayers} |`,
    `| Rugby Data team match stats | ${report.summary.structured.rugbyDataTeamStats} |`,
    `| Rugby Data player match stats | ${report.summary.structured.rugbyDataPlayerStats} |`,
    `| Rugby Data match events | ${report.summary.structured.rugbyDataEvents} |`,
    "",
    "## Endpoints not fully ingested",
    "",
  ];

  for (const row of report.notIngested.endpoints) {
    lines.push(`### ${row.method} ${row.path}`);
    lines.push(`- **Disposition:** ${row.disposition}`);
    lines.push(`- **Target tables:** ${row.targetTables.length ? row.targetTables.join(", ") : "none"}`);
    lines.push(`- **Why:** ${row.whyNotIngested}`);
    lines.push("");
  }

  lines.push("## Fields not fully ingested");
  lines.push("");
  for (const row of report.notIngested.fields) {
    lines.push(`- **${row.feedId}** \`${row.field}\` (${row.disposition})`);
    lines.push(`  - ${row.whyNotIngested}`);
  }

  lines.push("");
  lines.push("## Disposition legend");
  lines.push("");
  for (const [key, value] of Object.entries(report.dispositionLegend)) {
    lines.push(`- **${key}:** ${value}`);
  }

  return lines.join("\n");
}
