/**
 * OpenAI Profile Check for Coach CMS.
 * OpenAI is the analysis layer — not authoritative. Sources are retrieved first;
 * OpenAI only analyses evidence we actually fetched. Never auto-publishes.
 */

import { and, desc, eq } from "drizzle-orm";
import { aiVerificationReports } from "@rugby365/db";
import { chatCompletion, getOpenAiModel, parseJsonObject } from "./openai-client";
import { getDb } from "./db";
import { getCoachDetail } from "./coach-admin-service";
import {
  listCoachPlayingStints,
  listCoachHonours,
  listCoachAwards,
  listCoachMedals,
} from "./coach-history-cms-service";
import { getCoachDataCoverage } from "./coach-recalc-service";
import { getCoachCareerRecord, getCoachImpact } from "./coach-career-record-service";
import { calculateCoachRatingBundle } from "./coach-rating-service";
import {
  getCoachSelectionStability,
  getCoachPlayerDevelopment,
} from "./coach-derived-metrics-service";
import { computeCoachCmsCompleteness } from "./coach-cms-completeness";
import { parseWikipediaArchive, type WikipediaCoachArchive } from "@rugby365/import-sdk";
import { getWikimediaEnterpriseAccessToken } from "./wikimedia-enterprise-client";

export type CoachProfileCheckScope =
  | "full"
  | "career"
  | "honours"
  | "bio"
  | "images"
  | "stats";

export type CoachIssueType =
  | "MISSING"
  | "CONFLICT"
  | "OUTDATED"
  | "UNVERIFIED"
  | "POSSIBLE DUPLICATE"
  | "CALCULATION GAP"
  | "IMAGE ISSUE"
  | "TEAM LINK ISSUE"
  | "SOURCE MISSING"
  | "EDITORIAL SUGGESTION"
  | "VERIFIED";

export type CoachSuggestionClass =
  | "VERIFIED FACT"
  | "CALCULATED DATA"
  | "RUGBY365 ASSESSMENT"
  | "EDITORIAL TEXT";

export type CoachProfileFinding = {
  id: string;
  field: string;
  label: string;
  issueType: CoachIssueType;
  severity: "HIGH" | "MEDIUM" | "LOW";
  suggestionClass: CoachSuggestionClass;
  currentValue: unknown;
  foundValue: unknown;
  sources: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  rationale: string;
  recommendedAction:
    | "NO CHANGE"
    | "ACCEPT"
    | "EDIT"
    | "KEEP CURRENT"
    | "IGNORE"
    | "CHECK SOURCE"
    | "LINK EXISTING TEAM"
    | "LINK EXISTING CREST"
    | "RECALCULATE"
    | "REFRESH DATA"
    | "BACKFILL TEAM STATS"
    | "BACKFILL PLAYER RATINGS"
    | "BACKFILL HISTORICAL RANKINGS";
};

export type CoachProfileHealthSection = {
  id: string;
  label: string;
  score: number;
};

export type CoachProfileCheckReport = {
  profileHealth: number;
  sections: CoachProfileHealthSection[];
  summary: {
    headline: string;
    missing: number;
    conflicts: number;
    improvements: number;
    missingCrest: number;
    verified: number;
    calculationGaps: number;
  };
  findings: CoachProfileFinding[];
  nextBestActions: string[];
  sourcesUsed: Array<{ label: string; retrieved: boolean; url?: string | null; note?: string }>;
  checkedAt: string;
  model: string;
  scope: CoachProfileCheckScope;
};

export type CoachProfileCheckResult = {
  reportId: string;
  report: CoachProfileCheckReport;
  snapshot: Record<string, unknown>;
};

const SYSTEM = `You are Rugby365's Coach CMS profile auditor.
OpenAI is NOT authoritative and must NOT invent facts, URLs, scores, or sources.
You analyse ONLY the provided CMS snapshot and retrievedSources evidence.
Valid overlapping coaching roles are allowed (e.g. DoR + Head Coach).
Classify every finding suggestionClass as exactly one of:
VERIFIED FACT | CALCULATED DATA | RUGBY365 ASSESSMENT | EDITORIAL TEXT
Classify issueType as one of:
MISSING | CONFLICT | OUTDATED | UNVERIFIED | POSSIBLE DUPLICATE | CALCULATION GAP | IMAGE ISSUE | TEAM LINK ISSUE | SOURCE MISSING | EDITORIAL SUGGESTION | VERIFIED
Severity: HIGH | MEDIUM | LOW
recommendedAction: NO CHANGE | ACCEPT | EDIT | KEEP CURRENT | IGNORE | CHECK SOURCE | LINK EXISTING TEAM | LINK EXISTING CREST | RECALCULATE | REFRESH DATA | BACKFILL TEAM STATS | BACKFILL PLAYER RATINGS | BACKFILL HISTORICAL RANKINGS
Never suggest publishing. Prefer KEEP CURRENT / NO CHANGE when uncertain.
Return strict JSON:
{
  "profileHealth": 0-100,
  "sections": [{"id":"identity","label":"Identity","score":0-100}, ...],
  "summary": {"headline":"...","missing":0,"conflicts":0,"improvements":0,"missingCrest":0,"verified":0,"calculationGaps":0},
  "findings": [{
    "id":"stable-id",
    "field":"contractExpiresOn",
    "label":"Contract",
    "issueType":"VERIFIED",
    "severity":"LOW",
    "suggestionClass":"VERIFIED FACT",
    "currentValue":"...",
    "foundValue":"...",
    "sources":["Wikipedia"],
    "confidence":"HIGH",
    "rationale":"...",
    "recommendedAction":"NO CHANGE"
  }],
  "nextBestActions": ["..."]
}
Section ids to cover when possible: identity, career, honours, awards, images, team_links, stats, ratings, sources, bio.
Only list sources in findings.sources if they appear in retrievedSources with retrieved:true.`;

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function clampScore(n: unknown, fallback = 0): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(100, Math.round(x)));
}

