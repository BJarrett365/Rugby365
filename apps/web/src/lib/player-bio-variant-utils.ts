import {
  EMPTY_BIO_SECTIONS,
  type PlayerBioSections,
  type PlayerBioType,
  type PlayerBioVariants,
  type PlayerProfileBioType,
} from "./player-bio-types";

export function isProfileBioType(bioType: PlayerBioType): bioType is PlayerProfileBioType {
  return bioType === "domestic" || bioType === "international" || bioType === "scouting";
}

export function parseBioSectionsRecord(value: unknown): PlayerBioSections {
  if (!value || typeof value !== "object") return { ...EMPTY_BIO_SECTIONS };
  const raw = value as Record<string, unknown>;
  return {
    shortIntro: stringField(raw.shortIntro),
    fullBio: stringField(raw.fullBio),
    playingStyle: stringField(raw.playingStyle),
    strengths: stringField(raw.strengths),
    areasToImprove: stringField(raw.areasToImprove),
    careerSummary: stringField(raw.careerSummary),
    internationalSummary: stringField(raw.internationalSummary),
    currentSeasonSummary: stringField(raw.currentSeasonSummary),
    scoutingSummary: stringField(raw.scoutingSummary),
    ratingExplanation: stringField(raw.ratingExplanation),
    legendSummary: stringField(raw.legendSummary),
  };
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readBioVariants(profile: {
  domesticSections?: unknown;
  internationalSections?: unknown;
  scoutingSections?: unknown;
  shortIntro?: string | null;
  fullBio?: string | null;
  playingStyle?: string | null;
  strengths?: string | null;
  areasToImprove?: string | null;
  careerSummary?: string | null;
  internationalSummary?: string | null;
  currentSeasonSummary?: string | null;
  scoutingSummary?: string | null;
  ratingExplanation?: string | null;
  legendSummary?: string | null;
} | null | undefined): PlayerBioVariants {
  if (!profile) {
    return {
      domestic: { ...EMPTY_BIO_SECTIONS },
      international: { ...EMPTY_BIO_SECTIONS },
      scouting: { ...EMPTY_BIO_SECTIONS },
    };
  }

  const domestic = parseBioSectionsRecord(profile.domesticSections);
  const international = parseBioSectionsRecord(profile.internationalSections);
  const scouting = parseBioSectionsRecord(profile.scoutingSections);

  const legacyFlat = {
    shortIntro: profile.shortIntro ?? "",
    fullBio: profile.fullBio ?? "",
    playingStyle: profile.playingStyle ?? "",
    strengths: profile.strengths ?? "",
    areasToImprove: profile.areasToImprove ?? "",
    careerSummary: profile.careerSummary ?? "",
    internationalSummary: profile.internationalSummary ?? "",
    currentSeasonSummary: profile.currentSeasonSummary ?? "",
    scoutingSummary: profile.scoutingSummary ?? "",
    ratingExplanation: profile.ratingExplanation ?? "",
    legendSummary: profile.legendSummary ?? "",
  };

  return {
    domestic: hasAnyContent(domestic) ? domestic : pickDomesticFromLegacy(legacyFlat),
    international: hasAnyContent(international)
      ? international
      : pickInternationalFromLegacy(legacyFlat),
    scouting: hasAnyContent(scouting) ? scouting : pickScoutingFromLegacy(legacyFlat),
  };
}

function hasAnyContent(sections: PlayerBioSections): boolean {
  return Object.values(sections).some((value) => value.trim());
}

function pickDomesticFromLegacy(legacy: PlayerBioSections): PlayerBioSections {
  return {
    ...EMPTY_BIO_SECTIONS,
    shortIntro: legacy.shortIntro,
    fullBio: legacy.fullBio,
    playingStyle: legacy.playingStyle,
    strengths: legacy.strengths,
    areasToImprove: legacy.areasToImprove,
    careerSummary: legacy.careerSummary,
    currentSeasonSummary: legacy.currentSeasonSummary,
    legendSummary: legacy.legendSummary,
  };
}

function pickInternationalFromLegacy(legacy: PlayerBioSections): PlayerBioSections {
  return {
    ...EMPTY_BIO_SECTIONS,
    shortIntro: legacy.internationalSummary ? legacy.shortIntro : "",
    fullBio: legacy.internationalSummary || legacy.fullBio,
    internationalSummary: legacy.internationalSummary,
    careerSummary: legacy.careerSummary,
    strengths: legacy.strengths,
    playingStyle: legacy.playingStyle,
  };
}

function pickScoutingFromLegacy(legacy: PlayerBioSections): PlayerBioSections {
  return {
    ...EMPTY_BIO_SECTIONS,
    scoutingSummary: legacy.scoutingSummary,
    playingStyle: legacy.playingStyle,
    strengths: legacy.strengths,
    areasToImprove: legacy.areasToImprove,
    ratingExplanation: legacy.ratingExplanation,
    currentSeasonSummary: legacy.currentSeasonSummary,
  };
}

export function composeFlatBioProfile(variants: PlayerBioVariants): PlayerBioSections {
  const { domestic, international, scouting } = variants;
  return {
    shortIntro: domestic.shortIntro || international.shortIntro || scouting.shortIntro,
    fullBio: domestic.fullBio || international.fullBio || scouting.fullBio,
    playingStyle: domestic.playingStyle || scouting.playingStyle || international.playingStyle,
    strengths: domestic.strengths || scouting.strengths || international.strengths,
    areasToImprove: domestic.areasToImprove || scouting.areasToImprove,
    careerSummary: domestic.careerSummary || international.careerSummary,
    internationalSummary: international.internationalSummary || international.fullBio,
    currentSeasonSummary: domestic.currentSeasonSummary || scouting.currentSeasonSummary,
    scoutingSummary: scouting.scoutingSummary || scouting.fullBio,
    ratingExplanation: scouting.ratingExplanation || domestic.ratingExplanation,
    legendSummary: domestic.legendSummary || international.legendSummary,
  };
}

export function primaryBioSummary(variants: PlayerBioVariants, isInternational: boolean): string | null {
  const domestic = variants.domestic.shortIntro || variants.domestic.fullBio;
  const international =
    variants.international.internationalSummary ||
    variants.international.fullBio ||
    variants.international.shortIntro;
  const scouting = variants.scouting.scoutingSummary || variants.scouting.fullBio;
  const summary = isInternational
    ? international || domestic || scouting
    : domestic || scouting || international;
  return summary.trim() || null;
}

export function sectionsForBioTab(bioType: PlayerProfileBioType): Array<keyof PlayerBioSections> {
  switch (bioType) {
    case "domestic":
      return [
        "shortIntro",
        "fullBio",
        "playingStyle",
        "strengths",
        "areasToImprove",
        "careerSummary",
        "currentSeasonSummary",
        "legendSummary",
      ];
    case "international":
      return [
        "shortIntro",
        "fullBio",
        "internationalSummary",
        "careerSummary",
        "playingStyle",
        "strengths",
      ];
    case "scouting":
      return [
        "scoutingSummary",
        "fullBio",
        "playingStyle",
        "strengths",
        "areasToImprove",
        "currentSeasonSummary",
        "ratingExplanation",
      ];
  }
}

export const BIO_TAB_LABELS: Record<PlayerProfileBioType, string> = {
  domestic: "Club bio",
  international: "International bio",
  scouting: "Scout bio",
};

export function bioTypesForRefresh(input: {
  trigger: import("./player-bio-types").BioRefreshTrigger;
  shouldRefresh: boolean;
  clubChanged: boolean;
  positionChanged: boolean;
  internationalChanged: boolean;
  ratingChanged: boolean;
  formChanged: boolean;
  badgeAdded: boolean;
  ageProfileChanged: boolean;
  isInternational: boolean;
  initial: boolean;
}): PlayerProfileBioType[] {
  if (!input.shouldRefresh) return [];

  if (input.trigger === "weekly_refresh") {
    return ["domestic", "international", "scouting"];
  }

  const types = new Set<PlayerProfileBioType>();

  if (input.initial) {
    types.add("domestic");
    types.add("scouting");
    if (input.isInternational) types.add("international");
    return [...types];
  }

  if (
    input.clubChanged ||
    input.positionChanged ||
    input.trigger === "transfer_added" ||
    input.trigger === "club_changed"
  ) {
    types.add("domestic");
  }

  if (input.trigger === "match_stats_imported") {
    types.add("domestic");
    types.add("scouting");
  }

  if (
    input.trigger === "injury_confirmed" ||
    input.trigger === "injury_return_updated" ||
    input.trigger === "player_returned_to_training" ||
    input.trigger === "player_returned_to_selection" ||
    input.trigger === "suspension_began" ||
    input.trigger === "suspension_ended"
  ) {
    types.add("domestic");
    types.add("scouting");
    if (input.isInternational) types.add("international");
  }

  if (input.internationalChanged || input.trigger === "international_status_changed") {
    types.add("international");
    types.add("domestic");
  }

  if (
    input.ratingChanged ||
    input.formChanged ||
    input.badgeAdded ||
    input.ageProfileChanged ||
    input.trigger === "rating_changed" ||
    input.trigger === "badge_added" ||
    input.trigger === "age_band_changed"
  ) {
    types.add("scouting");
    types.add("domestic");
  }

  if (input.trigger === "manual" && types.size === 0) {
    types.add(input.isInternational ? "international" : "domestic");
  }

  if (types.size === 0) types.add("domestic");
  return [...types];
}
