/**
 * Player profile data-health grades for CMS / Phase gates.
 */

export type PlayerHealthArea =
  | "IDENTITY"
  | "CAREER"
  | "MATCHES"
  | "RATINGS"
  | "INTELLIGENCE"
  | "VALUE"
  | "POSITIONS"
  | "HONOURS"
  | "SOURCES";

export type PlayerHealthGrade = "COMPLETE" | "GOOD" | "PARTIAL" | "THIN" | "MISSING";

export type PlayerHealthRow = {
  area: PlayerHealthArea;
  grade: PlayerHealthGrade;
  note: string;
};

export type PlayerHealthSnapshot = {
  playerId: string;
  rows: PlayerHealthRow[];
  evaluatedAt: string;
};

export type PlayerHealthInput = {
  playerId: string;
  nameHasAccent: boolean;
  dobVerified: boolean;
  clubIsNotNation: boolean;
  clubTeamId: string | null;
  internationalTeamId: string | null;
  preferredFoot: string | null;
  contractVerified: boolean;
  membershipCount: number;
  transferCount: number;
  stintsLinked: number;
  stintsTotal: number;
  verifiedCaps: number | null;
  linkedCaps: number;
  verifiedPoints: number | null;
  linkedPoints: number | null;
  matchRatings: number;
  ratingSnapshots: number;
  intelligenceModel: string | null;
  overallRating: number | null;
  marketValueGbp: number | null;
  valueOutlier: boolean;
  honourCount: number;
  honourVerifiedCount: number;
  internationalPositionApps: number;
  clubPositionApps: number;
  hasPrimarySource: boolean;
};

function gradeCaps(verified: number | null, linked: number): PlayerHealthGrade {
  if (!verified || verified <= 0) return linked > 0 ? "PARTIAL" : "MISSING";
  const ratio = linked / verified;
  if (ratio >= 0.9) return "COMPLETE";
  if (ratio >= 0.6) return "GOOD";
  if (ratio >= 0.3) return "PARTIAL";
  if (linked > 0) return "THIN";
  return "MISSING";
}

export function evaluatePlayerDataHealth(input: PlayerHealthInput): PlayerHealthSnapshot {
  const rows: PlayerHealthRow[] = [];

  const identityBits = [
    input.nameHasAccent,
    input.dobVerified,
    input.clubIsNotNation && Boolean(input.clubTeamId),
    Boolean(input.internationalTeamId),
  ].filter(Boolean).length;
  rows.push({
    area: "IDENTITY",
    grade:
      identityBits === 4 && input.preferredFoot
        ? "COMPLETE"
        : identityBits >= 4
          ? "GOOD"
          : identityBits >= 3
            ? "PARTIAL"
            : "THIN",
    note: [
      input.nameHasAccent ? "display name ok" : "name accent missing",
      input.dobVerified ? "DOB verified" : "DOB unverified",
      input.clubIsNotNation ? "club ≠ nation" : "club/nation conflated",
      input.preferredFoot ? `foot=${input.preferredFoot}` : "preferred foot —",
      input.contractVerified ? "contract verified" : "contract unknown",
    ].join("; "),
  });

  const stintRatio =
    input.stintsTotal > 0 ? input.stintsLinked / input.stintsTotal : 0;
  rows.push({
    area: "CAREER",
    grade:
      input.membershipCount >= 4 && input.transferCount >= 3 && stintRatio >= 0.9
        ? "GOOD"
        : input.membershipCount > 0
          ? "PARTIAL"
          : "MISSING",
    note: `${input.membershipCount} memberships, ${input.transferCount} transfers, stints ${input.stintsLinked}/${input.stintsTotal}`,
  });

  rows.push({
    area: "MATCHES",
    grade: gradeCaps(input.verifiedCaps, input.linkedCaps),
    note: `linked caps ${input.linkedCaps}/${input.verifiedCaps ?? "?"} · points linked ${input.linkedPoints ?? "—"} / verified ${input.verifiedPoints ?? "—"}`,
  });

  rows.push({
    area: "RATINGS",
    grade:
      input.ratingSnapshots >= 15
        ? "GOOD"
        : input.matchRatings > 0
          ? "PARTIAL"
          : "MISSING",
    note: `${input.matchRatings} match ratings → ${input.ratingSnapshots} history snapshots`,
  });

  rows.push({
    area: "INTELLIGENCE",
    grade: input.intelligenceModel?.includes("fly-half")
      ? input.overallRating != null
        ? "GOOD"
        : "PARTIAL"
      : input.overallRating != null
        ? "THIN"
        : "MISSING",
    note: `${input.intelligenceModel ?? "no model"} · overall ${input.overallRating ?? "—"}`,
  });

  rows.push({
    area: "VALUE",
    grade: input.valueOutlier
      ? "THIN"
      : input.marketValueGbp != null && input.contractVerified
        ? "GOOD"
        : input.marketValueGbp != null
          ? "PARTIAL"
          : "MISSING",
    note: input.valueOutlier
      ? `£${input.marketValueGbp?.toLocaleString("en-GB") ?? "—"} — VALUE OUTLIER REVIEW`
      : `£${input.marketValueGbp?.toLocaleString("en-GB") ?? "—"}`,
  });

  rows.push({
    area: "POSITIONS",
    grade:
      input.internationalPositionApps >= 20 && input.clubPositionApps >= 10
        ? "GOOD"
        : input.internationalPositionApps > 0 && input.clubPositionApps === 0
          ? "THIN"
          : input.internationalPositionApps > 0
            ? "PARTIAL"
            : "MISSING",
    note: `intl apps ${input.internationalPositionApps}, club apps ${input.clubPositionApps} (club coverage thin → career % biased)`,
  });

  rows.push({
    area: "HONOURS",
    grade:
      input.honourVerifiedCount >= 2
        ? "GOOD"
        : input.honourCount > 0
          ? "PARTIAL"
          : "MISSING",
    note: `${input.honourCount} proposed · ${input.honourVerifiedCount} verified`,
  });

  rows.push({
    area: "SOURCES",
    grade: input.hasPrimarySource && input.dobVerified ? "GOOD" : "PARTIAL",
    note: input.hasPrimarySource
      ? "Wikipedia / RugbyPass provenance present"
      : "primary sources thin",
  });

  return {
    playerId: input.playerId,
    rows,
    evaluatedAt: new Date().toISOString(),
  };
}