async function fetchWikipediaEvidence(wikipediaUrl: string | null | undefined) {
  if (!wikipediaUrl?.trim()) {
    return {
      label: "Wikipedia",
      retrieved: false,
      url: wikipediaUrl ?? null,
      note: "No Wikipedia URL on coach",
      archive: null as WikipediaCoachArchive | null,
    };
  }
  try {
    const token = await getWikimediaEnterpriseAccessToken().catch(() => null);
    const archive = (await parseWikipediaArchive({
      articleTitleOrUrl: wikipediaUrl,
      entityType: "coach",
      accessToken: token ?? undefined,
    })) as WikipediaCoachArchive;
    return {
      label: "Wikipedia",
      retrieved: true,
      url: wikipediaUrl,
      note: "Archive parsed for career/identity comparison",
      archive: {
        displayName: archive.displayName ?? null,
        birthDate: archive.birthDate ?? null,
        placeOfBirth: archive.placeOfBirth ?? null,
        nationality: archive.nationality ?? null,
        heightCm: archive.heightCm ?? null,
        coachingCareer: (archive.coachingCareer ?? []).slice(0, 40),
        playingCareer: (archive.playingCareer ?? []).slice(0, 40),
      },
    };
  } catch (e) {
    return {
      label: "Wikipedia",
      retrieved: false,
      url: wikipediaUrl,
      note: e instanceof Error ? e.message : "Wikipedia fetch failed",
      archive: null as WikipediaCoachArchive | null,
    };
  }
}

