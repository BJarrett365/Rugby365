import { and, desc, eq, inArray, or } from "drizzle-orm";
import {
  fixtures,
  people,
  personBioProfiles,
  personBioSuggestions,
  personIntelligenceScoreHistory,
} from "@rugby365/db";
import { getCoachDetail } from "./coach-admin-service";
import { coachingRoleLabel } from "./coach-types";
import { getDb } from "./db";
import {
  buildPersonMissingFields,
  ensurePersonForCoach,
  personAgeFromBirthDate,
} from "./person-intelligence-service";
import {
  COACH_RATING_FORMULA_VERSION,
  type PersonIntelligencePacket,
  type PersonIntelligenceScore,
} from "./person-intelligence-types";

export type CoachRatingInputs = {
  winRate: number | null;
  recentFormPoints: number;
  competitionLevelScore: number;
  internationalExperience: boolean;
  yearsExperience: number;
  teamImprovement: number | null;
  trophiesCount: number;
  finalsCount: number;
};

function clampScore(value: number) {
  return Math.max(35, Math.min(99, Math.round(value)));
}

export function computeCoachRating(
  inputs: CoachRatingInputs,
  previous?: PersonIntelligenceScore | null,
): PersonIntelligenceScore {
  const currentPerformance = clampScore(
    50 +
      (inputs.winRate ?? 0.45) * 35 +
      inputs.competitionLevelScore +
      inputs.trophiesCount * 4 +
      inputs.finalsCount * 2,
  );
  const recentForm = clampScore(50 + inputs.recentFormPoints * 4);
  const teamImprovement = clampScore(
    50 + (inputs.teamImprovement ?? 0) * 40 + (inputs.teamImprovement != null && inputs.teamImprovement > 0 ? 8 : 0),
  );
  const playerDevelopment = clampScore(48 + inputs.yearsExperience * 1.5);
  const experience = clampScore(45 + inputs.yearsExperience * 2.5 + (inputs.internationalExperience ? 10 : 0));
  const reputation = clampScore(
    48 + inputs.trophiesCount * 5 + inputs.finalsCount * 2 + (inputs.internationalExperience ? 8 : 0),
  );

  const calculatedScore = clampScore(
    currentPerformance * 0.25 +
      recentForm * 0.2 +
      teamImprovement * 0.2 +
      playerDevelopment * 0.1 +
      experience * 0.15 +
      reputation * 0.1,
  );

  const explanationParts = [
    `Rugby365 Coach Rating is ${calculatedScore}.`,
    inputs.teamImprovement != null && inputs.teamImprovement > 0
      ? `Team win rate has improved since appointment.`
      : null,
    inputs.recentFormPoints >= 10
      ? `Recent team form is strong across the latest fixtures.`
      : null,
    inputs.internationalExperience ? `International coaching experience is recorded.` : null,
    inputs.trophiesCount > 0 ? `${inputs.trophiesCount} trophy reference(s) in verified notes.` : null,
  ].filter(Boolean);

  const previousDisplay = previous?.displayScore ?? previous?.overallScore;
  const scoreMovement =
    previousDisplay != null ? calculatedScore - previousDisplay : null;

  return {
    overallScore: calculatedScore,
    displayScore: calculatedScore,
    calculatedScore,
    supportingScores: {
      currentPerformance,
      recentForm,
      teamImprovement,
      playerDevelopment,
      experience,
      reputation,
    },
    explanation: explanationParts.join(" "),
    confidenceScore: Math.min(0.9, 0.35 + inputs.yearsExperience * 0.05 + (inputs.winRate != null ? 0.2 : 0)),
    formulaVersion: COACH_RATING_FORMULA_VERSION,
    manualOverrideRating: null,
    manualOverrideReason: null,
    careerHigh: previous?.careerHigh != null ? Math.max(previous.careerHigh, calculatedScore) : calculatedScore,
    careerLow: previous?.careerLow != null ? Math.min(previous.careerLow, calculatedScore) : calculatedScore,
    scoreMovement,
  };
}

function fixtureResultPoints(status: string, homeScore: number, awayScore: number, side: "home" | "away") {
  if (status !== "full_time" && status !== "live") return 0;
  const teamScore = side === "home" ? homeScore : awayScore;
  const oppScore = side === "home" ? awayScore : homeScore;
  if (teamScore > oppScore) return 3;
  if (teamScore === oppScore) return 1;
  return 0;
}

function competitionLevelScore(name: string | null): number {
  const lower = (name ?? "").toLowerCase();
  if (lower.includes("world cup") || lower.includes("international")) return 15;
  if (lower.includes("champions")) return 10;
  if (lower.includes("premiership") || lower.includes("top 14") || lower.includes("urc")) return 8;
  return 4;
}

