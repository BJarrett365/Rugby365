/** Shared helpers for public team / coach / referee profile pages. */

export function isPreviewParam(value: string | string[] | undefined | null): boolean {
  if (value == null) return false;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "1" || raw === "true";
}

export function formatPublicDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatPublicKickoff(iso: string | null | undefined): string {
  if (!iso) return "TBC";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBC";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