export async function buildCoachProfileCheckSnapshot(
  coachId: string,
  scope: CoachProfileCheckScope = "full",
) {
  const detail = await getCoachDetail(coachId);
  if (!detail) throw new Error("Coach not found");

  const [
    playing,
    honours,
    awards,
    medals,
    coverage,
    career,
    impact,
    ratings,
    selection,
    development,
    wiki,
  ] = await Promise.all([
    listCoachPlayingStints(coachId),
    listCoachHonours(coachId),
    listCoachAwards(coachId),
    listCoachMedals(coachId),
    getCoachDataCoverage(coachId),
    getCoachCareerRecord(coachId),
    getCoachImpact(coachId),
    calculateCoachRatingBundle(coachId).catch(() => null),
    getCoachSelectionStability(coachId).catch(() => null),
    getCoachPlayerDevelopment(coachId).catch(() => null),
    scope === "images" || scope === "stats"
      ? Promise.resolve({
          label: "Wikipedia",
          retrieved: false,
          url: detail.coach.wikipediaUrl,
          note: "Skipped for this scope",
          archive: null,
        })
      : fetchWikipediaEvidence(detail.coach.wikipediaUrl),
  ]);

  const current = detail.assignments.find((a) => a.isCurrent) ?? null;
  const completeness = computeCoachCmsCompleteness({
    publishStatus: detail.coach.publishStatus,
    isPublic: detail.coach.isPublic,
    name: detail.coach.name,
    knownAs: detail.coach.knownAs,
    birthDate: detail.coach.birthDate,
    placeOfBirth: detail.coach.placeOfBirth,
    nationality: detail.coach.nationality,
    heightCm: detail.coach.heightCm,
    imageUrl: detail.coach.imageUrl,
    bioSummary: detail.coach.bioSummary,
    wikipediaUrl: detail.coach.wikipediaUrl,
    appointedOn: detail.coach.appointedOn,
    contractExpiresOn: detail.coach.contractExpiresOn,
    preferredSystem: detail.coach.preferredSystem,
    coachingStyle: detail.coach.coachingStyle,
    lastVerifiedAt: detail.coach.lastVerifiedAt?.toISOString?.() ?? null,
    playingStintCount: playing.length,
    assignmentCount: detail.assignments.length,
    currentAssignment: Boolean(current),
    overviewCareerCount:
      playing.filter((p) => p.showOnOverview).length +
      detail.assignments.filter((a) => a.showOnOverview || a.isCurrent).length,
    needsReviewCareerCount: detail.assignments.filter((a) => a.recordStatus === "needs_review")
      .length,
    missingCrestCount: detail.assignments.filter((a) => a.missingCrest).length,
    honourCount: honours.length,
    awardCount: awards.length,
    hasCareerRecord: career.played > 0,
    hasRating: Boolean(ratings?.overallRating != null),
  });

  const sourcesUsed = [
    {
      label: "Rugby365 CMS",
      retrieved: true,
      url: null as string | null,
      note: "Structured coach record",
    },
    {
      label: "Wikipedia",
      retrieved: wiki.retrieved,
      url: wiki.url ?? null,
      note: wiki.note,
    },
    {
      label: "Wikidata",
      retrieved: Boolean(detail.coach.wikidataId),
      url: detail.coach.wikidataId ? `https://www.wikidata.org/wiki/${detail.coach.wikidataId}` : null,
      note: detail.coach.wikidataId ? "ID present (entity not fetched this run)" : "Missing Wikidata ID",
    },
    {
      label: "RugbyPass",
      retrieved: false,
      url: detail.coach.sourceUrl?.includes("rugbypass") ? detail.coach.sourceUrl : null,
      note: detail.coach.sourceUrl?.includes("rugbypass")
        ? "URL on file — live page not fetched this run"
        : "No RugbyPass URL fetched this run",
    },
    {
      label: "Planet Rugby",
      retrieved: false,
      url: null,
      note: "Not retrieved this run",
    },
  ];

  return {
    scope,
    generatedAt: new Date().toISOString(),
    coach: {
      id: detail.coach.id,
      name: detail.coach.name,
      slug: detail.coach.slug,
      knownAs: detail.coach.knownAs,
      fullName: detail.coach.fullName,
      nationality: detail.coach.nationality,
      secondNationality: detail.coach.secondNationality,
      birthDate: detail.coach.birthDate,
      placeOfBirth: detail.coach.placeOfBirth,
      countryOfBirth: detail.coach.countryOfBirth,
      heightCm: detail.coach.heightCm,
      formerPlayingPositions: detail.coach.formerPlayingPositions,
      coachingCareerStartYear: detail.coach.coachingCareerStartYear,
      appointedOn: detail.coach.appointedOn,
      contractExpiresOn: detail.coach.contractExpiresOn,
      preferredSystem: detail.coach.preferredSystem,
      coachingStyle: detail.coach.coachingStyle,
      preferredSystemProvenance: detail.coach.preferredSystemProvenance,
      coachingStyleProvenance: detail.coach.coachingStyleProvenance,
      bioSummary: detail.coach.bioSummary,
      imageUrl: detail.coach.imageUrl,
      wikipediaUrl: detail.coach.wikipediaUrl,
      wikidataId: detail.coach.wikidataId,
      sourceUrl: detail.coach.sourceUrl,
      publishStatus: detail.coach.publishStatus,
      isPublic: detail.coach.isPublic,
      careerRecordPartial: detail.coach.careerRecordPartial,
      careerRecordNotes: detail.coach.careerRecordNotes,
      calcStatus: detail.coach.calcStatus,
      lastVerifiedAt: detail.coach.lastVerifiedAt,
    },
    currentRole: current
      ? {
          role: current.role,
          roleLabel: current.roleLabel,
          teamName: current.teamName,
          teamId: current.teamId,
          startDate: current.startDate,
          endDate: current.endDate,
          missingCrest: current.missingCrest,
        }
      : null,
    assignments: detail.assignments.map((a) => ({
      id: a.id,
      teamId: a.teamId,
      teamName: a.teamName,
      role: a.role,
      roleLabel: a.roleLabel,
      startDate: a.startDate,
      endDate: a.endDate,
      isCurrent: a.isCurrent,
      eligibleForCareerRecord: a.eligibleForCareerRecord,
      recordStatus: a.recordStatus,
      showOnOverview: a.showOnOverview,
      missingCrest: a.missingCrest,
      sourceUrl: a.sourceUrl,
    })),
    playingHistory: playing.map((p) => ({
      id: p.id,
      yearsLabel: p.yearsLabel,
      teamName: p.teamName,
      teamDisplayName: p.teamDisplayName,
      teamType: p.teamType,
      careerType: p.careerType,
      competitionLevel: p.competitionLevel,
      teamId: p.teamId,
      apps: p.apps,
      points: p.points,
      position: p.position,
      showOnOverview: p.showOnOverview,
      recordStatus: p.recordStatus,
      sourceUrl: p.sourceUrl,
    })),
    honours: honours.map((h) => ({
      id: h.id,
      year: h.year,
      competitionName: h.competitionName,
      teamName: h.teamName,
      achievementType: h.achievementType,
      honourLevel: h.honourLevel,
      roleType: h.roleType,
    })),
    awards: awards.map((a) => ({
      id: a.id,
      year: a.year,
      awardName: a.awardName,
      awardingBody: a.awardingBody,
      result: a.result,
    })),
    medals: medals.map((m) => ({
      id: m.id,
      year: m.year,
      competitionName: m.competitionName,
      finish: m.finish,
      medalType: m.medalType,
      teamName: m.teamName,
    })),
    careerRecord: career,
    impact,
    ratings,
    selectionStability: selection,
    playerDevelopment: development,
    dataCoverage: coverage,
    cmsCompleteness: completeness,
    retrievedSources: {
      wikipedia: wiki.archive,
    },
    sourcesUsed,
  };
}

