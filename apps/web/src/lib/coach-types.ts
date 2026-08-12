export const COACHING_ROLES = [
  "head_coach",
  "head_of_rugby",
  "coach",
  "assistant_coach",
  "director_of_rugby",
  "technical_adviser",
  "technical_specialist",
  "attack_coach",
  "defence_coach",
  "forwards_coach",
  "backs_coach",
  "scrum_coach",
  "kicking_coach",
  "skills_coach",
  "strength_conditioning_coach",
  "consultant",
  "analyst",
  "team_manager",
  "medical_lead",
  "other",
] as const;

export type CoachingRole = (typeof COACHING_ROLES)[number];

export const COACHING_ROLE_LABELS: Record<CoachingRole, string> = {
  head_coach: "Head Coach",
  head_of_rugby: "Head of Rugby",
  coach: "Coach",
  assistant_coach: "Assistant Coach",
  director_of_rugby: "Director of Rugby",
  technical_adviser: "Technical Adviser",
  technical_specialist: "Technical Specialist",
  attack_coach: "Attack Coach",
  defence_coach: "Defence Coach",
  forwards_coach: "Forwards Coach",
  backs_coach: "Backs Coach",
  scrum_coach: "Scrum Coach",
  kicking_coach: "Kicking Coach",
  skills_coach: "Skills Coach",
  strength_conditioning_coach: "S&C Coach",
  consultant: "Consultant",
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
  if (normalized.includes("technical") && normalized.includes("advis")) return "technical_adviser";
  if (normalized.includes("technical") && normalized.includes("special")) {
    return "technical_specialist";
  }
  if (normalized.includes("head") && normalized.includes("coach")) return "head_coach";
  if (
    (normalized.includes("head") && normalized.includes("rugby")) ||
    (normalized.includes("chief") && normalized.includes("rugby"))
  ) {
    return "head_of_rugby";
  }
  if (normalized.includes("assistant")) return "assistant_coach";
  if (normalized.includes("consultant")) return "consultant";
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
  if (normalized === "coach" || normalized === "coaching") return "coach";
  return "other";
}

export type CoachSocialAccounts = {
  twitter?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  website?: string | null;
};
