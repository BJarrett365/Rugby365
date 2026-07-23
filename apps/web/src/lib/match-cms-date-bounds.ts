/**
 * Timezone-aware calendar day bounds for Matches CMS filters.
 * Default system TZ: Europe/London (matches fixtures schedule API).
 */

import {
  DEFAULT_FIXTURES_TIMEZONE,
  utcInstantFromZonedWallClock,
} from "@rugby365/import-sdk";
import { addDaysToDateKey } from "./match-schedule-utils";

export const MATCH_CMS_DEFAULT_TIMEZONE = DEFAULT_FIXTURES_TIMEZONE;

/** Format a Date as YYYY-MM-DD in the given IANA timezone. */
export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) throw new Error("Failed to format date key");
  return `${y}-${m}-${d}`;
}

/**
 * Half-open UTC interval [start, endExclusive) covering the local calendar day
 * `dateKey` (YYYY-MM-DD) in `timeZone`.
 */
export function dayBoundsInTimeZone(
  dateKey: string,
  timeZone: string = MATCH_CMS_DEFAULT_TIMEZONE,
): { start: Date; endExclusive: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  const start = utcInstantFromZonedWallClock(dateKey, "00:00:00", timeZone);
  const endExclusive = utcInstantFromZonedWallClock(
    addDaysToDateKey(dateKey, 1),
    "00:00:00",
    timeZone,
  );
  return { start, endExclusive };
}

export function utcDayBoundsFromDateKeys(input: {
  fromDate: string;
  toDate: string;
  timeZone?: string;
}): { start: Date; endExclusive: Date } {
  const timeZone = input.timeZone ?? MATCH_CMS_DEFAULT_TIMEZONE;
  const from = dayBoundsInTimeZone(input.fromDate, timeZone);
  const to = dayBoundsInTimeZone(input.toDate, timeZone);
  if (from.start >= to.endExclusive) {
    throw new Error("Invalid date range: From Date is after To Date");
  }
  return { start: from.start, endExclusive: to.endExclusive };
}

/** True when CMS list filters include a date range (competition is optional = all games). */
export function hasRequiredMatchCmsFilters(filters: {
  fromDate?: string | null;
  toDate?: string | null;
  competitionId?: string | null;
}): boolean {
  return Boolean(filters.fromDate?.trim() && filters.toDate?.trim());
}