function buildRuleFindings(
  snapshot: Awaited<ReturnType<typeof buildCoachProfileCheckSnapshot>>,
): CoachProfileFinding[] {
  const findings: CoachProfileFinding[] = [];
  const c = snapshot.coach;

  const push = (f: Omit<CoachProfileFinding, "id"> & { id?: string }) => {
    findings.push({
      id: f.id ?? f.field,
      ...f,
    });
  };

  if (!c.birthDate) {
    push({
      field: "birthDate",
      label: "Date of birth",
      issueType: "MISSING",
      severity: "HIGH",
      suggestionClass: "VERIFIED FACT",
      currentValue: null,
      foundValue: snapshot.retrievedSources.wikipedia?.birthDate ?? null,
      sources: snapshot.retrievedSources.wikipedia?.birthDate ? ["Wikipedia"] : [],
      confidence: snapshot.retrievedSources.wikipedia?.birthDate ? "MEDIUM" : "LOW",
      rationale: "DOB missing from CMS identity.",
      recommendedAction: snapshot.retrievedSources.wikipedia?.birthDate ? "ACCEPT" : "CHECK SOURCE",
    });
  } else if (
    snapshot.retrievedSources.wikipedia?.birthDate &&
    String(snapshot.retrievedSources.wikipedia.birthDate) !== String(c.birthDate)
  ) {
    push({
      field: "birthDate",
      label: "Date of birth",
      issueType: "CONFLICT",
      severity: "HIGH",
      suggestionClass: "VERIFIED FACT",
      currentValue: c.birthDate,
      foundValue: snapshot.retrievedSources.wikipedia.birthDate,
      sources: ["Wikipedia"],
      confidence: "MEDIUM",
      rationale: "CMS DOB differs from retrieved Wikipedia value.",
      recommendedAction: "CHECK SOURCE",
    });
  } else {
    push({
      field: "birthDate",
      label: "Date of birth",
      issueType: "VERIFIED",
      severity: "LOW",
      suggestionClass: "VERIFIED FACT",
      currentValue: c.birthDate,
      foundValue: c.birthDate,
      sources: ["Rugby365 CMS"],
      confidence: "HIGH",
      rationale: "Present in CMS.",
      recommendedAction: "NO CHANGE",
    });
  }

  if (!c.imageUrl) {
    push({
      field: "imageUrl",
      label: "Coach photo",
      issueType: "IMAGE ISSUE",
      severity: "HIGH",
      suggestionClass: "EDITORIAL TEXT",
      currentValue: null,
      foundValue: null,
      sources: ["Rugby365 CMS"],
      confidence: "HIGH",
      rationale: "No primary coach image.",
      recommendedAction: "REFRESH DATA",
    });
  }

  const missingCrests = snapshot.assignments.filter((a) => a.missingCrest);
  for (const a of missingCrests.slice(0, 8)) {
    push({
      id: `crest-${a.id}`,
      field: "crest",
      label: `${a.teamName} crest`,
      issueType: "IMAGE ISSUE",
      severity: "MEDIUM",
      suggestionClass: "VERIFIED FACT",
      currentValue: "Missing",
      foundValue: null,
      sources: ["Rugby365 CMS"],
      confidence: "HIGH",
      rationale: `No crest linked for ${a.teamName} assignment.`,
      recommendedAction: "LINK EXISTING CREST",
    });
  }

  if (snapshot.playingHistory.length === 0) {
    push({
      field: "playingHistory",
      label: "Playing history",
      issueType: "MISSING",
      severity: "MEDIUM",
      suggestionClass: "VERIFIED FACT",
      currentValue: [],
      foundValue: snapshot.retrievedSources.wikipedia?.playingCareer ?? null,
      sources: snapshot.retrievedSources.wikipedia ? ["Wikipedia"] : [],
      confidence: "MEDIUM",
      rationale: "MISSING PLAYING HISTORY in CMS.",
      recommendedAction: snapshot.retrievedSources.wikipedia?.playingCareer?.length
        ? "ACCEPT"
        : "CHECK SOURCE",
    });
  } else {
    for (const p of snapshot.playingHistory) {
      if (!p.teamId) {
        push({
          id: `play-team-${p.id}`,
          field: "playingHistory",
          label: `${p.teamName} (${p.yearsLabel})`,
          issueType: "TEAM LINK ISSUE",
          severity: "MEDIUM",
          suggestionClass: "VERIFIED FACT",
          currentValue: p.teamName,
          foundValue: null,
          sources: ["Rugby365 CMS"],
          confidence: "HIGH",
          rationale: "MISSING TEAM LINK — playing career row has no team_id for crest resolution.",
          recommendedAction: "LINK EXISTING TEAM",
        });
      }
      if (!p.sourceUrl && p.recordStatus !== "verified") {
        push({
          id: `play-source-${p.id}`,
          field: "playingHistory",
          label: `${p.teamName} (${p.yearsLabel})`,
          issueType: "SOURCE MISSING",
          severity: "LOW",
          suggestionClass: "VERIFIED FACT",
          currentValue: p.recordStatus,
          foundValue: null,
          sources: ["Rugby365 CMS"],
          confidence: "MEDIUM",
          rationale: "Playing career row has no source URL — CHECK SOURCE before verifying.",
          recommendedAction: "CHECK SOURCE",
        });
      }
    }

    // Duplicate detection: same teamType + overlapping yearsLabel/teamName
    const seen = new Map<string, string>();
    for (const p of snapshot.playingHistory) {
      if (p.competitionLevel === "timeline_summary" || p.competitionLevel === "summary") continue;
      const key = `${p.teamType}|${(p.teamName || "").toLowerCase()}|${p.yearsLabel}`;
      if (seen.has(key)) {
        push({
          id: `play-dup-${p.id}`,
          field: "playingHistory",
          label: `${p.teamName} (${p.yearsLabel})`,
          issueType: "POSSIBLE DUPLICATE",
          severity: "MEDIUM",
          suggestionClass: "VERIFIED FACT",
          currentValue: p.id,
          foundValue: seen.get(key),
          sources: ["Rugby365 CMS"],
          confidence: "HIGH",
          rationale: "DUPLICATE playing career rows with the same team/years — merge or hide the summary row.",
          recommendedAction: "EDIT",
        });
      } else {
        seen.set(key, p.id);
      }
    }
  }

  if (snapshot.honours.length === 0 && snapshot.awards.length === 0) {
    push({
      field: "honours",
      label: "Honours & awards",
      issueType: "MISSING",
      severity: "MEDIUM",
      suggestionClass: "VERIFIED FACT",
      currentValue: 0,
      foundValue: null,
      sources: [],
      confidence: "MEDIUM",
      rationale: "No honours or awards recorded.",
      recommendedAction: "CHECK SOURCE",
    });
  }

  if (!snapshot.currentRole) {
    push({
      field: "currentRole",
      label: "Current role",
      issueType: "TEAM LINK ISSUE",
      severity: "HIGH",
      suggestionClass: "VERIFIED FACT",
      currentValue: null,
      foundValue: null,
      sources: ["Rugby365 CMS"],
      confidence: "HIGH",
      rationale: "No current team assignment marked.",
      recommendedAction: "EDIT",
    });
  }

  const cov = snapshot.dataCoverage;
  if (cov.lineups.have < Math.min(5, cov.lineups.of) || !snapshot.selectionStability?.enoughData) {
    push({
      field: "selectionStability",
      label: "Selection Stability",
      issueType: "CALCULATION GAP",
      severity: "MEDIUM",
      suggestionClass: "CALCULATED DATA",
      currentValue: `${cov.lineups.have} / ${cov.lineups.of} lineups`,
      foundValue: null,
      sources: ["Rugby365 CMS"],
      confidence: "HIGH",
      rationale: "Insufficient verified lineups for selection stability.",
      recommendedAction: "REFRESH DATA",
    });
  }

  if (
    cov.playerRatings.have < Math.min(5, cov.playerRatings.of) ||
    !snapshot.playerDevelopment?.enoughData
  ) {
    const missing = Math.max(0, cov.playerRatings.of - cov.playerRatings.have);
    push({
      field: "playerDevelopment",
      label: "Player Development",
      issueType: "CALCULATION GAP",
      severity: "MEDIUM",
      suggestionClass: "CALCULATED DATA",
      currentValue: `${cov.playerRatings.have} / ${cov.playerRatings.of} rated matches`,
      foundValue: null,
      sources: ["Rugby365 CMS"],
      confidence: "HIGH",
      rationale:
        missing > 0
          ? `Player Development is weak because ${missing} eligible matches have no player ratings.`
          : "Insufficient historical player ratings under this coach.",
      recommendedAction: "BACKFILL PLAYER RATINGS",
    });
  }

  if (cov.teamStats.have < cov.teamStats.of) {
    const missing = cov.teamStats.of - cov.teamStats.have;
    push({
      field: "teamStats",
      label: "Team match stats",
      issueType: "CALCULATION GAP",
      severity: "MEDIUM",
      suggestionClass: "CALCULATED DATA",
      currentValue: `${cov.teamStats.have} / ${cov.teamStats.of}`,
      foundValue: null,
      sources: ["Rugby365 CMS"],
      confidence: "HIGH",
      rationale:
        cov.teamStats.have === 0
          ? "Verified tenure windows include matches with no team stats."
          : `${missing} eligible matches have no team match stats.`,
      recommendedAction: "BACKFILL TEAM STATS",
    });
  }

  if (cov.historicalRankings.have < cov.historicalRankings.of) {
    push({
      field: "historicalRankings",
      label: "Historical rankings",
      issueType: "CALCULATION GAP",
      severity: "MEDIUM",
      suggestionClass: "CALCULATED DATA",
      currentValue: `${cov.historicalRankings.have} / ${cov.historicalRankings.of}`,
      foundValue: null,
      sources: ["World Rugby rankings"],
      confidence: "HIGH",
      rationale: `Historical opponent/team ranking coverage is ${cov.historicalRankings.have}/${cov.historicalRankings.of}. Do not use today's ranking as a historic substitute.`,
      recommendedAction: "BACKFILL HISTORICAL RANKINGS",
    });
  }

  if (cov.calcStatus === "stale" || cov.calcStatus === "partial") {
    push({
      field: "rating",
      label: "Coach rating / Power Index",
      issueType: cov.calcStatus === "stale" ? "OUTDATED" : "CALCULATION GAP",
      severity: "MEDIUM",
      suggestionClass: "CALCULATED DATA",
      currentValue: snapshot.ratings?.overallRating ?? null,
      foundValue: null,
      sources: ["Rugby365 CMS"],
      confidence: "HIGH",
      rationale:
        cov.calcStatus === "stale"
          ? "Calculated data marked stale — recalculate after underlying match data changes."
          : `Partial career coverage (${cov.careerMatches} matches; lineups ${cov.lineups.have}/${cov.lineups.of}; team stats ${cov.teamStats.have}/${cov.teamStats.of}; ratings ${cov.playerRatings.have}/${cov.playerRatings.of}; hist rankings ${cov.historicalRankings.have}/${cov.historicalRankings.of}). Rating confidence ${cov.ratingConfidencePct}%.`,
      recommendedAction: "RECALCULATE",
    });
  }

  const intelligence = snapshot.ratings?.intelligence ?? [];
  for (const m of intelligence) {
    if (m.status === "INSUFFICIENT" || m.score == null) {
      push({
        id: `intel-${m.key}`,
        field: `intelligence.${m.key}`,
        label: m.label,
        issueType: "CALCULATION GAP",
        severity: "MEDIUM",
        suggestionClass: "CALCULATED DATA",
        currentValue: m.score,
        foundValue: null,
        sources: ["Rugby365 CoachIntelligenceEngine"],
        confidence: "HIGH",
        rationale:
          m.missingInputs.length > 0
            ? `${m.label} is blank because coverage is ${m.dataCoverage}% (${m.sampleSize} matches). Missing inputs: ${m.missingInputs.join(", ")}.`
            : `${m.label} cannot be calculated yet — data coverage ${m.dataCoverage}% across ${m.sampleSize} matches.`,
        recommendedAction: "REFRESH DATA",
      });
    } else if (m.status === "PARTIAL" && m.dataCoverage < 80) {
      push({
        id: `intel-partial-${m.key}`,
        field: `intelligence.${m.key}`,
        label: m.label,
        issueType: "CALCULATION GAP",
        severity: "LOW",
        suggestionClass: "CALCULATED DATA",
        currentValue: m.score,
        foundValue: null,
        sources: ["Rugby365 CoachIntelligenceEngine"],
        confidence: "MEDIUM",
        rationale: `${m.label} is calculated at ${m.score} with ${m.confidence}% confidence from ${m.sampleSize} matches (${m.dataCoverage}% coverage). Available: ${m.availableInputs.join(", ") || "partial components"}.`,
        recommendedAction: "NO CHANGE",
      });
    }
  }

  const powerDetail = snapshot.ratings?.powerIndexDetail;
  const powerMismatches = snapshot.ratings?.powerIndexMismatches ?? [];
  if (powerMismatches.length > 0) {
    push({
      id: "power-intelligence-mismatch",
      field: "power_index",
      label: "POWER INDEX HEALTH",
      issueType: "CALCULATION GAP",
      severity: "HIGH",
      suggestionClass: "CALCULATED DATA",
      currentValue: snapshot.ratings?.powerIndex ?? null,
      foundValue: null,
      sources: ["Rugby365 CoachPowerIndexEngine"],
      confidence: "HIGH",
      rationale: `INTELLIGENCE SCORE MISMATCH — Power Index inputs disagree with Coach Intelligence for: ${powerMismatches
        .map(
          (m: { key: string; intelligenceScore: number; powerIndexScore: number }) =>
            `${m.key} (intel ${m.intelligenceScore} vs PI ${m.powerIndexScore})`,
        )
        .join("; ")}. There must be one source of truth per metric. OpenAI diagnoses only — it does not set the Power Index.`,
      recommendedAction: "RECALCULATE",
    });
  } else if (powerDetail && !powerDetail.publishable) {
    push({
      id: "power-insufficient",
      field: "power_index",
      label: "POWER INDEX HEALTH",
      issueType: "CALCULATION GAP",
      severity: "MEDIUM",
      suggestionClass: "CALCULATED DATA",
      currentValue: snapshot.ratings?.powerIndex ?? null,
      foundValue: null,
      sources: ["Rugby365 CoachPowerIndexEngine"],
      confidence: "HIGH",
      rationale: `Power Index coverage ${powerDetail.weightedCoverage}% is below the 60% publish threshold (confidence ${powerDetail.confidence}%, ${powerDetail.matchesUsed} matches). Excluded: ${powerDetail.excludedKeys.join(", ") || "none"}.`,
      recommendedAction: "REFRESH DATA",
    });
  } else if (powerDetail && powerDetail.confidence < 75) {
    push({
      id: "power-confidence",
      field: "power_index",
      label: "POWER INDEX HEALTH",
      issueType: "CALCULATION GAP",
      severity: "LOW",
      suggestionClass: "CALCULATED DATA",
      currentValue: snapshot.ratings?.powerIndex ?? null,
      foundValue: null,
      sources: ["Rugby365 CoachPowerIndexEngine"],
      confidence: "MEDIUM",
      rationale: `Power Index ${snapshot.ratings?.powerIndex ?? "—"} has confidence ${powerDetail.confidence}% (${powerDetail.confidenceBand}) with weighted coverage ${powerDetail.weightedCoverage}% across ${powerDetail.matchesUsed} matches. OpenAI diagnoses only — it does not set the Power Index.`,
      recommendedAction: "REFRESH DATA",
    });
  }

  if (c.contractExpiresOn) {
    push({
      field: "contractExpiresOn",
      label: "Contract",
      issueType: "VERIFIED",
      severity: "LOW",
      suggestionClass: "VERIFIED FACT",
      currentValue: c.contractExpiresOn,
      foundValue: c.contractExpiresOn,
      sources: ["Rugby365 CMS"],
      confidence: "MEDIUM",
      rationale: "Contract present in CMS (cross-source live verify not run this check).",
      recommendedAction: "NO CHANGE",
    });
  }

  return findings;
}

