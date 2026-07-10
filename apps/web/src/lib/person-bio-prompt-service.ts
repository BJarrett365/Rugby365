import type { PersonBioType, PersonIntelligencePacket } from "./person-intelligence-types";
import { PERSON_BIO_PROMPT_VERSION } from "./person-intelligence-types";

const SHARED_RULES = `You are Rugby365's editorial bio writer for coaches and referees.
OpenAI is NOT the source of truth. Only use facts from the supplied verified data packet.
Never invent trophies, contracts, salaries, agent details, medical history, private data, referee bias claims, or disciplinary claims.
For referees, use respectful public language focused on experience and appointments — never attack or judge the referee.
Use the stored score explanation exactly for rating-aware text.
Return strict JSON with keys:
shortIntro, fullBio, careerSummary, ratingExplanation, appointmentSummary, experienceProfile.
All values must be strings.`;

export function buildPersonBioPrompt(bioType: PersonBioType, packet: PersonIntelligencePacket) {
  return {
    system: `${SHARED_RULES}\n\n${bioTypeInstructions(bioType, packet)}`,
    user: `Verified person data packet:\n${JSON.stringify(packet, null, 2)}`,
    promptVersion: PERSON_BIO_PROMPT_VERSION,
  };
}

function bioTypeInstructions(bioType: PersonBioType, packet: PersonIntelligencePacket): string {
  switch (bioType) {
    case "coach_short_bio":
      return `Write a short coach bio intro for ${packet.name}.`;
    case "coach_full_profile":
      return `Write a full coach profile including current team, role, career history and strengths from verified data only.`;
    case "coach_career_summary":
      return `Write a coach career summary from verified assignments and notes only.`;
    case "coach_rating_explanation":
      return `Write a coach rating explanation using the stored score explanation and supporting scores. Do not invent reasons.`;
    case "referee_short_bio":
      return `Write a short respectful referee bio intro focused on experience and appointments.`;
    case "referee_full_profile":
      return `Write a full referee profile from verified appointment history. Avoid judgemental language.`;
    case "referee_appointment_summary":
      return `Summarise verified referee appointments and competition levels.`;
    case "referee_experience_profile":
      return `Write an experience-focused referee profile for public use.`;
    default:
      return `Write a verified profile bio.`;
  }
}

export function parsePersonBioSections(raw: Record<string, unknown>) {
  return {
    shortIntro: stringField(raw.shortIntro),
    fullBio: stringField(raw.fullBio),
    careerSummary: stringField(raw.careerSummary),
    ratingExplanation: stringField(raw.ratingExplanation),
    appointmentSummary: stringField(raw.appointmentSummary),
    experienceProfile: stringField(raw.experienceProfile),
  };
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function inferCoachBioType(packet: PersonIntelligencePacket): PersonBioType {
  return "coach_full_profile";
}

export function inferRefereeBioType(packet: PersonIntelligencePacket): PersonBioType {
  return "referee_full_profile";
}
