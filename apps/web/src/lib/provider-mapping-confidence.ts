import type {
  ConfidenceInput,
  ConfidenceResult,
  MappingEntityType,
  MatchReason,
} from "./provider-mapping-types";

/**
 * Non-AI confidence bands (from Phase 2 audit):
 * 95–100 exact confirmed ID
 * 80–94 exact normalised name + same competition + unique
 * 60–79 strong alias / nickname / token-sort + context
 * 40–59 name-only unique
 * <40 ambiguous → manual
 */
export function scoreMappingConfidence(input: ConfidenceInput): ConfidenceResult {
  const candidates = input.candidateCount ?? 1;

  if (input.exactExternalIdMatch) {
    return result(98, { rule: "exact_external_id" }, input.entityType, {
      requiresManualReview: false,
      blockAutoConfirm: false,
      blockAutoCreate: false,
    });
  }

  if (candidates > 1) {
    return result(
      25,
      { rule: "ambiguous_candidates", details: `${candidates} candidates` },
      input.entityType,
      { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: true },
    );
  }

  if (input.entityType === "match") {
    return scoreMatch(input);
  }

  if (input.entityType === "player") {
    return scorePlayer(input);
  }

  if (input.entityType === "team") {
    return scoreTeam(input);
  }

  if (input.entityType === "competition") {
    return scoreCompetition(input);
  }

  return scoreGenericName(input);
}

function scoreMatch(input: ConfidenceInput): ConfidenceResult {
  const kickoffOk =
    input.kickoffWithinMinutes != null && input.kickoffWithinMinutes <= 120;

  if (
    input.sameCompetition &&
    input.sameSeason &&
    input.sameTeams &&
    kickoffOk
  ) {
    return result(
      92,
      {
        rule: "match_comp_season_teams_kickoff",
        context: { kickoffWithinMinutes: input.kickoffWithinMinutes },
      },
      "match",
      { requiresManualReview: false, blockAutoConfirm: false, blockAutoCreate: false },
    );
  }

  if (input.sameCompetition && input.sameTeams && kickoffOk) {
    return result(
      78,
      { rule: "match_comp_teams_kickoff_missing_season" },
      "match",
      { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: false },
    );
  }

  if (input.normalisedNameMatch && input.nameUniqueInScope) {
    return result(
      45,
      { rule: "match_name_only" },
      "match",
      { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: true },
    );
  }

  return result(
    20,
    { rule: "match_insufficient_context" },
    "match",
    { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: true },
  );
}

function scorePlayer(input: ConfidenceInput): ConfidenceResult {
  const identitySignals =
    Number(Boolean(input.dobMatch)) +
    Number(Boolean(input.nationalityMatch)) +
    Number(Boolean(input.positionMatch)) +
    Number(Boolean(input.sameCompetition || input.sameCountry));

  if (input.normalisedNameMatch && input.dobMatch && input.nameUniqueInScope) {
    return result(
      90,
      { rule: "player_name_dob_unique" },
      "player",
      { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: false },
    );
  }

  if (
    (input.normalisedNameMatch || input.aliasOrNicknameMatch || input.tokenSortMatch) &&
    identitySignals >= 2 &&
    input.nameUniqueInScope
  ) {
    return result(
      72,
      { rule: "player_name_plus_identity_context", context: { identitySignals } },
      "player",
      { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: false },
    );
  }

  if (input.normalisedNameMatch && input.nameUniqueInScope) {
    return result(
      48,
      { rule: "player_name_only" },
      "player",
      { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: true },
    );
  }

  return result(
    18,
    { rule: "player_insufficient_identity" },
    "player",
    { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: true },
  );
}

function scoreTeam(input: ConfidenceInput): ConfidenceResult {
  if (
    input.normalisedNameMatch &&
    input.sameCompetition &&
    (input.sameCountry || input.sameSeason) &&
    input.nameUniqueInScope
  ) {
    return result(
      88,
      { rule: "team_name_comp_context_unique" },
      "team",
      { requiresManualReview: false, blockAutoConfirm: false, blockAutoCreate: false },
    );
  }

  if (
    (input.aliasOrNicknameMatch || input.tokenSortMatch) &&
    input.sameCompetition &&
    input.nameUniqueInScope
  ) {
    return result(
      68,
      { rule: "team_alias_comp_unique" },
      "team",
      { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: false },
    );
  }

  if (input.normalisedNameMatch && input.nameUniqueInScope) {
    return result(
      42,
      { rule: "team_name_only" },
      "team",
      { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: true },
    );
  }

  return result(
    22,
    { rule: "team_insufficient_context" },
    "team",
    { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: true },
  );
}

