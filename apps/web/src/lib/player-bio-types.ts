export type PlayerBioType = "domestic" | "international" | "scouting" | "weekly_intro";

export type PlayerBioSuggestionStatus = "draft" | "pending" | "approved" | "rejected";

export type PlayerAgeProfile = "development" | "emerging" | "prime" | "veteran";

export type PlayerBioSections = {
  shortIntro: string;
  fullBio: string;
  playingStyle: string;
  strengths: string;
  areasToImprove: string;
  careerSummary: string;
  internationalSummary: string;
  currentSeasonSummary: string;
  scoutingSummary: string;
  ratingExplanation: string;
  legendSummary: string;
};

export type PlayerProfileBioType = "domestic" | "international" | "scouting";

export const PLAYER_PROFILE_BIO_TYPES: PlayerProfileBioType[] = [
  "domestic",
  "international",
  "scouting",
];

export type PlayerBioVariants = Record<PlayerProfileBioType, PlayerBioSections>;

export type PlayerRatingBadge = {
  key: string;
  label: string;
  description: string;
};

export type PlayerRatingSnapshot = {
  playerRating: number | null;
  displayRating: number | null;
  calculatedRating: number | null;
  currentAbility: number | null;
  formScore: number | null;
  teamImportance: number | null;
  potential: number | null;
  reputation: number | null;
  attackRating: number | null;
  defenceRating: number | null;
  disciplineRating: number | null;
  ageProfile: PlayerAgeProfile | null;
  ratingConfidence: number | null;
  ratingExplanation: string | null;
  seasonRating: number | null;
  careerHigh: number | null;
  careerLow: number | null;
  formMovement: number | null;
  ratingMovement: number | null;
  lastFiveMatchRatings: number[];
  badges: PlayerRatingBadge[];
  manualOverrideRating: number | null;
  manualOverrideReason: string | null;
  dataPoints: number;
};

export type PlayerBioPacket = {
  playerId: string;
  name: string;
  fullName: string | null;
  birthDate: string | null;
  age: number | null;
  nationality: string | null;
  nationCode: string | null;
  heightCm: number | null;
  weightKg: number | null;
  position: string | null;
  currentClub: string | null;
  internationalTeam: string | null;
  isInternational: boolean;
  previousClubs: string[];
  transferHistory: Array<{
    fromClub: string | null;
    toClub: string | null;
    movementType: string;
    effectiveDate: string | null;
    seasonLabel: string | null;
  }>;
  careerStints: Array<{
    teamName: string;
    yearsLabel: string;
    apps: number | null;
    points: number | null;
    careerType: string;
  }>;
  recentMatches: Array<{
    fixtureSlug: string;
    kickoffAt: string | null;
    teamName: string;
    opponentName: string | null;
    competitionName: string | null;
    tries: number;
    points: number;
    minutesPlayed: number;
  }>;
  seasonStats: Array<{
    seasonLabel: string;
    competitionName: string;
    teamName: string;
    appearances: number;
    tries: number;
    points: number;
    carries: number;
    metresCarried: number;
    tacklesCompleted: number;
    attackRank: number | null;
    defenceRank: number | null;
  }>;
  scoringStats: {
    tries: number;
    conversions: number;
    penalties: number;
    dropGoals: number;
    points: number;
  };
  rating: PlayerRatingSnapshot;
  availability: {
    currentStatus: string;
    isUnavailable: boolean;
    unavailableReason: string | null;
    returningPlayer: boolean;
    totalMatchesMissed: number;
    expectedReturnDate: string | null;
    currentInjuryType: string | null;
    currentSuspensionOffence: string | null;
    injuryHistoryCount: number;
    suspensionHistoryCount: number;
  };
  legends: Array<{
    level: string;
    reason: string | null;
    careerSummary: string | null;
  }>;
  sourceUrls: Array<{ label: string; url: string }>;
  confidenceScore: number;
  missingFields: Array<{ field: string; label: string; importance: "high" | "medium" | "low" }>;
  conflicts: Array<{
    field: string;
    label: string;
    values: Array<{ source: string; value: string | number | null }>;
  }>;
  generatedAt: string;
};

export type BioRefreshTrigger =
  | "match_stats_imported"
  | "transfer_added"
  | "club_changed"
  | "international_status_changed"
  | "rating_changed"
  | "badge_added"
  | "age_band_changed"
  | "injury_confirmed"
  | "injury_return_updated"
  | "player_returned_to_training"
  | "player_returned_to_selection"
  | "suspension_began"
  | "suspension_ended"
  | "weekly_refresh"
  | "manual";

export type BioVerificationReport = {
  sourceFieldsUsed: string[];
  sourceUrls: Array<{ label: string; url: string }>;
  missingFields: PlayerBioPacket["missingFields"];
  conflictingFields: PlayerBioPacket["conflicts"];
  confidenceScore: number;
  suggestedEditorAction: string;
  summary: string;
};

export const EMPTY_BIO_SECTIONS: PlayerBioSections = {
  shortIntro: "",
  fullBio: "",
  playingStyle: "",
  strengths: "",
  areasToImprove: "",
  careerSummary: "",
  internationalSummary: "",
  currentSeasonSummary: "",
  scoutingSummary: "",
  ratingExplanation: "",
  legendSummary: "",
};

export function emptyBioVariants(): PlayerBioVariants {
  return {
    domestic: { ...EMPTY_BIO_SECTIONS },
    international: { ...EMPTY_BIO_SECTIONS },
    scouting: { ...EMPTY_BIO_SECTIONS },
  };
}
