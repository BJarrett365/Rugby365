import type { RugbyPassPlayerProfile } from "@rugby365/import-sdk";
import { approximateBirthDateFromAge } from "@rugby365/import-sdk";

export type PlayerEnrichmentRow = {
  id: string;
  name: string;
  fullName?: string | null;
  birthDate?: string | Date | null;
  birthPlace?: string | null;
  positionName?: string | null;
  clubName?: string | null;
  clubTeamId?: string | null;
  countryName?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  imageUrl?: string | null;
  bioSummary?: string | null;
  rugbypassSlug?: string | null;
  rugbypassUrl?: string | null;
  rugbypassPlayerId?: string | null;
  rugbypassSyncedAt?: Date | null;
  sourceProvider?: string | null;
};

export type RugbyPassEnrichmentPatch = {
  fullName?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  positionName?: string | null;
  clubName?: string | null;
  countryName?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  imageUrl?: string | null;
  bioSummary?: string | null;
  rugbypassSlug: string;
  rugbypassUrl: string;
  rugbypassPlayerId: string | null;
  rugbypassSyncedAt: Date;
};

export function namesLikelyMatch(playerName: string, sourceName: string): boolean {
  const a = playerName.trim().toLowerCase();
  const b = sourceName.trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  if (b.includes(a) || a.includes(b)) return true;
  const aParts = a.split(/\s+/);
  const bParts = b.split(/\s+/);
  const aLast = aParts.at(-1);
  const bLast = bParts.at(-1);
  const aFirst = aParts[0];
  const bFirst = bParts[0];
  return Boolean(aLast && bLast && aLast === bLast && aFirst && bFirst && aFirst[0] === bFirst[0]);
}

function pickString(existing: string | null | undefined, incoming: string | null | undefined) {
  const current = existing?.trim();
  if (current) return undefined;
  const next = incoming?.trim();
  return next || undefined;
}

function pickNumber(existing: number | null | undefined, incoming: number | null | undefined) {
  if (existing != null && existing > 0) return undefined;
  if (incoming != null && incoming > 0) return incoming;
  return undefined;
}

export function mergeRugbyPassEnrichment(
  existing: PlayerEnrichmentRow,
  profile: RugbyPassPlayerProfile,
): RugbyPassEnrichmentPatch {
  const birthDate =
    existing.birthDate != null
      ? undefined
      : profile.birthDate ??
        (profile.age != null ? approximateBirthDateFromAge(profile.age) : undefined);

  const patch: RugbyPassEnrichmentPatch = {
    rugbypassSlug: profile.slug,
    rugbypassUrl: profile.sourceUrl,
    rugbypassPlayerId: profile.rugbypassPlayerId,
    rugbypassSyncedAt: new Date(),
  };

  const fullName = pickString(existing.fullName ?? null, profile.fullName);
  if (fullName) patch.fullName = fullName;
  if (birthDate) patch.birthDate = birthDate;
  const birthPlace = pickString(existing.birthPlace ?? null, profile.birthPlace);
  if (birthPlace) patch.birthPlace = birthPlace;
  const positionName = pickString(existing.positionName ?? null, profile.position);
  if (positionName) patch.positionName = positionName;
  const clubName = pickString(existing.clubName ?? null, profile.currentTeam);
  if (clubName) patch.clubName = clubName;
  const countryName = pickString(existing.countryName ?? null, profile.nationality);
  if (countryName) patch.countryName = countryName;
  const heightCm = pickNumber(existing.heightCm ?? null, profile.heightCm);
  if (heightCm != null) patch.heightCm = heightCm;
  const weightKg = pickNumber(existing.weightKg ?? null, profile.weightKg);
  if (weightKg != null) patch.weightKg = weightKg;
  // Player images come from our dedicated image API — never overwrite from RugbyPass.
  const bioSummary = pickString(existing.bioSummary ?? null, profile.bioSummary);
  if (bioSummary) patch.bioSummary = bioSummary;

  return patch;
}

export function enrichmentFieldsUpdated(
  existing: PlayerEnrichmentRow,
  patch: RugbyPassEnrichmentPatch,
): string[] {
  const fields: string[] = ["rugbypassSlug", "rugbypassUrl", "rugbypassSyncedAt"];
  if (patch.rugbypassPlayerId && patch.rugbypassPlayerId !== existing.rugbypassPlayerId) {
    fields.push("rugbypassPlayerId");
  }
  for (const key of [
    "fullName",
    "birthDate",
    "birthPlace",
    "positionName",
    "clubName",
    "countryName",
    "heightCm",
    "weightKg",
    "bioSummary",
  ] as const) {
    if (patch[key] !== undefined && patch[key] !== existing[key]) fields.push(key);
  }
  return fields;
}