export async function buildCoachIntelligencePacket(coachId: string): Promise<PersonIntelligencePacket> {
  const person = await ensurePersonForCoach(coachId);
  const detail = await getCoachDetail(coachId);
  if (!detail) throw new Error("Coach not found");
  const coach = detail.coach;
  const assignments = detail.assignments;

  const current = assignments.find((row) => row.isCurrent) ?? assignments[0] ?? null;
  const teamId = current?.teamId ?? null;

  let winRate: number | null = null;
  let recentFormPoints = 0;
  let teamImprovement: number | null = null;
  let competitionLevel = 0;

  if (teamId) {
    const db = getDb();
    const teamFixtures = await db
      .select()
      .from(fixtures)
      .where(or(eq(fixtures.homeTeamId, teamId), eq(fixtures.awayTeamId, teamId)))
      .orderBy(desc(fixtures.kickoffAt));

    const completed = teamFixtures.filter((f) => f.status === "full_time" || f.status === "live");
    const wins = completed.filter((f) => {
      const isHome = f.homeTeamId === teamId;
      const teamScore = isHome ? f.homeScore : f.awayScore;
      const oppScore = isHome ? f.awayScore : f.homeScore;
      return teamScore > oppScore;
    }).length;
    winRate = completed.length ? wins / completed.length : null;

    recentFormPoints = completed
      .slice(0, 5)
      .reduce(
        (sum, f) =>
          sum +
          fixtureResultPoints(
            f.status,
            f.homeScore,
            f.awayScore,
            f.homeTeamId === teamId ? "home" : "away",
          ),
        0,
      );

    const early = completed.slice(-5);
    const earlyWins = early.filter((f) => {
      const isHome = f.homeTeamId === teamId;
      return (isHome ? f.homeScore : f.awayScore) > (isHome ? f.awayScore : f.homeScore);
    }).length;
    const earlyRate = early.length ? earlyWins / early.length : null;
    teamImprovement = winRate != null && earlyRate != null ? winRate - earlyRate : null;
    competitionLevel = Math.max(
      ...completed.map((f) => competitionLevelScore(f.competitionName)),
      0,
    );
  }

  const yearsExperience = assignments.length;
  const internationalExperience = assignments.some((row) =>
    row.teamName.toLowerCase().includes("international"),
  );
  const notes = `${coach.notes ?? ""}`.toLowerCase();
  const trophiesCount = (notes.match(/trophy|champion|title/g) ?? []).length > 0 ? 1 : 0;
  const finalsCount = notes.includes("final") ? 1 : 0;

  const previousScore = await getLatestCoachScore(person.id);
  const score = computeCoachRating(
    {
      winRate,
      recentFormPoints,
      competitionLevelScore: competitionLevel,
      internationalExperience,
      yearsExperience,
      teamImprovement,
      trophiesCount,
      finalsCount,
    },
    previousScore,
  );

  const sourceUrls = [
    coach.wikipediaUrl ? { label: "Wikipedia", url: coach.wikipediaUrl } : null,
    coach.sourceUrl ? { label: "Source", url: coach.sourceUrl } : null,
  ].filter((row): row is { label: string; url: string } => Boolean(row));

  return {
    personId: person.id,
    roleType: "coach",
    roleEntityId: coachId,
    name: coach.name,
    birthDate: coach.birthDate,
    age: personAgeFromBirthDate(coach.birthDate),
    nationality: coach.nationality,
    birthPlace: null,
    currentRole: current ? coachingRoleLabel(current.role) : null,
    currentOrganisation: current?.teamName ?? null,
    imageUrl: coach.imageUrl,
    bioSummary: coach.bioSummary,
    sourceUrls,
    score,
    roleContext: {
      assignments,
      currentAssignment: current,
      winRate,
      recentFormPoints,
      teamImprovement,
      trophiesCount,
      finalsCount,
    },
    missingFields: buildPersonMissingFields("coach", {
      bioSummary: coach.bioSummary,
      birthDate: coach.birthDate,
      nationality: coach.nationality,
      imageUrl: coach.imageUrl,
      currentRole: current?.role ?? null,
      currentOrganisation: current?.teamName ?? null,
    }),
    conflicts: [],
    confidenceScore: score.confidenceScore,
    generatedAt: new Date().toISOString(),
  };
}

