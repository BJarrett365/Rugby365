/** Client-safe date helpers for Table Lab view URL state (no DB imports). */

export function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseAsOfDateParam(value: string | null | undefined): string {
  if (!value) return formatDateOnly(new Date());
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return formatDateOnly(new Date());
  return formatDateOnly(parsed);
}

export function parseDateOnlyParam(value: string | null | undefined, fallback: string): string {
  if (!value?.trim()) return fallback;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return formatDateOnly(parsed);
}

export function defaultBetweenDatesRange(): { startDate: string; endDate: string } {
  const endDate = formatDateOnly(new Date());
  const startDate = `${new Date().getUTCFullYear()}-01-01`;
  return { startDate, endDate };
}

export function endOfDateUtc(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!, 23, 59, 59, 999));
}

export function startOfDateUtc(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!, 0, 0, 0, 0));
}

export function shiftDateOnly(dateOnly: string, days: number): string {
  const date = endOfDateUtc(dateOnly);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

export function formatAsOfDateLabel(dateOnly: string): string {
  const date = endOfDateUtc(dateOnly);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function tableOnDateCalculationNote(dateOnly: string): string {
  return `Table calculated from all completed matches up to and including ${formatAsOfDateLabel(dateOnly)}.`;
}
