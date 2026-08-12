/**
 * Coach CMS profile completeness + attention badges.
 */

export type CoachCmsIssueBadge =
  | "MISSING DATA"
  | "SOURCE CONFLICT"
  | "MISSING IMAGE"
  | "CAREER GAP"
  | "MISSING HONOURS"
  | "MISSING CREST"
  | "NEEDS REVIEW";

export type CoachCmsSectionScore = {
  id: string;
  label: string;
  score: number;
  tab: string;
};

export type CoachCmsCompleteness = {
  percent: number;
  sections: CoachCmsSectionScore[];
  issues: CoachCmsIssueBadge[];
  workflowStatus: "draft" | "needs_review" | "approved" | "published";
};

type Input = {
  publishStatus: string;
  isPublic: boolean;
  name: string;
  knownAs?: string | null;
  birthDate?: string | null;
  placeOfBirth?: string | null;
  nationality?: string | null;
  heightCm?: string | number | null;
  imageUrl?: string | null;
  bioSummary?: string | null;
  wikipediaUrl?: string | null;
  appointedOn?: string | null;
  contractExpiresOn?: string | null;
  preferredSystem?: string | null;
  coachingStyle?: string | null;
  lastVerifiedAt?: string | null;
  playingStintCount: number;
  assignmentCount: number;
  currentAssignment: boolean;
  overviewCareerCount: number;
  needsReviewCareerCount: number;
  missingCrestCount: number;
  honourCount: number;
  awardCount: number;
  hasCareerRecord?: boolean;
  hasRating?: boolean;
};

function pct(done: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round((Math.min(done, total) / total) * 100);
}

export function computeCoachCmsCompleteness(input: Input): CoachCmsCompleteness {
  const identityChecks = [
    Boolean(input.name?.trim()),
    Boolean(input.birthDate),
    Boolean(input.placeOfBirth?.trim() || input.nationality?.trim()),
    Boolean(input.heightCm),
    Boolean(input.appointedOn || input.coachingStyle || input.preferredSystem),
  ];
  const identity = pct(identityChecks.filter(Boolean).length, identityChecks.length);

  const image = input.imageUrl?.trim() ? 100 : 0;

  const careerChecks = [
    input.playingStintCount > 0,
    input.assignmentCount > 0,
    input.currentAssignment,
    input.overviewCareerCount >= 5,
    input.needsReviewCareerCount === 0,
  ];
  const career = pct(careerChecks.filter(Boolean).length, careerChecks.length);

  const matches = input.hasCareerRecord ? 100 : input.assignmentCount > 0 ? 60 : 20;
  const stats = input.hasCareerRecord ? 100 : 40;
  const honours = pct(
    [input.honourCount > 0, input.awardCount > 0, input.honourCount >= 2].filter(Boolean).length,
    3,
  );
  const awards = input.awardCount > 0 ? 100 : 0;
  const tactics = pct(
    [Boolean(input.preferredSystem?.trim()), Boolean(input.coachingStyle?.trim())].filter(Boolean)
      .length,
    2,
  );
  const sources = pct(
    [
      Boolean(input.wikipediaUrl?.trim()),
      Boolean(input.lastVerifiedAt),
      input.needsReviewCareerCount === 0,
    ].filter(Boolean).length,
    3,
  );
  const ratings = input.hasRating ? 100 : 50;

  const sections: CoachCmsSectionScore[] = [
    { id: "identity", label: "Identity", score: identity, tab: "overview" },
    { id: "image", label: "Image", score: image, tab: "images" },
    { id: "career", label: "Career", score: career, tab: "coaching" },
    { id: "matches", label: "Matches", score: matches, tab: "matches" },
    { id: "stats", label: "Stats", score: stats, tab: "stats" },
    { id: "honours", label: "Honours", score: honours, tab: "honours" },
    { id: "awards", label: "Awards", score: awards, tab: "honours" },
    { id: "tactics", label: "Tactics", score: tactics, tab: "tactics" },
    { id: "ratings", label: "Ratings", score: ratings, tab: "ratings" },
    { id: "sources", label: "Sources", score: sources, tab: "sources" },
  ];

  const percent = Math.round(
    sections.reduce((sum, s) => sum + s.score, 0) / Math.max(1, sections.length),
  );

  const issues: CoachCmsIssueBadge[] = [];
  if (!input.imageUrl?.trim()) issues.push("MISSING IMAGE");
  if (input.assignmentCount === 0 || input.playingStintCount === 0) issues.push("CAREER GAP");
  if (input.honourCount === 0 && input.awardCount === 0) issues.push("MISSING HONOURS");
  if (input.missingCrestCount > 0) issues.push("MISSING CREST");
  if (input.needsReviewCareerCount > 0) issues.push("NEEDS REVIEW");
  if (
    !input.birthDate ||
    !input.nationality?.trim() ||
    !input.bioSummary?.trim() ||
    !input.currentAssignment
  ) {
    issues.push("MISSING DATA");
  }

  let workflowStatus: CoachCmsCompleteness["workflowStatus"] = "draft";
  if (input.publishStatus === "published" && input.isPublic) {
    workflowStatus = input.needsReviewCareerCount > 0 || percent < 70 ? "needs_review" : "published";
  } else if (input.publishStatus === "draft") {
    workflowStatus = input.needsReviewCareerCount > 0 ? "needs_review" : "draft";
  } else if (input.lastVerifiedAt && percent >= 80) {
    workflowStatus = "approved";
  } else if (input.needsReviewCareerCount > 0) {
    workflowStatus = "needs_review";
  }

  return { percent, sections, issues: [...new Set(issues)], workflowStatus };
}