function ruleHealth(
  snapshot: Awaited<ReturnType<typeof buildCoachProfileCheckSnapshot>>,
  findings: CoachProfileFinding[],
): CoachProfileCheckReport {
  const sections: CoachProfileHealthSection[] = snapshot.cmsCompleteness.sections.map((s) => ({
    id: s.id,
    label: s.label,
    score: s.score,
  }));
  const missing = findings.filter((f) => f.issueType === "MISSING").length;
  const conflicts = findings.filter((f) => f.issueType === "CONFLICT").length;
  const improvements = findings.filter(
    (f) => f.issueType === "EDITORIAL SUGGESTION" || f.recommendedAction === "ACCEPT",
  ).length;
  const missingCrest = findings.filter(
    (f) => f.field === "crest" || f.label.toLowerCase().includes("crest"),
  ).length;
  const verified = findings.filter((f) => f.issueType === "VERIFIED").length;
  const calculationGaps = findings.filter((f) => f.issueType === "CALCULATION GAP").length;

  const nextBestActions: string[] = [];
  const cov = snapshot.dataCoverage;
  if (cov.teamStats.have < cov.teamStats.of) nextBestActions.push("BACKFILL TEAM STATS");
  if (cov.playerRatings.have < cov.playerRatings.of) nextBestActions.push("BACKFILL PLAYER RATINGS");
  if (cov.historicalRankings.have < cov.historicalRankings.of) {
    nextBestActions.push("BACKFILL HISTORICAL RANKINGS");
  }
  if (cov.lineups.have < cov.lineups.of) {
    nextBestActions.push("Backfill missing match lineups for tenure windows");
  }
  if (missingCrest) nextBestActions.push("Link missing team crests from Rugby365 assets");
  if (snapshot.honours.length === 0) nextBestActions.push("Check Wikipedia honours and accept verified trophies");
  if (snapshot.playingHistory.length === 0) nextBestActions.push("Add structured playing career from Wikipedia");
  if (cov.calcStatus === "stale" || cov.partialCareerRecord) {
    nextBestActions.push("Recalculate coach stats and rating after backfill");
  }
  if (!snapshot.coach.bioSummary?.trim()) nextBestActions.push("Generate / review full biography");

  return {
    profileHealth: snapshot.cmsCompleteness.percent,
    sections,
    summary: {
      headline: `Rule pre-check: ${missing} missing · ${conflicts} conflicts · ${calculationGaps} calculation gaps`,
      missing,
      conflicts,
      improvements,
      missingCrest,
      verified,
      calculationGaps,
    },
    findings,
    nextBestActions,
    sourcesUsed: snapshot.sourcesUsed,
    checkedAt: new Date().toISOString(),
    model: "rule-precheck",
    scope: snapshot.scope,
  };
}

