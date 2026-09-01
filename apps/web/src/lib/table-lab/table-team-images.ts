import { inArray } from "drizzle-orm";
import { teams } from "@rugby365/db";
import { getDb } from "../db";
import { countryNameToIsoCode } from "../open-meteo-service";
import { flagUrlForVenue, venueFlagIso } from "../public-venue-product-math";
import type { RugbyTableResult, RugbyTableStandingRow } from "./table-types";

function nationFlagUrl(teamName: string | null | undefined): string | null {
  const name = teamName?.trim();
  if (!name) return null;
  const fromName = venueFlagIso(name);
  if (fromName) return flagUrlForVenue(fromName);
  if (/ivory coast|c[oô]te d.?ivoire/i.test(name)) return flagUrlForVenue("ci");
  const iso = countryNameToIsoCode(name)?.toLowerCase();
  return iso ? flagUrlForVenue(iso) : null;
}

function applyImages(
  rows: RugbyTableStandingRow[],
  imageById: Map<string, string | null>,
): RugbyTableStandingRow[] {
  return rows.map((row) => ({
    ...row,
    teamImageUrl:
      row.teamImageUrl ||
      imageById.get(row.teamId) ||
      nationFlagUrl(row.teamName) ||
      null,
  }));
}

/** Attach club crests / nation flags to live-table rows. */
export async function attachTeamImagesToTableResult(
  result: RugbyTableResult,
): Promise<RugbyTableResult> {
  const ids = [
    ...new Set(
      [
        ...result.rows.map((row) => row.teamId),
        ...(result.poolGroups ?? []).flatMap((group) => group.rows.map((row) => row.teamId)),
        ...(result.hemisphereGroups ?? []).flatMap((group) => group.rows.map((row) => row.teamId)),
      ].filter((id) => Boolean(id) && !id.startsWith("rwc-pool-placeholder:")),
    ),
  ];
  const imageById = new Map<string, string | null>();
  if (ids.length) {
    const teamRows = await getDb()
      .select({ id: teams.id, imageUrl: teams.imageUrl })
      .from(teams)
      .where(inArray(teams.id, ids));
    for (const row of teamRows) imageById.set(row.id, row.imageUrl ?? null);
  }

  return {
    ...result,
    rows: applyImages(result.rows, imageById),
    poolGroups: result.poolGroups?.map((group) => ({
      ...group,
      rows: applyImages(group.rows, imageById),
    })),
    hemisphereGroups: result.hemisphereGroups?.map((group) => ({
      ...group,
      rows: applyImages(group.rows, imageById),
    })),
  };
}
