export const COACHING_ROLES = [
  "head_coach",
  "director_of_rugby",
  "attack_coach",
  "defence_coach",
  "forwards_coach",
  "backs_coach",
  "scrum_coach",
  "kicking_coach",
  "skills_coach",
  "strength_conditioning_coach",
  "analyst",
  "team_manager",
  "medical_lead",
  "other",
] as const;

export type CoachingRole = (typeof COACHING_ROLES)[number];

export const COACHING_ROLE_LABELS: Record<CoachingRole, string> = {
  head_coach: "Head Coach",
  director_of_rugby: "Director of Rugby",
  attack_coach: "Attack Coach",
  defence_coach: "Defence Coach",
  forwards_coach: "Forwards Coach",
  backs_coach: "Backs Coach",
  scrum_coach: "Scrum Coach",
  kicking_coach: "Kicking Coach",
  skills_coach: "Skills Coach",
  strength_conditioning_coach: "S&C Coach",
  analyst: "Analyst",
  team_manager: "Team Manager",
  medical_lead: "Medical Lead",
  other: "Other",
};

export function coachingRoleLabel(role: string): string {
  return COACHING_ROLE_LABELS[role as CoachingRole] ?? role.replace(/_/g, " ");
}

export function normalizeCoachingRole(role: string): CoachingRole {
  const normalized = role.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
  if ((COACHING_ROLES as readonly string[]).includes(normalized)) {
    return normalized as CoachingRole;
  }
  if (normalized.includes("head") && normalized.includes("coach")) return "head_coach";
  if (normalized.includes("director")) return "director_of_rugby";
  if (normalized.includes("attack")) return "attack_coach";
  if (normalized.includes("defen")) return "defence_coach";
  if (normalized.includes("forward")) return "forwards_coach";
  if (normalized.includes("back") && normalized.includes("coach")) return "backs_coach";
  if (normalized.includes("scrum")) return "scrum_coach";
  if (normalized.includes("kick")) return "kicking_coach";
  if (normalized.includes("skill")) return "skills_coach";
  if (normalized.includes("strength") || normalized.includes("s_c") || normalized.includes("s&c")) {
    return "strength_conditioning_coach";
  }
  if (normalized.includes("analyst")) return "analyst";
  if (normalized.includes("manager")) return "team_manager";
  if (normalized.includes("medical")) return "medical_lead";
  return "other";
}

export type CoachSocialAccounts = {
  twitter?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  website?: string | null;
};