function normalizeAiReport(
  raw: Record<string, unknown>,
  fallback: CoachProfileCheckReport,
  model: string,
  scope: CoachProfileCheckScope,
  sourcesUsed: CoachProfileCheckReport["sourcesUsed"],
): CoachProfileCheckReport {
  const findingsRaw = asArray<Record<string, unknown>>(raw.findings);
  const findings: CoachProfileFinding[] =
    findingsRaw.length > 0
      ? findingsRaw.map((f, i) => ({
          id: String(f.id ?? f.field ?? `finding-${i}`),
          field: String(f.field ?? "unknown"),
          label: String(f.label ?? f.field ?? "Field"),
          issueType: (String(f.issueType ?? "UNVERIFIED").toUpperCase() as CoachIssueType) || "UNVERIFIED",
          severity: (String(f.severity ?? "MEDIUM").toUpperCase() as "HIGH" | "MEDIUM" | "LOW") || "MEDIUM",
          suggestionClass:
            (String(f.suggestionClass ?? "EDITORIAL TEXT").toUpperCase() as CoachSuggestionClass) ||
            "EDITORIAL TEXT",
          currentValue: f.currentValue ?? null,
          foundValue: f.foundValue ?? null,
          sources: asArray<string>(f.sources).map(String),
          confidence:
            (String(f.confidence ?? "MEDIUM").toUpperCase() as "HIGH" | "MEDIUM" | "LOW") || "MEDIUM",
          rationale: String(f.rationale ?? ""),
          recommendedAction: (String(f.recommendedAction ?? "KEEP CURRENT").toUpperCase() as CoachProfileFinding["recommendedAction"]) ||
            "KEEP CURRENT",
        }))
      : fallback.findings;

  const sectionsRaw = asArray<Record<string, unknown>>(raw.sections);
  const sections =
    sectionsRaw.length > 0
      ? sectionsRaw.map((s) => ({
          id: String(s.id ?? "section"),
          label: String(s.label ?? s.id ?? "Section"),
          score: clampScore(s.score, 0),
        }))
      : fallback.sections;

  const summaryRaw = (raw.summary ?? {}) as Record<string, unknown>;
  const missing = Number(summaryRaw.missing ?? findings.filter((f) => f.issueType === "MISSING").length);
  const conflicts = Number(
    summaryRaw.conflicts ?? findings.filter((f) => f.issueType === "CONFLICT").length,
  );
  const improvements = Number(summaryRaw.improvements ?? 0);
  const missingCrest = Number(summaryRaw.missingCrest ?? 0);
  const verified = Number(
    summaryRaw.verified ?? findings.filter((f) => f.issueType === "VERIFIED").length,
  );
  const calculationGaps = Number(
    summaryRaw.calculationGaps ??
      findings.filter((f) => f.issueType === "CALCULATION GAP").length,
  );

  return {
    profileHealth: clampScore(raw.profileHealth, fallback.profileHealth),
    sections,
    summary: {
      headline: String(
        summaryRaw.headline ??
          `PROFILE CHECK COMPLETE · ${missing} missing · ${conflicts} conflicts · ${improvements} improvements`,
      ),
      missing,
      conflicts,
      improvements,
      missingCrest,
      verified,
      calculationGaps,
    },
    findings,
    nextBestActions: asArray<string>(raw.nextBestActions).map(String).slice(0, 12),
    sourcesUsed,
    checkedAt: new Date().toISOString(),
    model,
    scope,
  };
}