async function getLatestCoachScore(personId: string): Promise<PersonIntelligenceScore | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(personIntelligenceScoreHistory)
    .where(
      and(
        eq(personIntelligenceScoreHistory.personId, personId),
        eq(personIntelligenceScoreHistory.ratingType, "coach_rating"),
      ),
    )
    .orderBy(desc(personIntelligenceScoreHistory.calculatedAt))
    .limit(1);
  if (!row) return null;
  return {
    overallScore: row.overallScore,
    displayScore: row.manualOverrideRating ?? row.overallScore,
    calculatedScore: row.overallScore,
    supportingScores: (row.supportingScores as Record<string, number | null>) ?? {},
    explanation: row.explanation ?? "",
    confidenceScore: row.confidenceScore ?? 0.5,
    formulaVersion: row.formulaVersion,
    manualOverrideRating: row.manualOverrideRating,
    manualOverrideReason: row.overrideNotes,
    careerHigh: row.overallScore,
    careerLow: row.overallScore,
    scoreMovement: null,
  };
}

export function buildCoachScoreHistoryRecord(
  packet: PersonIntelligencePacket,
  teamId?: string | null,
) {
  return {
    personId: packet.personId,
    roleType: "coach" as const,
    teamId: teamId ?? null,
    ratingType: "coach_rating" as const,
    overallScore: packet.score.calculatedScore,
    supportingScores: packet.score.supportingScores,
    explanation: packet.score.explanation,
    calculationInputs: packet.roleContext,
    formulaVersion: packet.score.formulaVersion,
    confidenceScore: packet.score.confidenceScore,
  };
}

export async function persistCoachIntelligenceScore(
  packet: PersonIntelligencePacket,
  teamId?: string | null,
) {
  const db = getDb();
  await db.insert(personIntelligenceScoreHistory).values(buildCoachScoreHistoryRecord(packet, teamId));
}

export type CoachIntelligenceSummary = {
  coachRating: number | null;
  bioStatus: "approved" | "pending" | "none";
};

export async function getCoachIntelligenceSummaries(
  coachIds: string[],
): Promise<Record<string, CoachIntelligenceSummary>> {
  const uniqueCoachIds = [...new Set(coachIds)];
  const empty = Object.fromEntries(
    uniqueCoachIds.map((coachId) => [coachId, { coachRating: null, bioStatus: "none" as const }]),
  );
  if (!uniqueCoachIds.length) return empty;

  const db = getDb();
  const personRows = await db
    .select()
    .from(people)
    .where(and(eq(people.roleType, "coach"), inArray(people.roleEntityId, uniqueCoachIds)));

  if (!personRows.length) return empty;

  const personByCoachId = Object.fromEntries(personRows.map((row) => [row.roleEntityId, row]));
  const personIds = personRows.map((row) => row.id);

  const [scoreRows, profileRows, suggestionRows] = await Promise.all([
    db
      .select()
      .from(personIntelligenceScoreHistory)
      .where(
        and(
          inArray(personIntelligenceScoreHistory.personId, personIds),
          eq(personIntelligenceScoreHistory.ratingType, "coach_rating"),
        ),
      )
      .orderBy(desc(personIntelligenceScoreHistory.calculatedAt)),
    db.select().from(personBioProfiles).where(inArray(personBioProfiles.personId, personIds)),
    db
      .select()
      .from(personBioSuggestions)
      .where(inArray(personBioSuggestions.personId, personIds))
      .orderBy(desc(personBioSuggestions.createdAt)),
  ]);

  const latestScoreByPerson = new Map<string, (typeof scoreRows)[number]>();
  for (const row of scoreRows) {
    if (!latestScoreByPerson.has(row.personId)) latestScoreByPerson.set(row.personId, row);
  }

  const profileByPerson = new Map(profileRows.map((row) => [row.personId, row]));
  const latestSuggestionByPerson = new Map<string, (typeof suggestionRows)[number]>();
  for (const row of suggestionRows) {
    if (!latestSuggestionByPerson.has(row.personId)) latestSuggestionByPerson.set(row.personId, row);
  }

  const summaries: Record<string, CoachIntelligenceSummary> = { ...empty };
  for (const coachId of uniqueCoachIds) {
    const person = personByCoachId[coachId];
    if (!person) continue;

    const latestScore = latestScoreByPerson.get(person.id);
    const profile = profileByPerson.get(person.id);
    const latestSuggestion = latestSuggestionByPerson.get(person.id);
    const bioStatus =
      latestSuggestion?.status === "pending"
        ? "pending"
        : profile?.shortIntro || profile?.fullBio
          ? "approved"
          : "none";

    summaries[coachId] = {
      coachRating: latestScore?.manualOverrideRating ?? latestScore?.overallScore ?? null,
      bioStatus,
    };
  }

  return summaries;
}
