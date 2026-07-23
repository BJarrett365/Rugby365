"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TableLabMetaPanel, TableLabResultsTable } from "@/components/admin/TableLabPanels";
import { PageHeader } from "@/components/shell/PageHeader";
import { defaultCompetitionId } from "@/lib/competition-list-utils";
import {
  DEFAULT_FORM_MATCH_COUNT,
  FORM_MATCH_COUNT_PRESETS,
  isPresetFormMatchCount,
  parseFormMatchCount,
  parseMinMatchesPlayed,
  parseCalendarYear,
  parseLiveTableBoolean,
  parseIncludeExtraTime,
  parseOppositionPositionRule,
  parsePointsLostWinningSortBy,
  parseWinningPositionFilter,
  type PointsLostWinningSortBy,
  type WinningPositionFilter,
  parseLosingPositionFilter,
  parsePointsGainedLosingSortBy,
  type LosingPositionFilter,
  type PointsGainedLosingSortBy,
  parseComebackFromFilter,
  parseComebackSortBy,
  parseMinimumDeficitPoints,
  parseMinimumDeficitPreset,
  type ComebackFromFilter,
  type ComebackSortBy,
  type MinimumDeficitPreset,
  parseLeadPositionFilter,
  parseLeadProtectionSortBy,
  parseMinimumLeadPoints,
  parseMinimumLeadPreset,
  type LeadPositionFilter,
  type LeadProtectionSortBy,
  type MinimumLeadPreset,
  parseTriesMatchRangeCount,
  parseTriesMatchRangePreset,
  parseTriesScoredPeriod,
  parseTriesScoredSortBy,
  type TriesMatchRangePreset,
  type TriesScoredPeriod,
  type TriesScoredSortBy,
  parseTriesConcededSortBy,
  type TriesConcededSortBy,
  parseBothTeamsScoredTriesSortBy,
  type BothTeamsScoredTriesSortBy,
  parseWinningBonusPointsSortBy,
  parseWinningBonusTypeFilter,
  type WinningBonusPointsSortBy,
  type WinningBonusTypeFilter,
  parseConcedingFirstSortBy,
  type ConcedingFirstSortBy,
  parseFirstScoreTypeFilter,
  parseScoringFirstSortBy,
  type ScoringFirstSortBy,
  parseAllTimeSeasonRangeMode,
  parseAllTimeSortBy,
  parseAllTimeTeamStatus,
  parseSeasonYearParam,
} from "@/lib/table-lab/table-lab-param-parsers";
import {
  parseAsOfDateParam,
  shiftDateOnly,
  defaultBetweenDatesRange,
  parseDateOnlyParam,
} from "@/lib/table-lab/table-date-utils";
import type { FirstScoreTypeFilter } from "@/lib/table-lab/first-score-utils";
import type {
  AllTimePremiershipSortBy,
  AllTimeSeasonRangeMode,
  AllTimeTeamStatus,
  OppositionPositionRule,
} from "@/lib/table-lab/table-types";
import { tableIdFromTypeParam } from "@/lib/table-lab/table-view-utils";
import { rugbyTableCategories } from "@/lib/table-lab/table-definition-service";
import { TABLE_LAB_CATEGORY_LABELS } from "@/lib/table-lab/table-lab-guide";
import type {
  HemisphereMatchType,
  HemisphereTableMode,
  RugbyTableDefinition,
  RugbyTableView,
} from "@/lib/table-lab/table-types";
import type { RugbyTableResult } from "@/lib/table-lab/table-types";

type CompetitionRow = {
  id: string;
  name: string;
  slug: string;
  activeSeason?: { id: string } | null;
};

function defaultTableIdForCompetition(_slug: string | undefined): string {
  // Nations Championship full_table is enriched with hemisphereGroups → Full / North / South.
  return "full_table";
}

type SeasonRow = {
  id: string;
  label: string;
  competitionId?: string;
  year?: number;
  isActive?: boolean;
  displayLabel?: string;
  status?: "current" | "previous" | "historical";
};

function normalizeSeasonLabelParam(label: string): string {
  return label.trim().replace(/-/g, "–");
}

function seasonIdFromParams(
  seasonRows: SeasonRow[],
  seasonIdParam: string | null,
  seasonLabelParam: string | null,
): string | undefined {
  if (seasonIdParam && seasonRows.some((row) => row.id === seasonIdParam)) {
    return seasonIdParam;
  }
  if (!seasonLabelParam) return undefined;
  const normalized = normalizeSeasonLabelParam(seasonLabelParam);
  const match = seasonRows.find(
    (row) =>
      row.label === normalized ||
      row.label.replace(/–/g, "-") === seasonLabelParam.trim() ||
      row.displayLabel === normalized,
  );
  return match?.id;
}

function parseVenueParam(value: string | null): RugbyTableView {
  if (value === "home" || value === "away" || value === "neutral") return value;
  return "all";
}

function parseHemisphereMode(value: string | null): HemisphereTableMode {
  return value === "summary" ? "summary" : "breakdown";
}

function parseHemisphereMatchType(value: string | null): HemisphereMatchType {
  if (value === "club" || value === "international") return value;
  return "all";
}

function defaultSeasonId(seasonRows: SeasonRow[], preferredId?: string | null) {
  if (preferredId && seasonRows.some((row) => row.id === preferredId)) {
    return preferredId;
  }
  const currentYear =
    new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  return (
    seasonRows.find((row) => row.year === currentYear)?.id ??
    seasonRows.find((row) => row.status === "current")?.id ??
    seasonRows.find((row) => row.isActive)?.id ??
    seasonRows[0]?.id ??
    ""
  );
}

type FormMatchPreset = (typeof FORM_MATCH_COUNT_PRESETS)[number] | "custom";

function parseFormMatchPreset(matchesParam: string | null): {
  preset: FormMatchPreset;
  customCount: number;
} {
  const count = parseFormMatchCount(matchesParam ?? DEFAULT_FORM_MATCH_COUNT);
  if (isPresetFormMatchCount(count)) {
    return { preset: count, customCount: count };
  }
  return { preset: "custom", customCount: count };
}

type TriesMatchRangePresetState = TriesMatchRangePreset;

function parseTriesMatchRangePresetState(matchesParam: string | null): {
  preset: TriesMatchRangePresetState;
  customCount: number;
} {
  const preset = parseTriesMatchRangePreset(matchesParam);
  if (preset === "all") {
    return { preset: "all", customCount: 5 };
  }
  if (preset === "custom") {
    const count = parseTriesMatchRangeCount("custom", matchesParam) ?? 5;
    return { preset: "custom", customCount: count };
  }
  return { preset, customCount: Number(preset) };
}

