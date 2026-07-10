import { and, desc, eq } from "drizzle-orm";
import { fixtures, personIntelligenceScoreHistory, refereeAppointments, referees, teams } from "@rugby365/db";
import { getDb } from "./db";
import { getRefereeById } from "./entity-admin-service";
import {
  buildPersonMissingFields,
  ensurePersonForReferee,
  personAgeFromBirthDate,
} from "./person-intelligence-service";
import {
  REFEREE_SCORE_FORMULA_VERSION,
  type PersonIntelligencePacket,
  type PersonIntelligenceScore,
} from "./person-intelligence-types";

export type RefereeScoreInputs = {
  matchesRefereed: number;
  internationalMatches: number;
  testMatches: number;
  majorFinals: number;
  competitionLevelScore: number;
  recentAppointments: number;
};

function clampScore(value: number) {
  return Math.max(35, Math.min(99, Math.round(value)));
}

export function computeRefereeProfileScore(
  inputs: RefereeScoreInputs,
  previous?: PersonIntelligenceScore | null,
): PersonIntelligenceScore {
  const experience = clampScore(42 + Math.min(35, inputs.matchesRefereed * 0.8));
  const appointmentLevel = clampScore(45 + inputs.competitionLevelScore);
  const currentStatus = clampScore(50 + Math.min(20, inputs.recentAppointments * 2));
  const consistencyProfile = clampScore(55 + Math.min(15, inputs.matchesRefereed * 0.2));
  const disciplineProfile = clampScore(52);

  const calculatedScore = clampScore(
    experience * 0.3 +
      appointmentLevel * 0.25 +
      currentStatus * 0.2 +
      consistencyProfile * 0.15 +
      disciplineProfile * 0.1,
  );

  const explanationParts = [
    `Rugby365 Referee Profile Score is ${calculatedScore}.`,
    inputs.internationalMatches > 0
      ? `Experienced referee with ${inputs.internationalMatches} international appointment(s) in verified Rugby365 data.`
      : `Profile based on verified domestic and club appointments.`,
    inputs.testMatches > 0 ? `${inputs.testMatches} test-level appointment(s) recorded.` : null,
    inputs.majorFinals > 0 ? `Includes ${inputs.majorFinals} major final appointment reference(s).` : null,
    inputs.matchesRefereed < 5 ? `Profile is based on limited appointment data.` : null,
  ].filter(Boolean);

  const previousDisplay = previous?.displayScore ?? previous?.overallScore;
  const scoreMovement =
    previousDisplay != null ? calculatedScore - previousDisplay : null;

  return {
    overallScore: calculatedScore,
    displayScore: calculatedScore,
    calculatedScore,
    supportingScores: {
      experience,
      appointmentLevel,
      currentStatus,
      consistencyProfile,
      disciplineProfile,
    },
    explanation: explanationParts.join(" "),
    confidenceScore: Math.min(0.9, 0.3 + inputs.matchesRefereed * 0.04),
    formulaVersion: REFEREE_SCORE_FORMULA_VERSION,
    manualOverrideRating: null,
    manualOverrideReason: null,
    careerHigh: previous?.careerHigh != null ? Math.max(previous.careerHigh, calculatedScore) : calculatedScore,
    careerLow: previous?.careerLow != null ? Math.min(previous.careerLow, calculatedScore) : calculatedScore,
    scoreMovement,
  };
}

function appointmentLevelFromCompetition(name: string | null): { level: string; score: number; international: boolean; test: boolean } {
  const lower = (name ?? "").toLowerCase();
  if (lower.includes("world cup") || lower.includes("test")) {
    return { level: "test", score: 15, international: true, test: true };
  }
  if (lower.includes("international") || lower.includes("six nations") || lower.includes("rugby championship")) {
    return { level: "international", score: 12, international: true, test: false };
  }
  if (lower.includes("champions") || lower.includes("challenge cup")) {
    return { level: "european", score: 10, international: false, test: false };
  }
  if (lower.includes("premiership") || lower.includes("top 14") || lower.includes("urc")) {
    return { level: "top_domestic", score: 8, international: false, test: false };
  }
  return { level: "domestic", score: 4, international: false, test: false };
}

