/**
 * Role eligibility for calculated coach data.
 * Verified/factual CMS records are separate — this only gates derived match stats.
 */

import type { CoachingRole } from "./coach-types";
import { normalizeCoachingRole } from "./coach-types";

export type CoachCalcArea = "career_record" | "coach_rating" | "coach_impact";

const DEFAULT_ELIGIBILITY: Record<
  CoachingRole,
  { careerRecord: boolean; coachRating: boolean; coachImpact: boolean }
> = {
  head_coach: { careerRecord: true, coachRating: true, coachImpact: true },
  /** Senior programme lead (e.g. Bath Head of Rugby, Exeter Chief of Rugby). */
  head_of_rugby: { careerRecord: true, coachRating: true, coachImpact: true },
  coach: { careerRecord: true, coachRating: true, coachImpact: true },
  assistant_coach: { careerRecord: false, coachRating: false, coachImpact: false },
  /**
   * DoR defaults off — set eligibleForCareerRecord/isPrimaryCoach on the assignment
   * when the DoR is the club's primary match-stat owner (common in PREM).
   */
  director_of_rugby: { careerRecord: false, coachRating: false, coachImpact: false },
  technical_adviser: { careerRecord: false, coachRating: false, coachImpact: false },
  technical_specialist: { careerRecord: false, coachRating: false, coachImpact: false },
  attack_coach: { careerRecord: false, coachRating: false, coachImpact: false },
  defence_coach: { careerRecord: false, coachRating: false, coachImpact: false },
  forwards_coach: { careerRecord: false, coachRating: false, coachImpact: false },
  backs_coach: { careerRecord: false, coachRating: false, coachImpact: false },
  scrum_coach: { careerRecord: false, coachRating: false, coachImpact: false },
  kicking_coach: { careerRecord: false, coachRating: false, coachImpact: false },
  skills_coach: { careerRecord: false, coachRating: false, coachImpact: false },
  strength_conditioning_coach: { careerRecord: false, coachRating: false, coachImpact: false },
  consultant: { careerRecord: false, coachRating: false, coachImpact: false },
  analyst: { careerRecord: false, coachRating: false, coachImpact: false },
  team_manager: { careerRecord: false, coachRating: false, coachImpact: false },
  medical_lead: { careerRecord: false, coachRating: false, coachImpact: false },
  other: { careerRecord: false, coachRating: false, coachImpact: false },
};

export function roleEligibilityDefaults(role: string) {
  return DEFAULT_ELIGIBILITY[normalizeCoachingRole(role)];
}

/**
 * Prefer explicit assignment flags when present; otherwise use role defaults.
 */
export function isRoleEligibleForCareerRecord(input: {
  role: string;
  eligibleForCareerRecord?: boolean | null;
  isPrimaryCoach?: boolean | null;
}): boolean {
  if (input.eligibleForCareerRecord === false) return false;
  if (input.eligibleForCareerRecord === true) return true;
  if (input.isPrimaryCoach === true) return true;
  return roleEligibilityDefaults(input.role).careerRecord;
}

export function isRoleEligibleForRating(input: {
  role: string;
  eligibleForCareerRecord?: boolean | null;
  isPrimaryCoach?: boolean | null;
}): boolean {
  // Rating uses the same primary tenure set as career record by default.
  return isRoleEligibleForCareerRecord(input);
}

export function isRoleEligibleForImpact(input: {
  role: string;
  eligibleForCareerRecord?: boolean | null;
  isPrimaryCoach?: boolean | null;
}): boolean {
  return isRoleEligibleForCareerRecord(input);
}
