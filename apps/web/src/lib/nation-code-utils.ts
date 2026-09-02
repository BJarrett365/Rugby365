import { teamNameFromCode } from "@rugby365/import-sdk";

/** ISO/rugby codes that mean "unknown", not a real rugby nation (UN = United Nations flag). */
const PLACEHOLDER_NATION_CODES = new Set([
  "UN",
  "XX",
  "ZZ",
  "UU",
  "EU",
  "AA",
  "UKN",
  "UNK",
  "N/A",
  "NA/",
  "--",
  "??",
]);

const ISO2_TO_RUGBY_COUNTRY: Record<string, string> = {
  za: "South Africa",
  nz: "New Zealand",
  au: "Australia",
  ie: "Ireland",
  fr: "France",
  it: "Italy",
  ar: "Argentina",
  jp: "Japan",
  fj: "Fiji",
  ws: "Samoa",
  to: "Tonga",
  us: "United States",
  ca: "Canada",
  ge: "Georgia",
  pt: "Portugal",
  ro: "Romania",
  uy: "Uruguay",
  cl: "Chile",
  na: "Namibia",
  zw: "Zimbabwe",
  es: "Spain",
  hk: "Hong Kong",
  ci: "Ivory Coast",
  ru: "Russia",
  ma: "Morocco",
  kr: "South Korea",
  nl: "Netherlands",
  be: "Belgium",
  de: "Germany",
  ke: "Kenya",
};

export function isPlaceholderNationCode(code: string | null | undefined): boolean {
  if (!code?.trim()) return true;
  return PLACEHOLDER_NATION_CODES.has(code.trim().toUpperCase());
}

export function isPlaceholderNationLabel(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  if (isPlaceholderNationCode(value)) return true;
  return /^(unknown|n\/a|none|null|tbc|tba|not known)$/i.test(value.trim());
}

/** Map stored nation_code (ENG, ZA, GB-ENG) to a country name for public display. */
export function countryNameFromNationCode(code: string | null | undefined): string | null {
  if (!code?.trim() || isPlaceholderNationCode(code)) return null;
  const upper = code.trim().toUpperCase();
  const fromRugby = teamNameFromCode(upper);
  if (fromRugby) return fromRugby;
  if (/^(GB-ENG|EN)$/i.test(upper)) return "England";
  if (/^GB-SCT$/i.test(upper)) return "Scotland";
  if (/^GB-WLS$/i.test(upper)) return "Wales";
  if (/^GB-NIR$/i.test(upper)) return "Ireland";
  if (upper === "TGA") return "Tonga";
  return ISO2_TO_RUGBY_COUNTRY[upper.toLowerCase()] ?? null;
}
