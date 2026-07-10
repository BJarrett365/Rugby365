export type PersonRoleType = "player" | "coach" | "referee";

export type PersonBioType =
  | "coach_short_bio"
  | "coach_full_profile"
  | "coach_career_summary"
  | "coach_rating_explanation"
  | "referee_short_bio"
  | "referee_full_profile"
  | "referee_appointment_summary"
  | "referee_experience_profile";

export type PersonBioSections = {
  shortIntro: string;
  fullBio: string;
  careerSummary: string;
  ratingExplanation: string;
  appointmentSummary: string;
  experienceProfile: string;
};

export const EMPTY_PERSON_BIO_SECTIONS: PersonBioSections = {
  shortIntro: "",
  fullBio: "",
  careerSummary: "",
  ratingExplanation: "",
  appointmentSummary: "",
  experienceProfile: "",
};

export type PersonIntelligenceScore = {
  overallScore: number | null;
  displayScore: number | null;
  calculatedScore: number | null;
  supportingScores: Record<string, number | null>;
  explanation: string;
  confidenceScore: number;
  formulaVersion: string;
  manualOverrideRating: number | null;
  manualOverrideReason: string | null;
  careerHigh: number | null;
  careerLow: number | null;
  scoreMovement: number | null;
};

export type PersonSourceField = {
  field: string;
  label: string;
  importance: "high" | "medium" | "low";
};

export type PersonIntelligencePacket = {
  personId: string;
  roleType: PersonRoleType;
  roleEntityId: string;
  name: string;
  birthDate: string | null;
  age: number | null;
  nationality: string | null;
  birthPlace: string | null;
  currentRole: string | null;
  currentOrganisation: string | null;
  imageUrl: string | null;
  bioSummary: string | null;
  sourceUrls: Array<{ label: string; url: string }>;
  score: PersonIntelligenceScore;
  roleContext: Record<string, unknown>;
  missingFields: PersonSourceField[];
  conflicts: Array<{
    field: string;
    label: string;
    values: Array<{ source: string; value: string | number | null }>;
  }>;
  confidenceScore: number;
  generatedAt: string;
};

export type PersonVerificationReport = {
  sourceFieldsUsed: string[];
  sourceUrls: Array<{ label: string; url: string }>;
  missingFields: PersonSourceField[];
  conflictingFields: PersonIntelligencePacket["conflicts"];
  confidenceScore: number;
  suggestedEditorAction: string;
  summary: string;
};

export const COACH_RATING_FORMULA_VERSION = "coach-rating-v1";
export const REFEREE_SCORE_FORMULA_VERSION = "referee-profile-v1";
export const PERSON_BIO_PROMPT_VERSION = "person-bio-v1";