function scoreCompetition(input: ConfidenceInput): ConfidenceResult {
  if (input.normalisedNameMatch && input.sameCountry && input.nameUniqueInScope) {
    return result(
      70,
      { rule: "competition_name_country_unique" },
      "competition",
      { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: true },
    );
  }

  if (input.normalisedNameMatch && input.nameUniqueInScope) {
    return result(
      40,
      { rule: "competition_name_only" },
      "competition",
      { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: true },
    );
  }

  return result(
    15,
    { rule: "competition_insufficient" },
    "competition",
    { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: true },
  );
}

function scoreGenericName(input: ConfidenceInput): ConfidenceResult {
  if (input.normalisedNameMatch && input.nameUniqueInScope && input.sameCompetition) {
    return result(
      82,
      { rule: "name_comp_unique" },
      input.entityType,
      { requiresManualReview: false, blockAutoConfirm: false, blockAutoCreate: false },
    );
  }

  if (
    (input.aliasOrNicknameMatch || input.tokenSortMatch) &&
    input.nameUniqueInScope
  ) {
    return result(
      65,
      { rule: "alias_or_token_unique" },
      input.entityType,
      { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: false },
    );
  }

  if (input.normalisedNameMatch && input.nameUniqueInScope) {
    return result(
      50,
      { rule: "name_only_unique" },
      input.entityType,
      { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: false },
    );
  }

  return result(
    20,
    { rule: "insufficient_match" },
    input.entityType,
    { requiresManualReview: true, blockAutoConfirm: true, blockAutoCreate: true },
  );
}

function result(
  confidence: number,
  matchReason: MatchReason,
  entityType: MappingEntityType,
  flags: {
    requiresManualReview: boolean;
    blockAutoConfirm: boolean;
    blockAutoCreate: boolean;
  },
): ConfidenceResult {
  const gated = applyHardGates(entityType, confidence, matchReason.rule, flags);
  const suggestedStatus =
    confidence < 40 || gated.requiresManualReview
      ? confidence < 40
        ? "unmapped"
        : "suggested"
      : "suggested";

  return {
    confidence,
    matchReason,
    suggestedStatus: suggestedStatus as ConfidenceResult["suggestedStatus"],
    ...gated,
  };
}

/**
 * Hard gates from the upgrade brief:
 * - Never auto-create a competition from a name-only match
 * - Never auto-confirm a player from a name-only match
 * - Never merge two players without review (always block auto-confirm merges elsewhere)
 * - Team matching must use competition and country context
 * - Match mapping should use competition, season, teams and kick-off
 */
export function applyHardGates(
  entityType: MappingEntityType,
  confidence: number,
  rule: string,
  flags: {
    requiresManualReview: boolean;
    blockAutoConfirm: boolean;
    blockAutoCreate: boolean;
  },
): {
  requiresManualReview: boolean;
  blockAutoConfirm: boolean;
  blockAutoCreate: boolean;
} {
  let { requiresManualReview, blockAutoConfirm, blockAutoCreate } = flags;

  if (entityType === "competition") {
    blockAutoCreate = true;
    if (rule === "competition_name_only" || rule.includes("name_only")) {
      blockAutoConfirm = true;
      requiresManualReview = true;
    }
  }

  if (entityType === "player") {
    if (rule === "player_name_only" || rule.includes("name_only")) {
      blockAutoConfirm = true;
      requiresManualReview = true;
    }
    // Player merges are never automatic — confirm mapping is allowed only via CMS action.
    if (confidence < 95) {
      blockAutoConfirm = true;
      requiresManualReview = true;
    }
  }

  if (entityType === "team" && (rule === "team_name_only" || !rule.includes("comp"))) {
    if (rule === "team_name_only" || rule === "team_insufficient_context") {
      blockAutoConfirm = true;
      requiresManualReview = true;
      blockAutoCreate = true;
    }
  }

  if (entityType === "match" && confidence < 90) {
    blockAutoConfirm = true;
    requiresManualReview = true;
  }

  return { requiresManualReview, blockAutoConfirm, blockAutoCreate };
}

/** Whether a confidence result may be written as status=confirmed without a human. */
export function mayAutoConfirm(result: ConfidenceResult): boolean {
  return (
    !result.blockAutoConfirm &&
    !result.requiresManualReview &&
    result.confidence >= 90 &&
    result.suggestedStatus === "suggested"
  );
}

/** Whether sync may create a new Rugby365 entity from this suggestion. */
export function mayAutoCreate(result: ConfidenceResult): boolean {
  return !result.blockAutoCreate && result.confidence >= 80;
}
