import { isInternationalCompetitionType } from "./player-profile-fields";
import { refereeClubFallback, refereeNationalityFallback } from "./competition-ranking-math";
import type { RefereeDashboardBio } from "./referee-dashboard-types";

const UNION_BY_NATION: Record<string, string> = {
  ireland: "IRFU",
  england: "RFU",
  wales: "WRU",
  scotland: "SRU",
  france: "FFR",
  "south africa": "SA Rugby",
  "new zealand": "New Zealand Rugby",
  australia: "Rugby Australia",
  georgia: "Georgia Rugby Union",
  italy: "FIR",
  argentina: "UAR",
  japan: "JRFU",
};

const OCCUPATION_BY_NAME: Record<string, string> = {
  "andrew brace": "Quantity surveyor",
  "wayne barnes": "Solicitor",
  "ben okeeffe": "Ophthalmologist",
  "luke pearce": "Teacher",
  "karl dickson": "Former Harlequins scrum-half",
  "nigel owens": "Former teacher",
  "glen jackson": "Former Bay of Plenty fly-half",
};

function personKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRefereeOccupation(notes: string | null | undefined): string | null {
  const match = notes?.match(/occupation:\s*(.+)/i);
  const value = match?.[1]?.split("\n")[0]?.trim();
  return value || null;
}

export function refereeOccupationFor(name: string, notes: string | null | undefined): string | null {
  return parseRefereeOccupation(notes) ?? OCCUPATION_BY_NAME[personKey(name)] ?? null;
}

export function refereeUnionFor(name: string, nation: string | null | undefined): string | null {
  const nationKey = (nation ?? "").trim().toLowerCase();
  if (nationKey && UNION_BY_NATION[nationKey]) return UNION_BY_NATION[nationKey]!;
  const clubs = refereeClubFallback(name);
  const exact = clubs?.clubs.find((club) =>
    /^(irfu|rfu|wru|sru|ffr|fir|uar|jrfu|sa rugby|new zealand rugby|rugby australia|georgia rugby union)$/i.test(
      club.trim(),
    ),
  );
  return exact ?? null;
}

export function refereeNationFor(
  name: string,
  countryName: string | null | undefined,
  nationality: string | null | undefined,
): string | null {
  return refereeNationalityFallback(name) ?? countryName ?? nationality ?? null;
}

export function isRefereeInternationalAppointment(
  competitionType: string | null | undefined,
  competitionName: string | null | undefined,
): boolean {
  if (isInternationalCompetitionType(competitionType)) return true;
  const name = (competitionName ?? "").toLowerCase();
  if (/\bunited rugby championship\b|\burc\b/.test(name)) return false;
  return /\bworld cup\b|\bsix nations\b|\b(?:the )?rugby championship\b|\btri[- ]nations\b|\bnations championship\b|\bautumn\b|\bend of year\b|\binternation/.test(
    name,
  );
}

export function isRefereeTestAppointment(
  competitionType: string | null | undefined,
  competitionName: string | null | undefined,
): boolean {
  const name = (competitionName ?? "").toLowerCase();
  if (/u-?20|under[- ]?20|sevens|women|\bunited rugby championship\b|\burc\b/.test(name)) return false;
  if (competitionType === "world_cup") return true;
  return /\bworld cup\b|\bsix nations\b|\b(?:the )?rugby championship\b|\btri[- ]nations\b|\bnations championship\b/.test(
    name,
  );
}

export function ratingToHundred(rating: number | null | undefined): number | null {
  if (rating == null || !Number.isFinite(rating)) return null;
  const scaled = rating > 10 ? rating : rating * 10;
  return Math.round(Math.min(99, Math.max(0, scaled)) * 10) / 10;
}

export function emptyRefereeBio(): RefereeDashboardBio {
  return {
    nationality: "—",
    dateOfBirth: "—",
    worldRugbyDebut: "—",
    refereeStyle: "Communication · Consistency · Control",
    preferredRole: "Centre referee",
    union: "—",
    profession: "—",
  };
}
