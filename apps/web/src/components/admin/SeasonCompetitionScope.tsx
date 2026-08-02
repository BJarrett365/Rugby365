"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TeamPickerGroup } from "@/lib/team-picker-groups";
import { pickDefaultSeasonForPicker } from "@/lib/season-list-utils";
import { groupCompetitionsForAdmin } from "@/lib/competition-admin-groups";
import { competitionPickerLabel } from "@/lib/competition-picker-labels";

type CompetitionOption = {
  id: string;
  name: string;
  slug: string;
  competitionType: string;
  activeSeason?: { id: string; label: string } | null;
};

type SeasonOption = {
  id: string;
  label: string;
  year: number;
  displayLabel?: string;
  isActive?: boolean;
};

export type SeasonCompetitionScopeValue = {
  competitionId: string;
  seasonId: string;
};

type Props = {
  value: SeasonCompetitionScopeValue;
  onChange: (value: SeasonCompetitionScopeValue) => void;
  /** When true, team lists fall back to global (all-time) picker if scope incomplete. */
  allowGlobalFallback?: boolean;
  className?: string;
};

export function SeasonCompetitionScope({ value, onChange, className }: Props) {
  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(false);

  useEffect(() => {
    fetch("/api/admin/competitions")
      .then((res) => res.json())
      .then((data) => setCompetitions(data.competitions ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!value.competitionId) {
      setSeasons([]);
      return;
    }
    setSeasons([]);
    setLoadingSeasons(true);
    fetch(`/api/admin/seasons?competitionId=${encodeURIComponent(value.competitionId)}`)
      .then((res) => res.json())
      .then((data) => {
        const rows: SeasonOption[] = data.seasons ?? [];
        const seasonKind = (data.seasonKind ?? "club") as "club" | "international" | "tournament";
        setSeasons(rows);
        if (rows.length > 0) {
          const keepCurrent = value.seasonId && rows.some((row) => row.id === value.seasonId);
          if (!keepCurrent) {
            const picked = pickDefaultSeasonForPicker(rows, new Date(), seasonKind);
            if (picked) {
              onChange({ competitionId: value.competitionId, seasonId: picked.id });
            }
          }
        }
      })
      .catch(() => setSeasons([]))
      .finally(() => setLoadingSeasons(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload seasons when competition changes
  }, [value.competitionId]);

  const onCompetitionChange = (competitionId: string) => {
    setSeasons([]);
    onChange({ competitionId, seasonId: "" });
  };

  const competitionGroups = useMemo(
    () => groupCompetitionsForAdmin(competitions),
    [competitions],
  );

  return (
    <div className={className ?? "flex flex-wrap gap-3"}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-400">Competition</span>
        <select
          className="cms-select min-w-[16rem]"
          value={value.competitionId}
          onChange={(e) => onCompetitionChange(e.target.value)}
        >
          <option value="">All competitions</option>
          {competitionGroups.map((group) => (
            <optgroup key={group.id} label={group.label}>
              {group.competitions.map((row) => (
                <option key={row.id} value={row.id}>
                  {competitionPickerLabel(row)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-400">Season</span>
        <select
          className="cms-select min-w-[10rem]"
          value={value.seasonId}
          disabled={!value.competitionId || loadingSeasons}
          onChange={(e) =>
            onChange({ competitionId: value.competitionId, seasonId: e.target.value })
          }
        >
          <option value="">{loadingSeasons ? "Loading…" : "Select season"}</option>
          {seasons.map((row) => (
            <option key={row.id} value={row.id}>
              {row.displayLabel ?? row.label}
            </option>
          ))}
        </select>
        {seasons.length > 1 ? (
          <span className="text-xs text-zinc-500">
            {seasons.length} seasons · scroll for{" "}
            {seasons[seasons.length - 1]?.displayLabel ?? seasons[seasons.length - 1]?.label} →{" "}
            {seasons[0]?.displayLabel ?? seasons[0]?.label}
          </span>
        ) : null}
      </label>
    </div>
  );
}

export function useSeasonScopedTeamGroups(scope: SeasonCompetitionScopeValue, global = false) {
  const [groups, setGroups] = useState<TeamPickerGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const scoped = Boolean(scope.competitionId && scope.seasonId);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ grouped: "1" });
    if (!global && scoped) {
      params.set("competitionId", scope.competitionId);
      params.set("seasonId", scope.seasonId);
    }
    const res = await fetch(`/api/admin/teams?${params}`);
    const data = await res.json();
    setGroups(data.groups ?? []);
    setLoading(false);
  }, [global, scoped, scope.competitionId, scope.seasonId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  return { groups, loading, scoped, reload: load };
}

export function useDefaultPremiershipScope(competitions: CompetitionOption[]) {
  return useMemo(() => {
    const prem = competitions.find((row) => row.slug === "premiership");
    if (!prem?.activeSeason?.id) {
      return { competitionId: prem?.id ?? "", seasonId: "" };
    }
    return { competitionId: prem.id, seasonId: prem.activeSeason.id };
  }, [competitions]);
}