export async function runCoachOpenAiProfileCheck(
  coachId: string,
  options: { scope?: CoachProfileCheckScope } = {},
): Promise<CoachProfileCheckResult> {
  const scope = options.scope ?? "full";
  const snapshot = await buildCoachProfileCheckSnapshot(coachId, scope);
  const ruleFindings = buildRuleFindings(snapshot);
  const ruleReport = ruleHealth(snapshot, ruleFindings);

  const model = await getOpenAiModel();
  const userPrompt = `Audit this coach CMS profile.
Scope: ${scope}
Never invent sources. Only use retrievedSources where retrieved=true.
Valid overlapping roles are allowed.

CMS + evidence snapshot JSON:
${JSON.stringify(snapshot, null, 2)}

Rule-based pre-check JSON:
${JSON.stringify(ruleReport, null, 2)}`;

  let report = ruleReport;
  try {
    const rawText = await chatCompletion({
      system: SYSTEM,
      user: userPrompt,
      json: true,
      maxTokens: 3500,
    });
    const parsed = parseJsonObject<Record<string, unknown>>(rawText, {});
    report = normalizeAiReport(parsed, ruleReport, model, scope, snapshot.sourcesUsed);
  } catch (e) {
    // Keep rule report if OpenAI unavailable; surface note in headline
    report = {
      ...ruleReport,
      model,
      summary: {
        ...ruleReport.summary,
        headline: `${ruleReport.summary.headline} · OpenAI unavailable: ${
          e instanceof Error ? e.message.slice(0, 120) : "error"
        }`,
      },
    };
  }

  const db = getDb();
  const [row] = await db
    .insert(aiVerificationReports)
    .values({
      entityType: "coach",
      entityId: coachId,
      model: report.model,
      promptSystem: SYSTEM,
      promptUser: userPrompt.slice(0, 100_000),
      sourceSnapshot: snapshot,
      report,
      confidenceScore: report.profileHealth / 100,
    })
    .returning();

  return {
    reportId: row.id,
    report,
    snapshot: snapshot as unknown as Record<string, unknown>,
  };
}

export async function listCoachOpenAiProfileChecks(coachId: string, limit = 10) {
  const db = getDb();
  return db
    .select({
      id: aiVerificationReports.id,
      model: aiVerificationReports.model,
      createdAt: aiVerificationReports.createdAt,
      confidenceScore: aiVerificationReports.confidenceScore,
      report: aiVerificationReports.report,
      status: aiVerificationReports.status,
    })
    .from(aiVerificationReports)
    .where(
      and(
        eq(aiVerificationReports.entityType, "coach"),
        eq(aiVerificationReports.entityId, coachId),
      ),
    )
    .orderBy(desc(aiVerificationReports.createdAt))
    .limit(limit);
}

export async function getCoachOpenAiProfileCheck(reportId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(aiVerificationReports)
    .where(eq(aiVerificationReports.id, reportId))
    .limit(1);
  return row ?? null;
}