export async function syncRefereeAppointmentsFromFixtures(refereeId: string) {
  const db = getDb();
  const fixtureRows = await db
    .select({
      fixture: fixtures,
      homeTeam: teams.name,
    })
    .from(fixtures)
    .leftJoin(teams, eq(fixtures.homeTeamId, teams.id))
    .where(eq(fixtures.refereeId, refereeId))
    .orderBy(desc(fixtures.kickoffAt));

  const awayTeams = await db.select().from(teams);
  const awayById = Object.fromEntries(awayTeams.map((team) => [team.id, team.name]));

  for (const row of fixtureRows) {
    const meta = appointmentLevelFromCompetition(row.fixture.competitionName);
    await db
      .insert(refereeAppointments)
      .values({
        refereeId,
        fixtureId: row.fixture.id,
        competitionId: row.fixture.competitionId,
        appointmentLevel: meta.level,
        isInternational: meta.international,
        isTestMatch: meta.test,
        kickoffAt: row.fixture.kickoffAt,
        homeTeam: row.homeTeam,
        awayTeam: row.fixture.awayTeamId ? awayById[row.fixture.awayTeamId] ?? null : null,
        competitionName: row.fixture.competitionName,
        sourceProvider: "rugby365",
        syncedAt: new Date(),
      })
      .onConflictDoNothing();
  }
}

export async function buildRefereeIntelligencePacket(refereeId: string): Promise<PersonIntelligencePacket> {
  const person = await ensurePersonForReferee(refereeId);
  await syncRefereeAppointmentsFromFixtures(refereeId);

  const referee = await getRefereeById(refereeId);
  if (!referee) throw new Error("Referee not found");

  const db = getDb();
  const appointments = await db
    .select()
    .from(refereeAppointments)
    .where(eq(refereeAppointments.refereeId, refereeId))
    .orderBy(desc(refereeAppointments.kickoffAt));

  const internationalMatches = appointments.filter((row) => row.isInternational).length;
  const testMatches = appointments.filter((row) => row.isTestMatch).length;
  const majorFinals = appointments.filter((row) =>
    (row.competitionName ?? "").toLowerCase().includes("final"),
  ).length;
  const competitionLevelScore = appointments.reduce(
    (max, row) => Math.max(max, appointmentLevelFromCompetition(row.competitionName).score),
    0,
  );

  const previousScore = await getLatestRefereeScore(person.id);
  const score = computeRefereeProfileScore(
    {
      matchesRefereed: appointments.length,
      internationalMatches,
      testMatches,
      majorFinals,
      competitionLevelScore,
      recentAppointments: appointments.slice(0, 5).length,
    },
    previousScore,
  );

  const sourceUrls = [
    referee.wikipediaUrl ? { label: "Wikipedia", url: referee.wikipediaUrl } : null,
    referee.sourceUrl ? { label: "Source", url: referee.sourceUrl } : null,
  ].filter((row): row is { label: string; url: string } => Boolean(row));

  const currentLevel =
    appointments[0]?.appointmentLevel ??
    (internationalMatches > 0 ? "international" : appointments.length ? "domestic" : null);

  return {
    personId: person.id,
    roleType: "referee",
    roleEntityId: refereeId,
    name: referee.name,
    birthDate: referee.birthDate,
    age: personAgeFromBirthDate(referee.birthDate),
    nationality: referee.nationality ?? referee.countryName,
    birthPlace: null,
    currentRole: currentLevel,
    currentOrganisation: appointments[0]?.competitionName ?? null,
    imageUrl: referee.imageUrl,
    bioSummary: referee.bioSummary,
    sourceUrls,
    score,
    roleContext: {
      appointments: appointments.slice(0, 20),
      internationalMatches,
      testMatches,
      majorFinals,
      matchesRefereed: appointments.length,
    },
    missingFields: buildPersonMissingFields("referee", {
      bioSummary: referee.bioSummary,
      birthDate: referee.birthDate,
      nationality: referee.nationality ?? referee.countryName,
      imageUrl: referee.imageUrl,
      currentRole: currentLevel,
    }),
    conflicts: [],
    confidenceScore: score.confidenceScore,
    generatedAt: new Date().toISOString(),
  };
}

async function getLatestRefereeScore(personId: string): Promise<PersonIntelligenceScore | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(personIntelligenceScoreHistory)
    .where(
      and(
        eq(personIntelligenceScoreHistory.personId, personId),
        eq(personIntelligenceScoreHistory.ratingType, "referee_profile_score"),
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

export function buildRefereeScoreHistoryRecord(packet: PersonIntelligencePacket) {
  return {
    personId: packet.personId,
    roleType: "referee" as const,
    ratingType: "referee_profile_score" as const,
    overallScore: packet.score.calculatedScore,
    supportingScores: packet.score.supportingScores,
    explanation: packet.score.explanation,
    calculationInputs: packet.roleContext,
    formulaVersion: packet.score.formulaVersion,
    confidenceScore: packet.score.confidenceScore,
  };
}

export async function persistRefereeIntelligenceScore(packet: PersonIntelligencePacket) {
  const db = getDb();
  await db.insert(personIntelligenceScoreHistory).values(buildRefereeScoreHistoryRecord(packet));
}