export default function TableLabViewPage() {
  const searchParams = useSearchParams();
  const [definitions, setDefinitions] = useState<RugbyTableDefinition[]>([]);
  const [competitions, setCompetitions] = useState<CompetitionRow[]>([]);
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [tableId, setTableId] = useState("full_table");
  const [tableView, setTableView] = useState<RugbyTableView>("all");
  const [formMatchPreset, setFormMatchPreset] = useState<FormMatchPreset>(DEFAULT_FORM_MATCH_COUNT);
  const [customFormMatchCount, setCustomFormMatchCount] = useState(DEFAULT_FORM_MATCH_COUNT);
  const [hemisphereMode, setHemisphereMode] = useState<HemisphereTableMode>("summary");
  const [hemisphereMatchType, setHemisphereMatchType] = useState<HemisphereMatchType>("all");
  const [includeUnknownHemisphere, setIncludeUnknownHemisphere] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [minMatchesPlayed, setMinMatchesPlayed] = useState(1);
  const [calendarYear, setCalendarYear] = useState(String(new Date().getFullYear()));
  const [asOfDate, setAsOfDate] = useState(() => parseAsOfDateParam(null));
  const [allTimeSeasonMode, setAllTimeSeasonMode] = useState<AllTimeSeasonRangeMode>("all");
  const [allTimeSeasonFrom, setAllTimeSeasonFrom] = useState("");
  const [allTimeSeasonTo, setAllTimeSeasonTo] = useState("");
  const [allTimeTeamStatus, setAllTimeTeamStatus] = useState<AllTimeTeamStatus>("all");
  const [allTimeSortBy, setAllTimeSortBy] = useState<AllTimePremiershipSortBy>("league_points");
  const [includeLiveMatches, setIncludeLiveMatches] = useState(true);
  const [includeScheduledMatches, setIncludeScheduledMatches] = useState(false);
  const [showMovement, setShowMovement] = useState(true);
  const [includeExtraTime, setIncludeExtraTime] = useState(false);
  const [oppositionPositionRule, setOppositionPositionRule] =
    useState<OppositionPositionRule>("current_position");
  const [firstScoreType, setFirstScoreType] = useState<FirstScoreTypeFilter>("any");
  const [scoringFirstSortBy, setScoringFirstSortBy] =
    useState<ScoringFirstSortBy>("league_points");
  const [concedingFirstSortBy, setConcedingFirstSortBy] =
    useState<ConcedingFirstSortBy>("league_points");
  const [losingPositionFilter, setLosingPositionFilter] =
    useState<LosingPositionFilter>("any_time");
  const [pointsGainedLosingSortBy, setPointsGainedLosingSortBy] =
    useState<PointsGainedLosingSortBy>("points_gained");
  const [winningPositionFilter, setWinningPositionFilter] =
    useState<WinningPositionFilter>("any_time");
  const [pointsLostWinningSortBy, setPointsLostWinningSortBy] =
    useState<PointsLostWinningSortBy>("points_lost");
  const [comebackFromFilter, setComebackFromFilter] =
    useState<ComebackFromFilter>("any_time");
  const [minimumDeficitPreset, setMinimumDeficitPreset] =
    useState<MinimumDeficitPreset>("any");
  const [customMinimumDeficit, setCustomMinimumDeficit] = useState("");
  const [comebackSortBy, setComebackSortBy] = useState<ComebackSortBy>("comeback_wins");
  const [leadPositionFilter, setLeadPositionFilter] =
    useState<LeadPositionFilter>("any_time");
  const [minimumLeadPreset, setMinimumLeadPreset] = useState<MinimumLeadPreset>("any");
  const [customMinimumLead, setCustomMinimumLead] = useState("");
  const [leadProtectionSortBy, setLeadProtectionSortBy] =
    useState<LeadProtectionSortBy>("lead_protection_pct");
  const [triesScoredPeriod, setTriesScoredPeriod] =
    useState<TriesScoredPeriod>("full_match");
  const [triesMatchRangePreset, setTriesMatchRangePreset] =
    useState<TriesMatchRangePresetState>("all");
  const [customTriesMatchRange, setCustomTriesMatchRange] = useState(5);
  const [triesScoredSortBy, setTriesScoredSortBy] =
    useState<TriesScoredSortBy>("tries_scored");
  const [triesConcededSortBy, setTriesConcededSortBy] =
    useState<TriesConcededSortBy>("fewest_tries_conceded");
  const [bothTeamsScoredTriesSortBy, setBothTeamsScoredTriesSortBy] =
    useState<BothTeamsScoredTriesSortBy>("yes_pct");
  const [winningBonusTypeFilter, setWinningBonusTypeFilter] =
    useState<WinningBonusTypeFilter>("all");
  const [winningBonusPointsSortBy, setWinningBonusPointsSortBy] =
    useState<WinningBonusPointsSortBy>("total_bonus_points");
  const [competitionId, setCompetitionId] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [result, setResult] = useState<RugbyTableResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);

  const effectiveFormMatchCount = useMemo(() => {
    if (formMatchPreset === "custom") {
      return parseFormMatchCount(customFormMatchCount);
    }
    return formMatchPreset;
  }, [formMatchPreset, customFormMatchCount]);

  const showLeagueViewFilter =
    tableId === "full_table" ||
    tableId === "form_table" ||
    tableId === "hemisphere_table" ||
    tableId === "all_time_premiership" ||
    tableId === "calendar_year" ||
    tableId === "on_this_date" ||
    tableId === "between_dates" ||
    tableId === "live_table" ||
    tableId === "first_half" ||
    tableId === "second_half" ||
    tableId === "final_20_minutes" ||
    tableId === "v_top_half" ||
    tableId === "v_bottom_half" ||
    tableId === "scoring_first" ||
    tableId === "conceding_first" ||
    tableId === "points_gained_losing" ||
    tableId === "points_lost_winning" ||
    tableId === "comeback" ||
    tableId === "lead_protection" ||
    tableId === "tries_scored" ||
    tableId === "tries_conceded" ||
    tableId === "both_teams_scored_tries" ||
    tableId === "winning_bonus_points";
  const isCalendarYearTable = tableId === "calendar_year";
  const isOnThisDateTable = tableId === "on_this_date";
  const isBetweenDatesTable = tableId === "between_dates";
  const isLiveTable = tableId === "live_table";
  const isFirstHalfTable = tableId === "first_half";
  const isSecondHalfTable = tableId === "second_half";
  const isFinalTwentyTable = tableId === "final_20_minutes";
  const isVTopHalfTable = tableId === "v_top_half";
  const isVBottomHalfTable = tableId === "v_bottom_half";
  const isOppositionHalfTable = isVTopHalfTable || isVBottomHalfTable;
  const isScoringFirstTable = tableId === "scoring_first";
  const isConcedingFirstTable = tableId === "conceding_first";
  const isPointsGainedLosingTable = tableId === "points_gained_losing";
  const isPointsLostWinningTable = tableId === "points_lost_winning";
  const isComebackTable = tableId === "comeback";
  const isLeadProtectionTable = tableId === "lead_protection";
  const isTriesScoredTable = tableId === "tries_scored";
  const isTriesConcededTable = tableId === "tries_conceded";
  const isBothTeamsScoredTriesTable = tableId === "both_teams_scored_tries";
  const isWinningBonusPointsTable = tableId === "winning_bonus_points";
  const isTriesTable = isTriesScoredTable || isTriesConcededTable;
  const isTriesMatchRangeTable =
    isTriesTable || isBothTeamsScoredTriesTable || isWinningBonusPointsTable;
  const isFirstScoreTable = isScoringFirstTable || isConcedingFirstTable;
  const isGameStateTimelineTable =
    isFirstScoreTable ||
    isPointsGainedLosingTable ||
    isPointsLostWinningTable ||
    isComebackTable ||
    isLeadProtectionTable;
  const isAllTimePremiership = tableId === "all_time_premiership";
  const showNeutralViewOption = tableId === "hemisphere_table";

  const loadSeasons = useCallback(async (compId: string) => {
    const url = compId
      ? `/api/admin/tables/seasons?competitionId=${encodeURIComponent(compId)}`
      : "/api/admin/tables/seasons";
    const res = await fetch(url);
    const data = await res.json();
    return (data.seasons ?? []) as SeasonRow[];
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const [defsRes, compsRes] = await Promise.all([
        fetch("/api/admin/tables/definitions"),
        fetch("/api/admin/competitions"),
      ]);
      const defs = await defsRes.json();
      const compData = await compsRes.json();
      const compRows = (compData.competitions ?? []) as CompetitionRow[];
      const urlCompId = searchParams.get("competitionId");
      const urlSeasonId = searchParams.get("seasonId");
      const urlSeasonLabel = searchParams.get("season");

      let compId = defaultCompetitionId(compRows, { competitionId: urlCompId ?? undefined });

      if (!urlCompId && (urlSeasonId || urlSeasonLabel)) {
        const allSeasonsRes = await fetch("/api/admin/tables/seasons");
        const allSeasons = ((await allSeasonsRes.json()).seasons ?? []) as SeasonRow[];
        const match = urlSeasonId
          ? allSeasons.find((row) => row.id === urlSeasonId)
          : allSeasons.find(
              (row) =>
                row.label === normalizeSeasonLabelParam(urlSeasonLabel ?? "") ||
                row.label.replace(/–/g, "-") === (urlSeasonLabel ?? "").trim(),
            );
        if (match?.competitionId) {
          compId = defaultCompetitionId(compRows, { competitionId: match.competitionId });
        }
      }

      const seasonRows = compId ? await loadSeasons(compId) : [];
      if (cancelled) return;

      const urlType = searchParams.get("type");
      const urlTableId = tableIdFromTypeParam(urlType);
      const { preset, customCount } = parseFormMatchPreset(searchParams.get("matches"));

      setDefinitions(defs.definitions ?? []);
      setCompetitions(compRows);
      setCompetitionId(compId);
      const selectedComp = compRows.find((row) => row.id === compId);
      setTableId(urlTableId ?? defaultTableIdForCompetition(selectedComp?.slug));
      setTableView(parseVenueParam(searchParams.get("venue")));
      setHemisphereMode(parseHemisphereMode(searchParams.get("mode")));
      setHemisphereMatchType(parseHemisphereMatchType(searchParams.get("matchType")));
      setIncludeUnknownHemisphere(searchParams.get("includeUnknown") === "1");
      setDateFrom(searchParams.get("dateFrom") ?? "");
      setDateTo(searchParams.get("dateTo") ?? "");
      setMinMatchesPlayed(parseMinMatchesPlayed(searchParams.get("minMatches")));
      setCalendarYear(String(parseCalendarYear(searchParams.get("year"))));
      setAsOfDate(parseAsOfDateParam(searchParams.get("date")));
      setDateFrom(searchParams.get("dateFrom") ?? "");
      setDateTo(searchParams.get("dateTo") ?? "");
      setAllTimeSeasonMode(parseAllTimeSeasonRangeMode(searchParams.get("seasonRange")));
      setAllTimeSeasonFrom(searchParams.get("seasonFrom") ?? "");
      setAllTimeSeasonTo(searchParams.get("seasonTo") ?? "");
      setAllTimeTeamStatus(parseAllTimeTeamStatus(searchParams.get("teamStatus")));
      setAllTimeSortBy(parseAllTimeSortBy(searchParams.get("sortBy")));
      setIncludeLiveMatches(parseLiveTableBoolean(searchParams.get("live"), true));
      setIncludeScheduledMatches(parseLiveTableBoolean(searchParams.get("scheduled"), false));
      setShowMovement(parseLiveTableBoolean(searchParams.get("movement"), true));
      setIncludeExtraTime(parseIncludeExtraTime(searchParams.get("extraTime"), false));
      setOppositionPositionRule(parseOppositionPositionRule(searchParams.get("oppositionRule")));
      setFirstScoreType(parseFirstScoreTypeFilter(searchParams.get("firstScoreType")));
      const urlTableForSort = tableIdFromTypeParam(searchParams.get("type"));
      if (urlTableForSort === "conceding_first") {
        setConcedingFirstSortBy(parseConcedingFirstSortBy(searchParams.get("sortBy")));
      } else if (urlTableForSort === "points_gained_losing") {
        setPointsGainedLosingSortBy(parsePointsGainedLosingSortBy(searchParams.get("sortBy")));
      } else if (urlTableForSort === "points_lost_winning") {
        setPointsLostWinningSortBy(parsePointsLostWinningSortBy(searchParams.get("sortBy")));
      } else if (urlTableForSort === "comeback") {
        setComebackSortBy(parseComebackSortBy(searchParams.get("sortBy")));
      } else if (urlTableForSort === "lead_protection") {
        setLeadProtectionSortBy(parseLeadProtectionSortBy(searchParams.get("sortBy")));
      } else if (urlTableForSort === "tries_scored") {
        setTriesScoredSortBy(parseTriesScoredSortBy(searchParams.get("sortBy")));
      } else if (urlTableForSort === "tries_conceded") {
        setTriesConcededSortBy(parseTriesConcededSortBy(searchParams.get("sortBy")));
      } else if (urlTableForSort === "both_teams_scored_tries") {
        setBothTeamsScoredTriesSortBy(
          parseBothTeamsScoredTriesSortBy(searchParams.get("sortBy")),
        );
      } else if (urlTableForSort === "winning_bonus_points") {
        setWinningBonusPointsSortBy(
          parseWinningBonusPointsSortBy(searchParams.get("sortBy")),
        );
      } else {
        setScoringFirstSortBy(parseScoringFirstSortBy(searchParams.get("sortBy")));
      }
      setLosingPositionFilter(parseLosingPositionFilter(searchParams.get("losingPosition")));
      setComebackFromFilter(parseComebackFromFilter(searchParams.get("comebackFrom")));
      setMinimumDeficitPreset(parseMinimumDeficitPreset(searchParams.get("minDeficit")));
      setCustomMinimumDeficit(searchParams.get("minDeficitCustom") ?? "");
      setLeadPositionFilter(parseLeadPositionFilter(searchParams.get("leadPosition")));
      setMinimumLeadPreset(parseMinimumLeadPreset(searchParams.get("minLead")));
      setCustomMinimumLead(searchParams.get("minLeadCustom") ?? "");
      const triesRange = parseTriesMatchRangePresetState(searchParams.get("matchRange"));
      setTriesScoredPeriod(parseTriesScoredPeriod(searchParams.get("period")));
      setTriesMatchRangePreset(triesRange.preset);
      setCustomTriesMatchRange(triesRange.customCount);
      setWinningBonusTypeFilter(parseWinningBonusTypeFilter(searchParams.get("bonusType")));
      setWinningPositionFilter(parseWinningPositionFilter(searchParams.get("winningPosition")));
      setFormMatchPreset(preset);
      setCustomFormMatchCount(customCount);
      setSeasons(seasonRows);
      setSeasonId(
        urlTableId === "calendar_year"
          ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ?? "")
          : urlTableId === "between_dates"
            ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ?? "")
            : urlTableId === "live_table"
              ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ??
                defaultSeasonId(seasonRows))
              : urlTableId === "first_half"
                ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ??
                  defaultSeasonId(seasonRows))
                : urlTableId === "second_half"
                  ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ??
                    defaultSeasonId(seasonRows))
                  : urlTableId === "final_20_minutes"
                    ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ??
                      defaultSeasonId(seasonRows))
                    : urlTableId === "v_top_half"
                      ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ??
                        defaultSeasonId(seasonRows))
                      : urlTableId === "v_bottom_half"
                        ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ??
                          defaultSeasonId(seasonRows))
                        : urlTableId === "scoring_first"
                          ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ??
                            defaultSeasonId(seasonRows))
                          : urlTableId === "conceding_first"
                            ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ??
                              defaultSeasonId(seasonRows))
                            : urlTableId === "points_gained_losing"
                              ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ??
                                defaultSeasonId(seasonRows))
                              : urlTableId === "points_lost_winning"
                                ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ??
                                  defaultSeasonId(seasonRows))
                                : urlTableId === "comeback"
                                  ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ??
                                    defaultSeasonId(seasonRows))
                                    : urlTableId === "lead_protection"
                                      ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ??
                                        defaultSeasonId(seasonRows))
                                      : urlTableId === "tries_scored"
                                        ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ??
                                          defaultSeasonId(seasonRows))
                                        : urlTableId === "tries_conceded"
                                          ? (seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel) ??
                                            defaultSeasonId(seasonRows))
                                          : urlTableId === "both_teams_scored_tries"
                                            ? (seasonIdFromParams(
                                                seasonRows,
                                                urlSeasonId,
                                                urlSeasonLabel,
                                              ) ?? defaultSeasonId(seasonRows))
                                            : urlTableId === "winning_bonus_points"
                                              ? (seasonIdFromParams(
                                                  seasonRows,
                                                  urlSeasonId,
                                                  urlSeasonLabel,
                                                ) ?? defaultSeasonId(seasonRows))
                                              : defaultSeasonId(
              seasonRows,
              seasonIdFromParams(seasonRows, urlSeasonId, urlSeasonLabel),
            ),
      );
      setLoading(false);
    }

    init().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [loadSeasons, searchParams]);

  async function onCompetitionChange(nextCompetitionId: string) {
    const selectedComp = competitions.find((row) => row.id === nextCompetitionId);
    setCompetitionId(nextCompetitionId);
    setTableId(defaultTableIdForCompetition(selectedComp?.slug));
    setResult(null);
    if (!nextCompetitionId) {
      setSeasons([]);
      setSeasonId("");
      return;
    }
    const seasonRows = await loadSeasons(nextCompetitionId);
    setSeasons(seasonRows);
    setSeasonId(defaultSeasonId(seasonRows));
  }

  async function build(options?: { silent?: boolean }) {
    if (!competitionId) return;
    if (!options?.silent) setBuilding(true);
    const res = await fetch("/api/admin/tables/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableId,
        context: {
          competitionId,
          seasonId: seasonId || undefined,
          tableView: showLeagueViewFilter ? tableView : undefined,
          formMatchCount: tableId === "form_table" ? effectiveFormMatchCount : undefined,
          hemisphereMode: tableId === "hemisphere_table" ? hemisphereMode : undefined,
          hemisphereMatchType: tableId === "hemisphere_table" ? hemisphereMatchType : undefined,
          includeUnknownHemisphere:
            tableId === "hemisphere_table" ? includeUnknownHemisphere : undefined,
          dateFrom:
            (tableId === "hemisphere_table" ||
              tableId === "home_table" ||
              tableId === "away_table" ||
              tableId === "between_dates" ||
              tableId === "first_half" ||
              tableId === "second_half" ||
              tableId === "final_20_minutes" ||
              tableId === "v_top_half" ||
              tableId === "v_bottom_half" ||
              tableId === "scoring_first" ||
              tableId === "conceding_first" ||
              tableId === "points_gained_losing" ||
              tableId === "points_lost_winning" ||
              tableId === "comeback" ||
              tableId === "lead_protection" ||
              tableId === "tries_scored" ||
              tableId === "tries_conceded" ||
              tableId === "both_teams_scored_tries" ||
              tableId === "winning_bonus_points") &&
            dateFrom
              ? dateFrom
              : undefined,
          dateTo:
            (tableId === "hemisphere_table" ||
              tableId === "home_table" ||
              tableId === "away_table" ||
              tableId === "between_dates" ||
              tableId === "first_half" ||
              tableId === "second_half" ||
              tableId === "final_20_minutes" ||
              tableId === "v_top_half" ||
              tableId === "v_bottom_half" ||
              tableId === "scoring_first" ||
              tableId === "conceding_first" ||
              tableId === "points_gained_losing" ||
              tableId === "points_lost_winning" ||
              tableId === "comeback" ||
              tableId === "lead_protection" ||
              tableId === "tries_scored" ||
              tableId === "tries_conceded" ||
              tableId === "both_teams_scored_tries" ||
              tableId === "winning_bonus_points") &&
            dateTo
              ? dateTo
              : undefined,
          minMatchesPlayed:
            tableId === "home_table" ||
            tableId === "away_table" ||
            tableId === "calendar_year" ||
            tableId === "between_dates" ||
            tableId === "first_half" ||
            tableId === "second_half" ||
            tableId === "final_20_minutes" ||
            tableId === "v_top_half" ||
            tableId === "v_bottom_half" ||
            tableId === "scoring_first" ||
            tableId === "conceding_first" ||
            tableId === "points_gained_losing" ||
            tableId === "points_lost_winning" ||
            tableId === "comeback" ||
            tableId === "lead_protection" ||
            tableId === "tries_scored" ||
            tableId === "tries_conceded" ||
            tableId === "both_teams_scored_tries" ||
            tableId === "winning_bonus_points"
              ? minMatchesPlayed
              : undefined,
          calendarYear: tableId === "calendar_year" ? parseCalendarYear(calendarYear) : undefined,
          asOfDate: tableId === "on_this_date" ? parseAsOfDateParam(asOfDate) : undefined,
          allTimeSeasonRangeMode: isAllTimePremiership ? allTimeSeasonMode : undefined,
          allTimeSeasonFromYear:
            isAllTimePremiership && allTimeSeasonFrom
              ? parseSeasonYearParam(allTimeSeasonFrom) ?? undefined
              : undefined,
          allTimeSeasonToYear:
            isAllTimePremiership && allTimeSeasonTo
              ? parseSeasonYearParam(allTimeSeasonTo) ?? undefined
              : undefined,
          allTimeTeamStatus: isAllTimePremiership ? allTimeTeamStatus : undefined,
          allTimeSortBy: isAllTimePremiership ? allTimeSortBy : undefined,
          includeLiveMatches: isLiveTable ? includeLiveMatches : undefined,
          includeScheduledMatches: isLiveTable ? includeScheduledMatches : undefined,
          showMovement: isLiveTable ? showMovement : undefined,
          includeExtraTime: isFinalTwentyTable ? includeExtraTime : undefined,
          oppositionPositionRule: isOppositionHalfTable ? oppositionPositionRule : undefined,
          firstScoreType: isFirstScoreTable ? firstScoreType : undefined,
          scoringFirstSortBy: isScoringFirstTable ? scoringFirstSortBy : undefined,
          concedingFirstSortBy: isConcedingFirstTable ? concedingFirstSortBy : undefined,
          losingPositionFilter: isPointsGainedLosingTable ? losingPositionFilter : undefined,
          pointsGainedLosingSortBy: isPointsGainedLosingTable ? pointsGainedLosingSortBy : undefined,
          winningPositionFilter: isPointsLostWinningTable ? winningPositionFilter : undefined,
          pointsLostWinningSortBy: isPointsLostWinningTable ? pointsLostWinningSortBy : undefined,
          comebackFromFilter: isComebackTable ? comebackFromFilter : undefined,
          minimumDeficitPreset: isComebackTable ? minimumDeficitPreset : undefined,
          minimumDeficitPoints: isComebackTable
            ? parseMinimumDeficitPoints(minimumDeficitPreset, customMinimumDeficit)
            : undefined,
          comebackSortBy: isComebackTable ? comebackSortBy : undefined,
          leadPositionFilter: isLeadProtectionTable ? leadPositionFilter : undefined,
          minimumLeadPreset: isLeadProtectionTable ? minimumLeadPreset : undefined,
          minimumLeadPoints: isLeadProtectionTable
            ? parseMinimumLeadPoints(minimumLeadPreset, customMinimumLead)
            : undefined,
          leadProtectionSortBy: isLeadProtectionTable ? leadProtectionSortBy : undefined,
          triesScoredPeriod: isTriesTable ? triesScoredPeriod : undefined,
          triesMatchRangePreset: isTriesMatchRangeTable ? triesMatchRangePreset : undefined,
          triesMatchRangeCustom: isTriesMatchRangeTable
            ? parseTriesMatchRangeCount(triesMatchRangePreset, customTriesMatchRange) ?? undefined
            : undefined,
          triesScoredSortBy: isTriesScoredTable ? triesScoredSortBy : undefined,
          triesConcededSortBy: isTriesConcededTable ? triesConcededSortBy : undefined,
          bothTeamsScoredTriesSortBy: isBothTeamsScoredTriesTable
            ? bothTeamsScoredTriesSortBy
            : undefined,
          winningBonusTypeFilter: isWinningBonusPointsTable ? winningBonusTypeFilter : undefined,
          winningBonusPointsSortBy: isWinningBonusPointsTable
            ? winningBonusPointsSortBy
            : undefined,
        },
      }),
    });
    const data = await res.json();
    setResult(data);
    if (!options?.silent) setBuilding(false);
  }

  useEffect(() => {
    if (!loading && tableId && competitionId) {
      build().catch(() => setBuilding(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild when selection changes
  }, [
    loading,
    tableId,
    competitionId,
    seasonId,
    tableView,
    effectiveFormMatchCount,
    hemisphereMode,
    hemisphereMatchType,
    includeUnknownHemisphere,
    dateFrom,
    dateTo,
    minMatchesPlayed,
    calendarYear,
    asOfDate,
    allTimeSeasonMode,
    allTimeSeasonFrom,
    allTimeSeasonTo,
    allTimeTeamStatus,
    allTimeSortBy,
    includeLiveMatches,
    includeScheduledMatches,
    showMovement,
    includeExtraTime,
    oppositionPositionRule,
    firstScoreType,
    scoringFirstSortBy,
    concedingFirstSortBy,
    losingPositionFilter,
    pointsGainedLosingSortBy,
    winningPositionFilter,
    pointsLostWinningSortBy,
    comebackFromFilter,
    minimumDeficitPreset,
    customMinimumDeficit,
    comebackSortBy,
    leadPositionFilter,
    minimumLeadPreset,
    customMinimumLead,
    leadProtectionSortBy,
    triesScoredPeriod,
    triesMatchRangePreset,
    customTriesMatchRange,
    triesScoredSortBy,
    triesConcededSortBy,
    bothTeamsScoredTriesSortBy,
    winningBonusTypeFilter,
    winningBonusPointsSortBy,
  ]);

  useEffect(() => {
    if (
      loading ||
      !isLiveTable ||
      !includeLiveMatches ||
      !competitionId ||
      !seasonId
    ) {
      return;
    }

    let es: EventSource | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const refresh = () => {
      build({ silent: true }).catch(() => undefined);
    };

    const startPolling = () => {
      if (pollId) return;
      pollId = setInterval(refresh, 20_000);
    };

    try {
      const params = new URLSearchParams({
        competitionId,
        seasonId,
      });
      es = new EventSource(`/api/admin/tables/live-table/stream?${params.toString()}`);
      es.onmessage = () => refresh();
      es.onerror = () => {
        es?.close();
        es = null;
        startPolling();
      };
    } catch {
      startPolling();
    }

    return () => {
      es?.close();
      if (pollId) clearInterval(pollId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- live refresh scoped to live table filters
  }, [loading, isLiveTable, includeLiveMatches, competitionId, seasonId]);

  useEffect(() => {
    if (loading || !competitionId) return;

    const season = seasons.find((row) => row.id === seasonId);
    const params = new URLSearchParams();
    const typeSlug =
      tableId === "calendar_year"
        ? "calendar-year-table"
        : tableId === "on_this_date"
          ? "table-on-this-date"
          : tableId === "between_dates"
            ? "table-between-dates"
            : tableId === "live_table"
              ? "live-table"
              : tableId === "first_half"
                ? "first-half-table"
                : tableId === "second_half"
                  ? "second-half-table"
                  : tableId === "final_20_minutes"
                    ? "final-20-minutes-table"
                    : tableId === "v_top_half"
                      ? "table-v-top-half"
                      : tableId === "v_bottom_half"
                        ? "table-v-bottom-half"
                        : tableId === "scoring_first"
                          ? "table-when-scoring-first"
                          : tableId === "conceding_first"
                            ? "table-when-conceding-first"
                            : tableId === "points_gained_losing"
                              ? "points-gained-from-losing-positions"
                              : tableId === "points_lost_winning"
                                ? "points-lost-from-winning-positions"
                                : tableId === "comeback"
                                  ? "comeback-table"
                                    : tableId === "lead_protection"
                                      ? "lead-protection-table"
                                      : tableId === "tries_scored"
                                        ? "tries-scored-table"
                                        : tableId === "tries_conceded"
                                          ? "tries-conceded-table"
                                          : tableId === "both_teams_scored_tries"
                                            ? "both-teams-scored-tries"
                                            : tableId === "winning_bonus_points"
                                              ? "winning-bonus-points-table"
                                              : tableId.replace(/_/g, "-");
    params.set("type", typeSlug);
    params.set("competitionId", competitionId);
    if (season?.label) {
      params.set("season", season.label.replace(/–/g, "-"));
    }
    if (tableId === "form_table") {
      params.set("matches", String(effectiveFormMatchCount));
      params.set("venue", tableView);
    } else if (tableId === "full_table" && tableView !== "all") {
      params.set("venue", tableView);
    } else if (tableId === "hemisphere_table") {
      params.set("mode", hemisphereMode);
      params.set("matchType", hemisphereMatchType);
      params.set("venue", tableView);
      if (includeUnknownHemisphere) params.set("includeUnknown", "1");
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
    } else if (tableId === "home_table" || tableId === "away_table") {
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
    } else if (tableId === "calendar_year") {
      params.set("year", String(parseCalendarYear(calendarYear)));
      if (tableView !== "all") params.set("venue", tableView);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
    } else if (tableId === "on_this_date") {
      params.set("date", parseAsOfDateParam(asOfDate));
      if (tableView !== "all") params.set("venue", tableView);
    } else if (tableId === "between_dates") {
      params.set("dateFrom", parseDateOnlyParam(dateFrom, defaultBetweenDatesRange().startDate));
      params.set("dateTo", parseDateOnlyParam(dateTo, defaultBetweenDatesRange().endDate));
      if (tableView !== "all") params.set("venue", tableView);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
    } else if (tableId === "live_table") {
      if (tableView !== "all") params.set("venue", tableView);
      if (!includeLiveMatches) params.set("live", "no");
      if (includeScheduledMatches) params.set("scheduled", "yes");
      if (!showMovement) params.set("movement", "no");
    } else if (tableId === "first_half") {
      if (tableView !== "all") params.set("venue", tableView);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
    } else if (tableId === "second_half") {
      if (tableView !== "all") params.set("venue", tableView);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
    } else if (tableId === "final_20_minutes") {
      if (tableView !== "all") params.set("venue", tableView);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
      if (includeExtraTime) params.set("extraTime", "yes");
    } else if (tableId === "v_top_half") {
      if (tableView !== "all") params.set("venue", tableView);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
      if (oppositionPositionRule !== "current_position") {
        params.set(
          "oppositionRule",
          oppositionPositionRule === "position_at_match" ? "at_match" : "final",
        );
      }
    } else if (tableId === "v_bottom_half") {
      if (tableView !== "all") params.set("venue", tableView);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
      if (oppositionPositionRule !== "current_position") {
        params.set(
          "oppositionRule",
          oppositionPositionRule === "position_at_match" ? "at_match" : "final",
        );
      }
    } else if (tableId === "scoring_first") {
      if (tableView !== "all") params.set("venue", tableView);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
      if (firstScoreType !== "any") params.set("firstScoreType", firstScoreType);
      if (scoringFirstSortBy !== "league_points") params.set("sortBy", scoringFirstSortBy);
    } else if (tableId === "conceding_first") {
      if (tableView !== "all") params.set("venue", tableView);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
      if (firstScoreType !== "any") params.set("firstScoreType", firstScoreType);
      if (concedingFirstSortBy !== "league_points") params.set("sortBy", concedingFirstSortBy);
    } else if (tableId === "points_gained_losing") {
      if (tableView !== "all") params.set("venue", tableView);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
      if (losingPositionFilter !== "any_time") params.set("losingPosition", losingPositionFilter);
      if (pointsGainedLosingSortBy !== "points_gained") {
        params.set("sortBy", pointsGainedLosingSortBy);
      }
    } else if (tableId === "points_lost_winning") {
      if (tableView !== "all") params.set("venue", tableView);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
      if (winningPositionFilter !== "any_time") params.set("winningPosition", winningPositionFilter);
      if (pointsLostWinningSortBy !== "points_lost") {
        params.set("sortBy", pointsLostWinningSortBy);
      }
    } else if (tableId === "comeback") {
      if (tableView !== "all") params.set("venue", tableView);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
      if (comebackFromFilter !== "any_time") params.set("comebackFrom", comebackFromFilter);
      if (minimumDeficitPreset !== "any") params.set("minDeficit", minimumDeficitPreset);
      if (minimumDeficitPreset === "custom" && customMinimumDeficit.trim()) {
        params.set("minDeficitCustom", customMinimumDeficit.trim());
      }
      if (comebackSortBy !== "comeback_wins") params.set("sortBy", comebackSortBy);
    } else if (tableId === "lead_protection") {
      if (tableView !== "all") params.set("venue", tableView);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
      if (leadPositionFilter !== "any_time") params.set("leadPosition", leadPositionFilter);
      if (minimumLeadPreset !== "any") params.set("minLead", minimumLeadPreset);
      if (minimumLeadPreset === "custom" && customMinimumLead.trim()) {
        params.set("minLeadCustom", customMinimumLead.trim());
      }
      if (leadProtectionSortBy !== "lead_protection_pct") {
        params.set("sortBy", leadProtectionSortBy);
      }
    } else if (tableId === "tries_scored") {
      if (tableView !== "all") params.set("venue", tableView);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
      if (triesScoredPeriod !== "full_match") params.set("period", triesScoredPeriod);
      if (triesMatchRangePreset !== "all") {
        params.set(
          "matchRange",
          triesMatchRangePreset === "custom"
            ? String(customTriesMatchRange)
            : triesMatchRangePreset,
        );
      }
      if (triesScoredSortBy !== "tries_scored") params.set("sortBy", triesScoredSortBy);
    } else if (tableId === "tries_conceded") {
      if (tableView !== "all") params.set("venue", tableView);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
      if (triesScoredPeriod !== "full_match") params.set("period", triesScoredPeriod);
      if (triesMatchRangePreset !== "all") {
        params.set(
          "matchRange",
          triesMatchRangePreset === "custom"
            ? String(customTriesMatchRange)
            : triesMatchRangePreset,
        );
      }
      if (triesConcededSortBy !== "fewest_tries_conceded") {
        params.set("sortBy", triesConcededSortBy);
      }
    } else if (tableId === "both_teams_scored_tries") {
      if (tableView !== "all") params.set("venue", tableView);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
      if (triesMatchRangePreset !== "all") {
        params.set(
          "matchRange",
          triesMatchRangePreset === "custom"
            ? String(customTriesMatchRange)
            : triesMatchRangePreset,
        );
      }
      if (bothTeamsScoredTriesSortBy !== "yes_pct") {
        params.set("sortBy", bothTeamsScoredTriesSortBy);
      }
    } else if (tableId === "winning_bonus_points") {
      if (tableView !== "all") params.set("venue", tableView);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (minMatchesPlayed > 1) params.set("minMatches", String(minMatchesPlayed));
      if (triesMatchRangePreset !== "all") {
        params.set(
          "matchRange",
          triesMatchRangePreset === "custom"
            ? String(customTriesMatchRange)
            : triesMatchRangePreset,
        );
      }
      if (winningBonusTypeFilter !== "all") params.set("bonusType", winningBonusTypeFilter);
      if (winningBonusPointsSortBy !== "total_bonus_points") {
        params.set("sortBy", winningBonusPointsSortBy);
      }
    } else if (tableId === "all_time_premiership") {
      params.set("venue", tableView);
      params.set("seasonRange", allTimeSeasonMode);
      if (allTimeSeasonFrom) params.set("seasonFrom", allTimeSeasonFrom);
      if (allTimeSeasonTo) params.set("seasonTo", allTimeSeasonTo);
      if (allTimeTeamStatus !== "all") params.set("teamStatus", allTimeTeamStatus);
      if (allTimeSortBy !== "league_points") params.set("sortBy", allTimeSortBy);
    }

    const next = `/admin/tables/view?${params.toString()}`;
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState(null, "", next);
    }
  }, [
    loading,
    competitionId,
    seasonId,
    seasons,
    tableId,
    tableView,
    effectiveFormMatchCount,
    hemisphereMode,
    hemisphereMatchType,
    includeUnknownHemisphere,
    dateFrom,
    dateTo,
    minMatchesPlayed,
    calendarYear,
    asOfDate,
    allTimeSeasonMode,
    allTimeSeasonFrom,
    allTimeSeasonTo,
    allTimeTeamStatus,
    allTimeSortBy,
    includeLiveMatches,
    includeScheduledMatches,
    showMovement,
    includeExtraTime,
    oppositionPositionRule,
    firstScoreType,
    scoringFirstSortBy,
    concedingFirstSortBy,
    losingPositionFilter,
    pointsGainedLosingSortBy,
    winningPositionFilter,
    pointsLostWinningSortBy,
    comebackFromFilter,
    minimumDeficitPreset,
    customMinimumDeficit,
    comebackSortBy,
    leadPositionFilter,
    minimumLeadPreset,
    customMinimumLead,
    leadProtectionSortBy,
    triesScoredPeriod,
    triesMatchRangePreset,
    customTriesMatchRange,
    triesScoredSortBy,
    triesConcededSortBy,
    bothTeamsScoredTriesSortBy,
    winningBonusTypeFilter,
    winningBonusPointsSortBy,
  ]);

  const filterGridClass =
    tableId === "form_table"
      ? "sm:grid-cols-2 lg:grid-cols-5"
      : tableId === "full_table"
        ? "sm:grid-cols-4"
        : tableId === "hemisphere_table"
          ? "sm:grid-cols-4"
          : tableId === "home_table" || tableId === "away_table"
            ? "sm:grid-cols-4"
            : tableId === "calendar_year"
              ? "sm:grid-cols-4"
              : tableId === "on_this_date"
                ? "sm:grid-cols-4"
                : tableId === "between_dates"
                  ? "sm:grid-cols-5"
                  : tableId === "live_table"
                    ? "sm:grid-cols-4"
                    : tableId === "first_half"
                      ? "sm:grid-cols-4"
                      : tableId === "second_half"
                        ? "sm:grid-cols-4"
                        : tableId === "final_20_minutes"
                          ? "sm:grid-cols-4"
                          : tableId === "all_time_premiership"
              ? "sm:grid-cols-3"
              : "sm:grid-cols-3";

  return (
    <>
      <PageHeader
        eyebrow="Table Lab"
        title="View tables"
        description="Rugby-specific league and performance tables with explanation, calculation notes, data coverage and confidence."
        actions={
          <Link href="/admin/tables" className="cms-btn cms-btn--secondary">
            Table Lab hub
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <Link href="/admin/tables/index" className="cms-btn cms-btn--secondary text-xs py-1 px-2">
          Table index
        </Link>
        <Link href="/admin/tables/guide" className="cms-btn cms-btn--secondary text-xs py-1 px-2">
          Guide
        </Link>
      </div>

      <div className={`cms-card mb-4 grid gap-3 ${filterGridClass}`}>
        <label className="text-sm">
          <span className="block text-zinc-500 mb-1">Competition</span>
          <select
            className="cms-input w-full"
            value={competitionId}
            onChange={(e) => onCompetitionChange(e.target.value)}
            disabled={loading || competitions.length === 0}
          >
            {competitions.length === 0 ? (
              <option value="">No competitions imported</option>
            ) : (
              competitions.map((competition) => (
                <option key={competition.id} value={competition.id}>
                  {competition.name}
                </option>
              ))
            )}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-zinc-500 mb-1">Table type</span>
          <select
            className="cms-input w-full"
            value={tableId}
            onChange={(e) => {
              const nextId = e.target.value;
              setTableId(nextId);
              if (nextId === "all_time_premiership") {
                const prem = competitions.find((row) => row.slug === "premiership");
                if (prem) setCompetitionId(prem.id);
              }
              if (nextId === "calendar_year") {
                setSeasonId("");
              }
              if (nextId === "on_this_date") {
                setAsOfDate(parseAsOfDateParam(null));
              }
              if (nextId === "between_dates") {
                const range = defaultBetweenDatesRange();
                setSeasonId("");
                setDateFrom(range.startDate);
                setDateTo(range.endDate);
              }
            }}
          >
            {rugbyTableCategories().map((category) => {
              const rows = definitions.filter((row) => row.category === category.id);
              if (rows.length === 0) return null;
              const label =
                TABLE_LAB_CATEGORY_LABELS[category.id] ?? category.label;
              return (
                <optgroup key={category.id} label={label}>
                  {rows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-zinc-500 mb-1">
            Season{isCalendarYearTable ? " (optional)" : ""}
          </span>
          <select
            className="cms-input w-full"
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
            disabled={!competitionId || seasons.length === 0 || isAllTimePremiership}
          >
            <option value="">
              {isAllTimePremiership
                ? "All Premiership seasons"
                : isCalendarYearTable
                  ? "All fixtures in competition"
                    : isBetweenDatesTable
                    ? "All fixtures in competition"
                    : isLiveTable
                      ? "Select a season"
                      : isFirstHalfTable
                        ? "Select a season"
                        : isSecondHalfTable
                          ? "Select a season"
                          : isFinalTwentyTable
                            ? "Select a season"
                            : isVTopHalfTable
                              ? "Select a season"
                              : isVBottomHalfTable
                                ? "Select a season"
                                : isGameStateTimelineTable
                                  ? "Select a season"
                                  : isOnThisDateTable
                    ? "Select a season"
                    : "All fixtures in competition"}
            </option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.displayLabel ?? season.label}
              </option>
            ))}
          </select>
        </label>
        {isCalendarYearTable ? (
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">Calendar year</span>
            <input
              type="number"
              min={1900}
              max={2100}
              className="cms-input w-full"
              value={calendarYear}
              onChange={(e) => setCalendarYear(e.target.value)}
            />
          </label>
        ) : null}
        {isOnThisDateTable ? (
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">Date</span>
            <input
              type="date"
              className="cms-input w-full"
              value={asOfDate}
              onChange={(e) => setAsOfDate(parseAsOfDateParam(e.target.value))}
            />
          </label>
        ) : null}
        {isBetweenDatesTable ? (
          <>
            <label className="text-sm">
              <span className="block text-zinc-500 mb-1">Start date</span>
              <input
                type="date"
                className="cms-input w-full"
                value={dateFrom}
                onChange={(e) =>
                  setDateFrom(parseDateOnlyParam(e.target.value, defaultBetweenDatesRange().startDate))
                }
              />
            </label>
            <label className="text-sm">
              <span className="block text-zinc-500 mb-1">End date</span>
              <input
                type="date"
                className="cms-input w-full"
                value={dateTo}
                onChange={(e) =>
                  setDateTo(parseDateOnlyParam(e.target.value, defaultBetweenDatesRange().endDate))
                }
              />
            </label>
          </>
        ) : null}
        {tableId === "form_table" ? (
          <>
            <label className="text-sm">
              <span className="block text-zinc-500 mb-1">Match count</span>
              <select
                className="cms-input w-full"
                value={formMatchPreset}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "custom") {
                    setFormMatchPreset("custom");
                    return;
                  }
                  const parsed = Number(value);
                  if (isPresetFormMatchCount(parsed)) {
                    setFormMatchPreset(parsed);
                    setCustomFormMatchCount(parsed);
                  }
                }}
              >
                {FORM_MATCH_COUNT_PRESETS.map((count) => (
                  <option key={count} value={count}>
                    Last {count}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </label>
            {formMatchPreset === "custom" ? (
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Custom matches</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="cms-input w-full"
                  value={customFormMatchCount}
                  onChange={(e) => setCustomFormMatchCount(parseFormMatchCount(e.target.value))}
                />
              </label>
            ) : (
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">View</span>
                <select
                  className="cms-input w-full"
                  value={tableView}
                  onChange={(e) => setTableView(e.target.value as RugbyTableView)}
                >
                  <option value="all">All</option>
                  <option value="home">Home</option>
                  <option value="away">Away</option>
                </select>
              </label>
            )}
          </>
        ) : null}
        {tableId === "form_table" && formMatchPreset === "custom" ? (
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">View</span>
            <select
              className="cms-input w-full"
              value={tableView}
              onChange={(e) => setTableView(e.target.value as RugbyTableView)}
            >
              <option value="all">All</option>
              <option value="home">Home</option>
              <option value="away">Away</option>
            </select>
          </label>
        ) : null}
        {tableId === "full_table" ||
        tableId === "hemisphere_table" ||
        isAllTimePremiership ||
        isCalendarYearTable ||
        isOnThisDateTable ||
        isBetweenDatesTable ||
        isLiveTable ||
        isFirstHalfTable ||
        isSecondHalfTable ||
        isFinalTwentyTable ||
        isOppositionHalfTable ||
        isGameStateTimelineTable ||
        isTriesMatchRangeTable ? (
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">View</span>
            <select
              className="cms-input w-full"
              value={tableView}
              onChange={(e) => setTableView(e.target.value as RugbyTableView)}
            >
              <option value="all">All</option>
              <option value="home">Home</option>
              <option value="away">Away</option>
              {showNeutralViewOption ? <option value="neutral">Neutral</option> : null}
            </select>
          </label>
        ) : null}
      </div>

      {isLiveTable ? (
        <div className="cms-card mb-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">Include live matches</span>
            <select
              className="cms-input w-full"
              value={includeLiveMatches ? "yes" : "no"}
              onChange={(e) => setIncludeLiveMatches(e.target.value === "yes")}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">Include scheduled matches</span>
            <select
              className="cms-input w-full"
              value={includeScheduledMatches ? "yes" : "no"}
              onChange={(e) => setIncludeScheduledMatches(e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">Show movement</span>
            <select
              className="cms-input w-full"
              value={showMovement ? "yes" : "no"}
              onChange={(e) => setShowMovement(e.target.value === "yes")}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>
      ) : null}

      {isAllTimePremiership ? (
        <div className="cms-card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">Season range</span>
            <select
              className="cms-input w-full"
              value={allTimeSeasonMode}
              onChange={(e) => setAllTimeSeasonMode(e.target.value as AllTimeSeasonRangeMode)}
            >
              <option value="all">All seasons</option>
              <option value="from">From season</option>
              <option value="to">To season</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
          {(allTimeSeasonMode === "from" || allTimeSeasonMode === "custom") && (
            <label className="text-sm">
              <span className="block text-zinc-500 mb-1">From year</span>
              <input
                type="number"
                min={1987}
                className="cms-input w-full"
                value={allTimeSeasonFrom}
                onChange={(e) => setAllTimeSeasonFrom(e.target.value)}
                placeholder="e.g. 2010"
              />
            </label>
          )}
          {(allTimeSeasonMode === "to" || allTimeSeasonMode === "custom") && (
            <label className="text-sm">
              <span className="block text-zinc-500 mb-1">To year</span>
              <input
                type="number"
                min={1987}
                className="cms-input w-full"
                value={allTimeSeasonTo}
                onChange={(e) => setAllTimeSeasonTo(e.target.value)}
                placeholder="e.g. 2020"
              />
            </label>
          )}
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">Teams</span>
            <select
              className="cms-input w-full"
              value={allTimeTeamStatus}
              onChange={(e) => setAllTimeTeamStatus(e.target.value as AllTimeTeamStatus)}
            >
              <option value="all">All teams</option>
              <option value="current">Current teams</option>
              <option value="former">Former teams</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">Sort by</span>
            <select
              className="cms-input w-full"
              value={allTimeSortBy}
              onChange={(e) => setAllTimeSortBy(e.target.value as AllTimePremiershipSortBy)}
            >
              <option value="league_points">League points</option>
              <option value="seasons">Seasons</option>
              <option value="played">Played</option>
              <option value="won">Wins</option>
              <option value="win_pct">Win %</option>
              <option value="points_for">Points for</option>
              <option value="tries_for">Tries for</option>
              <option value="team_name">Team name</option>
            </select>
          </label>
        </div>
      ) : null}

      {isOnThisDateTable ? (
        <div className="cms-card mb-4 flex flex-wrap items-end gap-3">
          <button
            type="button"
            className="cms-btn cms-btn--secondary text-sm"
            onClick={() => setAsOfDate(shiftDateOnly(asOfDate, -1))}
          >
            Previous day
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary text-sm"
            onClick={() => setAsOfDate(parseAsOfDateParam(null))}
          >
            Today
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary text-sm"
            onClick={() => setAsOfDate(shiftDateOnly(asOfDate, 1))}
          >
            Next day
          </button>
        </div>
      ) : null}

      {tableId === "home_table" ||
      tableId === "away_table" ||
      isFirstHalfTable ||
      isSecondHalfTable ||
      isFinalTwentyTable ||
      isOppositionHalfTable ||
      isGameStateTimelineTable ||
      isTriesMatchRangeTable ||
      isCalendarYearTable ||
      isBetweenDatesTable ? (
        <div className="cms-card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tableId === "home_table" ||
          tableId === "away_table" ||
          isFirstHalfTable ||
          isSecondHalfTable ||
          isFinalTwentyTable ||
          isOppositionHalfTable ||
          isGameStateTimelineTable ||
          isTriesMatchRangeTable ? (
            <>
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Date from</span>
                <input
                  type="date"
                  className="cms-input w-full"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Date to</span>
                <input
                  type="date"
                  className="cms-input w-full"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </label>
            </>
          ) : null}
          {isOppositionHalfTable ? (
            <label className="text-sm">
              <span className="block text-zinc-500 mb-1">Opposition position rule</span>
              <select
                className="cms-input w-full"
                value={oppositionPositionRule}
                onChange={(e) =>
                  setOppositionPositionRule(e.target.value as OppositionPositionRule)
                }
              >
                <option value="current_position">Current position</option>
                <option value="position_at_match">Position at time of match</option>
                <option value="final_season_position">Final season position</option>
              </select>
            </label>
          ) : null}
          {(isTriesTable || isBothTeamsScoredTriesTable || isWinningBonusPointsTable) ? (
            <>
              {isTriesTable ? (
                <label className="text-sm">
                  <span className="block text-zinc-500 mb-1">Period</span>
                  <select
                    className="cms-input w-full"
                    value={triesScoredPeriod}
                    onChange={(e) => setTriesScoredPeriod(e.target.value as TriesScoredPeriod)}
                  >
                    <option value="full_match">Full match</option>
                    <option value="first_half">First half</option>
                    <option value="second_half">Second half</option>
                    <option value="final_20">Final 20 minutes</option>
                  </select>
                </label>
              ) : null}
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Match range</span>
                <select
                  className="cms-input w-full"
                  value={triesMatchRangePreset}
                  onChange={(e) => {
                    const value = e.target.value as TriesMatchRangePresetState;
                    if (value === "custom") {
                      setTriesMatchRangePreset("custom");
                      return;
                    }
                    if (value === "all") {
                      setTriesMatchRangePreset("all");
                      return;
                    }
                    setTriesMatchRangePreset(value);
                    setCustomTriesMatchRange(Number(value));
                  }}
                >
                  <option value="all">All matches</option>
                  <option value="3">Last 3</option>
                  <option value="5">Last 5</option>
                  <option value="10">Last 10</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              {triesMatchRangePreset === "custom" ? (
                <label className="text-sm">
                  <span className="block text-zinc-500 mb-1">Custom match count</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    className="cms-input w-full"
                    value={customTriesMatchRange}
                    onChange={(e) =>
                      setCustomTriesMatchRange(parseTriesMatchRangeCount("custom", e.target.value) ?? 5)
                    }
                  />
                </label>
              ) : null}
              {isTriesScoredTable ? (
                <label className="text-sm">
                  <span className="block text-zinc-500 mb-1">Sort by</span>
                  <select
                    className="cms-input w-full"
                    value={triesScoredSortBy}
                    onChange={(e) => setTriesScoredSortBy(e.target.value as TriesScoredSortBy)}
                  >
                    <option value="tries_scored">Tries scored</option>
                    <option value="tries_per_match">Tries per match</option>
                    <option value="try_scoring_rate_pct">Try scoring rate %</option>
                    <option value="two_plus_tries_pct">2+ tries %</option>
                    <option value="three_plus_tries_pct">3+ tries %</option>
                    <option value="four_plus_tries_pct">4+ tries %</option>
                    <option value="five_plus_tries_pct">5+ tries %</option>
                  </select>
                </label>
              ) : null}
              {isTriesConcededTable ? (
                <label className="text-sm">
                  <span className="block text-zinc-500 mb-1">Sort by</span>
                  <select
                    className="cms-input w-full"
                    value={triesConcededSortBy}
                    onChange={(e) =>
                      setTriesConcededSortBy(e.target.value as TriesConcededSortBy)
                    }
                  >
                    <option value="fewest_tries_conceded">Fewest tries conceded</option>
                    <option value="lowest_tries_conceded_per_match">Tries conceded per match</option>
                    <option value="lowest_try_conceding_rate_pct">Try conceding rate %</option>
                    <option value="two_plus_conceded_pct">2+ conceded %</option>
                    <option value="three_plus_conceded_pct">3+ conceded %</option>
                    <option value="four_plus_conceded_pct">4+ conceded %</option>
                    <option value="five_plus_conceded_pct">5+ conceded %</option>
                  </select>
                </label>
              ) : null}
              {isBothTeamsScoredTriesTable ? (
                <label className="text-sm">
                  <span className="block text-zinc-500 mb-1">Sort by</span>
                  <select
                    className="cms-input w-full"
                    value={bothTeamsScoredTriesSortBy}
                    onChange={(e) =>
                      setBothTeamsScoredTriesSortBy(
                        e.target.value as BothTeamsScoredTriesSortBy,
                      )
                    }
                  >
                    <option value="yes_pct">Yes %</option>
                    <option value="no_pct">No %</option>
                    <option value="both_teams_2_plus_pct">Both teams 2+ tries %</option>
                    <option value="both_teams_3_plus_pct">Both teams 3+ tries %</option>
                    <option value="both_teams_4_plus_pct">Both teams 4+ tries %</option>
                  </select>
                </label>
              ) : null}
              {isWinningBonusPointsTable ? (
                <>
                  <label className="text-sm">
                    <span className="block text-zinc-500 mb-1">Bonus type</span>
                    <select
                      className="cms-input w-full"
                      value={winningBonusTypeFilter}
                      onChange={(e) =>
                        setWinningBonusTypeFilter(e.target.value as WinningBonusTypeFilter)
                      }
                    >
                      <option value="all">All bonus points</option>
                      <option value="try_bonus">Try bonus points</option>
                      <option value="losing_bonus">Losing bonus points</option>
                      <option value="maximum_point_wins">Maximum-point wins</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="block text-zinc-500 mb-1">Sort by</span>
                    <select
                      className="cms-input w-full"
                      value={winningBonusPointsSortBy}
                      onChange={(e) =>
                        setWinningBonusPointsSortBy(e.target.value as WinningBonusPointsSortBy)
                      }
                    >
                      <option value="total_bonus_points">Total bonus points</option>
                      <option value="try_bonus_points">Try bonus points</option>
                      <option value="losing_bonus_points">Losing bonus points</option>
                      <option value="maximum_point_wins">Maximum-point wins</option>
                      <option value="bonus_point_rate_pct">Bonus point rate %</option>
                      <option value="bonus_points_per_match">Bonus points per match</option>
                    </select>
                  </label>
                </>
              ) : null}
            </>
          ) : null}
          {isLeadProtectionTable ? (
            <>
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Lead position</span>
                <select
                  className="cms-input w-full"
                  value={leadPositionFilter}
                  onChange={(e) => setLeadPositionFilter(e.target.value as LeadPositionFilter)}
                >
                  <option value="any_time">Ahead at any time</option>
                  <option value="half_time">Ahead at half-time</option>
                  <option value="after_sixty">Ahead after 60 minutes</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Minimum lead</span>
                <select
                  className="cms-input w-full"
                  value={minimumLeadPreset}
                  onChange={(e) => setMinimumLeadPreset(e.target.value as MinimumLeadPreset)}
                >
                  <option value="any">Any lead</option>
                  <option value="3">3+ points</option>
                  <option value="7">7+ points</option>
                  <option value="10">10+ points</option>
                  <option value="14">14+ points</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              {minimumLeadPreset === "custom" ? (
                <label className="text-sm">
                  <span className="block text-zinc-500 mb-1">Custom minimum lead</span>
                  <input
                    type="number"
                    min={1}
                    className="cms-input w-full"
                    value={customMinimumLead}
                    onChange={(e) => setCustomMinimumLead(e.target.value)}
                    placeholder="e.g. 5"
                  />
                </label>
              ) : null}
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Sort by</span>
                <select
                  className="cms-input w-full"
                  value={leadProtectionSortBy}
                  onChange={(e) =>
                    setLeadProtectionSortBy(e.target.value as LeadProtectionSortBy)
                  }
                >
                  <option value="lead_protection_pct">Lead protection %</option>
                  <option value="most_wins_after_leading">Most wins after leading</option>
                  <option value="fewest_points_lost">Fewest points lost</option>
                  <option value="fewest_losses_after_leading">Fewest losses after leading</option>
                  <option value="largest_lead_lost">Largest lead lost</option>
                  <option value="sixty_minute_lead_protection_pct">
                    Best 60-minute lead protection
                  </option>
                </select>
              </label>
            </>
          ) : null}
          {isComebackTable ? (
            <>
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Comeback from</span>
                <select
                  className="cms-input w-full"
                  value={comebackFromFilter}
                  onChange={(e) => setComebackFromFilter(e.target.value as ComebackFromFilter)}
                >
                  <option value="any_time">Behind at any time</option>
                  <option value="half_time">Behind at half-time</option>
                  <option value="after_sixty">Behind after 60 minutes</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Minimum deficit</span>
                <select
                  className="cms-input w-full"
                  value={minimumDeficitPreset}
                  onChange={(e) =>
                    setMinimumDeficitPreset(e.target.value as MinimumDeficitPreset)
                  }
                >
                  <option value="any">Any deficit</option>
                  <option value="3">3+ points</option>
                  <option value="7">7+ points</option>
                  <option value="10">10+ points</option>
                  <option value="14">14+ points</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              {minimumDeficitPreset === "custom" ? (
                <label className="text-sm">
                  <span className="block text-zinc-500 mb-1">Custom minimum deficit</span>
                  <input
                    type="number"
                    min={1}
                    className="cms-input w-full"
                    value={customMinimumDeficit}
                    onChange={(e) => setCustomMinimumDeficit(e.target.value)}
                    placeholder="e.g. 5"
                  />
                </label>
              ) : null}
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Sort by</span>
                <select
                  className="cms-input w-full"
                  value={comebackSortBy}
                  onChange={(e) => setComebackSortBy(e.target.value as ComebackSortBy)}
                >
                  <option value="comeback_wins">Comeback wins</option>
                  <option value="total_successful_comebacks">Total successful comebacks</option>
                  <option value="comeback_success_pct">Comeback success %</option>
                  <option value="largest_deficit_overcome">Largest deficit overcome</option>
                  <option value="table_points_gained">Table points gained</option>
                  <option value="final_20_comebacks">Final 20 comebacks</option>
                </select>
              </label>
            </>
          ) : null}
          {isPointsLostWinningTable ? (
            <>
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Winning position</span>
                <select
                  className="cms-input w-full"
                  value={winningPositionFilter}
                  onChange={(e) =>
                    setWinningPositionFilter(e.target.value as WinningPositionFilter)
                  }
                >
                  <option value="any_time">Ahead at any time</option>
                  <option value="half_time">Ahead at half-time</option>
                  <option value="after_sixty">Ahead after 60 minutes</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Sort by</span>
                <select
                  className="cms-input w-full"
                  value={pointsLostWinningSortBy}
                  onChange={(e) =>
                    setPointsLostWinningSortBy(e.target.value as PointsLostWinningSortBy)
                  }
                >
                  <option value="points_lost">Points lost</option>
                  <option value="fewest_points_lost">Fewest points lost</option>
                  <option value="losses_after_leading">Losses after leading</option>
                  <option value="draws_after_leading">Draws after leading</option>
                  <option value="lead_protection_pct">Best lead protection %</option>
                  <option value="most_wins_after_leading">Most wins after leading</option>
                </select>
              </label>
            </>
          ) : null}
          {isPointsGainedLosingTable ? (
            <>
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Losing position</span>
                <select
                  className="cms-input w-full"
                  value={losingPositionFilter}
                  onChange={(e) =>
                    setLosingPositionFilter(e.target.value as LosingPositionFilter)
                  }
                >
                  <option value="any_time">Behind at any time</option>
                  <option value="half_time">Behind at half-time</option>
                  <option value="after_sixty">Behind after 60 minutes</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Sort by</span>
                <select
                  className="cms-input w-full"
                  value={pointsGainedLosingSortBy}
                  onChange={(e) =>
                    setPointsGainedLosingSortBy(e.target.value as PointsGainedLosingSortBy)
                  }
                >
                  <option value="points_gained">Points gained</option>
                  <option value="comeback_wins">Comeback wins</option>
                  <option value="comeback_win_pct">Comeback win %</option>
                  <option value="avg_points_gained">Average points gained per match</option>
                </select>
              </label>
            </>
          ) : null}
          {isConcedingFirstTable ? (
            <>
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">First score conceded type</span>
                <select
                  className="cms-input w-full"
                  value={firstScoreType}
                  onChange={(e) => setFirstScoreType(e.target.value as FirstScoreTypeFilter)}
                >
                  <option value="any">Any score</option>
                  <option value="try">Try</option>
                  <option value="penalty">Penalty</option>
                  <option value="drop_goal">Drop goal</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Sort by</span>
                <select
                  className="cms-input w-full"
                  value={concedingFirstSortBy}
                  onChange={(e) =>
                    setConcedingFirstSortBy(e.target.value as ConcedingFirstSortBy)
                  }
                >
                  <option value="league_points">Table points</option>
                  <option value="comeback_wins">Comeback wins</option>
                  <option value="comeback_win_pct">Comeback win %</option>
                  <option value="points_gained_after_conceding_first">
                    Points gained after conceding first
                  </option>
                </select>
              </label>
            </>
          ) : null}
          {isScoringFirstTable ? (
            <>
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">First score type</span>
                <select
                  className="cms-input w-full"
                  value={firstScoreType}
                  onChange={(e) => setFirstScoreType(e.target.value as FirstScoreTypeFilter)}
                >
                  <option value="any">Any score</option>
                  <option value="try">Try</option>
                  <option value="penalty">Penalty</option>
                  <option value="drop_goal">Drop goal</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-zinc-500 mb-1">Sort by</span>
                <select
                  className="cms-input w-full"
                  value={scoringFirstSortBy}
                  onChange={(e) => setScoringFirstSortBy(e.target.value as ScoringFirstSortBy)}
                >
                  <option value="league_points">Table points</option>
                  <option value="win_pct">Win %</option>
                  <option value="lead_converted_win_pct">Lead converted into win %</option>
                  <option value="matches_scoring_first_pct">Matches scoring first %</option>
                </select>
              </label>
            </>
          ) : null}
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">
              {tableId === "home_table"
                ? "Minimum home matches"
                : tableId === "away_table"
                  ? "Minimum away matches"
                  : "Minimum matches played"}
            </span>
            <input
              type="number"
              min={1}
              max={50}
              className="cms-input w-full"
              value={minMatchesPlayed}
              onChange={(e) => setMinMatchesPlayed(parseMinMatchesPlayed(e.target.value))}
            />
          </label>
        </div>
      ) : null}

      {tableId === "hemisphere_table" ? (
        <div className="cms-card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">Table mode</span>
            <select
              className="cms-input w-full"
              value={hemisphereMode}
              onChange={(e) => setHemisphereMode(e.target.value as HemisphereTableMode)}
            >
              <option value="summary">Hemisphere summary</option>
              <option value="breakdown">Team breakdown</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">Match type</span>
            <select
              className="cms-input w-full"
              value={hemisphereMatchType}
              onChange={(e) => setHemisphereMatchType(e.target.value as HemisphereMatchType)}
            >
              <option value="all">All</option>
              <option value="club">Club</option>
              <option value="international">International</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">Include unknown</span>
            <select
              className="cms-input w-full"
              value={includeUnknownHemisphere ? "yes" : "no"}
              onChange={(e) => setIncludeUnknownHemisphere(e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">Date from</span>
            <input
              type="date"
              className="cms-input w-full"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">Date to</span>
            <input
              type="date"
              className="cms-input w-full"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
        </div>
      ) : null}

      {isFinalTwentyTable ? (
        <div className="cms-card mb-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">Include extra time</span>
            <select
              className="cms-input w-full"
              value={includeExtraTime ? "yes" : "no"}
              onChange={(e) => setIncludeExtraTime(e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
        </div>
      ) : null}

      {!loading && !competitionId ? (
        <p className="text-sm text-zinc-500 mb-4">
          Import a competition and fixtures first, then pick a league to build tables.
        </p>
      ) : null}

      {building && !result ? <p className="text-sm text-zinc-500">Building table…</p> : null}
      {result ? (
        <>
          <TableLabMetaPanel result={result} />
          <TableLabResultsTable result={result} />
        </>
      ) : null}
    </>
  );
}
