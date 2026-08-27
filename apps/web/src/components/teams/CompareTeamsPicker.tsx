"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CompareTeamsResult } from "@/components/teams/CompareTeamsResult";
import { NATIONS_CHAMPIONSHIP_COMPETITION_SLUG } from "@/lib/nations-championship-hemisphere";
import { isRugbyWorldCupSlug } from "@/lib/rugby-world-cup-pools";

type CompetitionOption = { id: string; slug: string; name: string };
type TeamOption = { id: string; name: string; slug: string; shortName: string | null };

type Side = "a" | "b";

type SideState = {
  competitionSlug: string;
  seasonLabel: string;
  teamSlug: string;
  teams: TeamOption[];
  rosterLoading: boolean;
  rosterError: string | null;
};

type Props = {
  competitionSlug?: string;
  competitionName?: string;
};

function emptySide(competitionSlug = ""): SideState {
  return {
    competitionSlug,
    seasonLabel: "",
    teamSlug: "",
    teams: [],
    rosterLoading: false,
    rosterError: null,
  };
}

function useSideTeams(
  competitionSlug: string,
  seasonLabel: string,
  setSide: (updater: (prev: SideState) => SideState) => void,
) {
  useEffect(() => {
    const slug = competitionSlug.trim();
    if (!slug) {
      setSide((prev) => ({
        ...prev,
        teams: [],
        teamSlug: "",
        rosterLoading: false,
        rosterError: null,
      }));
      return;
    }

    let cancelled = false;
    setSide((prev) => ({
      ...prev,
      rosterLoading: true,
      rosterError: null,
      teamSlug: "",
      teams: [],
    }));

    void (async () => {
      try {
        const params = new URLSearchParams();
        if (seasonLabel.trim()) params.set("season", seasonLabel.trim());
        const qs = params.toString();
        const res = await fetch(
          `/api/competitions/by-slug/${encodeURIComponent(slug)}/compare-roster${qs ? `?${qs}` : ""}`,
          { cache: "no-store" },
        );
        const json = (await res.json().catch(() => ({}))) as {
          teams?: TeamOption[];
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "Failed to load teams");
        if (cancelled) return;
        setSide((prev) => ({
          ...prev,
          teams: json.teams ?? [],
          rosterLoading: false,
          rosterError: null,
        }));
      } catch (e) {
        if (cancelled) return;
        setSide((prev) => ({
          ...prev,
          teams: [],
          rosterLoading: false,
          rosterError: e instanceof Error ? e.message : "Failed to load teams",
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [competitionSlug, seasonLabel, setSide]);
}

export function CompareTeamsPicker({ competitionSlug, competitionName }: Props) {
  const hubSlug = competitionSlug?.trim() ?? "";
  const defaultCompetitionSlug = hubSlug || NATIONS_CHAMPIONSHIP_COMPETITION_SLUG;

  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [competitionsLoading, setCompetitionsLoading] = useState(true);
  const [competitionsError, setCompetitionsError] = useState<string | null>(null);
  const [seasonsBySlug, setSeasonsBySlug] = useState<Record<string, Array<{ label: string; year: number }>>>({});
  const [sideA, setSideA] = useState<SideState>(() => emptySide(defaultCompetitionSlug));
  const [sideB, setSideB] = useState<SideState>(() => emptySide(defaultCompetitionSlug));

  useEffect(() => {
    let cancelled = false;
    setCompetitionsLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/competitions/list", { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as {
          competitions?: CompetitionOption[];
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "Failed to load competitions");
        if (cancelled) return;
        const list = json.competitions ?? [];
        setCompetitions(list);

        const nations =
          list.find((c) => c.slug === NATIONS_CHAMPIONSHIP_COMPETITION_SLUG) ??
          list.find((c) => c.name.trim().toLowerCase() === "nations championship");
        const hubMatch =
          (hubSlug ? list.find((c) => c.slug === hubSlug) : undefined) ??
          (competitionName
            ? list.find((c) => c.name.trim().toLowerCase() === competitionName.trim().toLowerCase())
            : undefined);
        const resolvedDefault =
          (hubSlug ? hubMatch?.slug ?? hubSlug : null) ??
          nations?.slug ??
          NATIONS_CHAMPIONSHIP_COMPETITION_SLUG;

        const ensure = (prev: SideState): SideState => {
          const current = prev.competitionSlug.trim();
          if (!current) return { ...prev, competitionSlug: resolvedDefault };
          if (current === hubSlug && hubMatch && hubMatch.slug !== current) {
            return { ...prev, competitionSlug: hubMatch.slug };
          }
          if (list.some((c) => c.slug === current)) return prev;
          return { ...prev, competitionSlug: resolvedDefault };
        };
        setSideA(ensure);
        setSideB(ensure);
      } catch (e) {
        if (!cancelled) {
          setCompetitions([]);
          setCompetitionsError(e instanceof Error ? e.message : "Failed to load competitions");
        }
      } finally {
        if (!cancelled) setCompetitionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hubSlug, competitionName]);

  useEffect(() => {
    const slugs = [...new Set([sideA.competitionSlug, sideB.competitionSlug].filter(isRugbyWorldCupSlug))];
    if (slugs.length === 0) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, Array<{ label: string; year: number }>> = {};
      await Promise.all(
        slugs.map(async (slug) => {
          const res = await fetch(`/api/competitions/by-slug/${encodeURIComponent(slug)}`, { cache: "no-store" });
          const json = (await res.json().catch(() => ({}))) as {
            seasons?: Array<{ label: string; year: number }>;
          };
          next[slug] = (json.seasons ?? []).filter((s) => s.year <= 2023 || s.label);
        }),
      );
      if (!cancelled) {
        setSeasonsBySlug((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sideA.competitionSlug, sideB.competitionSlug]);

  useSideTeams(sideA.competitionSlug, sideA.seasonLabel, setSideA);
  useSideTeams(sideB.competitionSlug, sideB.seasonLabel, setSideB);

  const canCompare = Boolean(sideA.teamSlug && sideB.teamSlug && sideA.teamSlug !== sideB.teamSlug);

  const competitionOptions = useMemo(() => {
    const list = [...competitions];
    for (const slug of [sideA.competitionSlug, sideB.competitionSlug, hubSlug]) {
      if (!slug || list.some((c) => c.slug === slug)) continue;
      list.push({
        id: slug,
        slug,
        name: competitionName && slug === hubSlug ? competitionName : slug,
      });
    }
    return list.sort((a, b) => {
      const rank = (c: CompetitionOption) => {
        if (hubSlug && (c.slug === hubSlug || c.name === competitionName)) return 0;
        if (
          c.slug === NATIONS_CHAMPIONSHIP_COMPETITION_SLUG ||
          c.name.trim().toLowerCase() === "nations championship"
        ) {
          return hubSlug ? 1 : 0;
        }
        return 2;
      };
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [competitions, sideA.competitionSlug, sideB.competitionSlug, hubSlug, competitionName]);

  const setCompetition = (side: Side, slug: string) => {
    const apply = (prev: SideState): SideState => ({
      ...prev,
      competitionSlug: slug,
      seasonLabel: "",
      teamSlug: "",
      teams: [],
      rosterError: null,
    });
    if (side === "a") setSideA(apply);
    else setSideB(apply);
  };

  const setSeason = (side: Side, seasonLabel: string) => {
    if (side === "a") setSideA((prev) => ({ ...prev, seasonLabel, teamSlug: "" }));
    else setSideB((prev) => ({ ...prev, seasonLabel, teamSlug: "" }));
  };

  const setTeam = (side: Side, teamSlug: string) => {
    if (side === "a") setSideA((prev) => ({ ...prev, teamSlug }));
    else setSideB((prev) => ({ ...prev, teamSlug }));
  };

  const renderSide = (side: Side) => {
    const state = side === "a" ? sideA : sideB;
    const other = side === "a" ? sideB : sideA;
    const competitionReady = Boolean(state.competitionSlug.trim());

    return (
      <div className="rounded-xl border border-[var(--pr-mc-border)] bg-[var(--pr-mc-panel)] p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pr-mc-grey)] m-0">
          Team {side.toUpperCase()}
        </p>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--pr-mc-muted)]">1. Competition</span>
          <select
            className="w-full rounded-lg border border-[var(--pr-mc-border)] bg-[var(--pr-mc-bg)] px-3 py-2 text-sm text-[var(--pr-mc-text)] disabled:opacity-50"
            value={state.competitionSlug}
            disabled={competitionsLoading || competitionOptions.length === 0}
            onChange={(e) => setCompetition(side, e.target.value)}
          >
            <option value="">
              {competitionsLoading ? "Loading competitions…" : "Select a competition"}
            </option>
            {competitionOptions.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {isRugbyWorldCupSlug(state.competitionSlug) ? (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--pr-mc-muted)]">2. World Cup</span>
            <select
              className="w-full rounded-lg border border-[var(--pr-mc-border)] bg-[var(--pr-mc-bg)] px-3 py-2 text-sm text-[var(--pr-mc-text)]"
              value={state.seasonLabel}
              onChange={(e) => setSeason(side, e.target.value)}
            >
              <option value="">All World Cups (unique nations)</option>
              {(seasonsBySlug[state.competitionSlug] ?? []).map((season) => (
                <option key={season.label} value={season.label}>
                  {season.year || season.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {state.rosterLoading ? (
          <p className="m-0 text-xs text-[var(--pr-mc-muted)]">Loading teams…</p>
        ) : null}
        {state.rosterError ? (
          <p className="m-0 text-xs text-red-300">{state.rosterError}</p>
        ) : null}

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--pr-mc-muted)]">
            {isRugbyWorldCupSlug(state.competitionSlug) ? "3. Team" : "2. Team"}
          </span>
          <select
            className="w-full rounded-lg border border-[var(--pr-mc-border)] bg-[var(--pr-mc-bg)] px-3 py-2 text-sm text-[var(--pr-mc-text)] disabled:opacity-50"
            value={state.teamSlug}
            disabled={!competitionReady || state.rosterLoading || state.teams.length === 0}
            onChange={(e) => setTeam(side, e.target.value)}
          >
            <option value="">
              {!competitionReady
                ? "Select a competition first"
                : state.rosterLoading
                  ? "Loading teams…"
                  : state.teams.length === 0
                    ? "No teams available"
                    : "Select a team"}
            </option>
            {state.teams.map((t) => (
              <option key={t.id} value={t.slug} disabled={t.slug === other.teamSlug}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {competitionsError ? (
        <p className="m-0 text-sm text-red-300">{competitionsError}</p>
      ) : null}

      <p className="m-0 text-sm text-[var(--pr-mc-muted)]">
        {hubSlug
          ? `Both sides start on ${competitionName || "this competition"} — switch either side to compare across competitions.`
          : "Defaults to Nations Championship — pick any two teams for a side-by-side intelligence compare."}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {renderSide("a")}
        {renderSide("b")}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {canCompare ? (
          <Link
            href={`/teams/${encodeURIComponent(sideA.teamSlug)}/compare/${encodeURIComponent(sideB.teamSlug)}`}
            className="cms-btn cms-btn--primary touch-target"
          >
            Open full compare
          </Link>
        ) : (
          <button type="button" className="cms-btn cms-btn--primary touch-target" disabled>
            Select two teams to compare
          </button>
        )}
        {hubSlug ? (
          <Link
            href={`/competitions/${encodeURIComponent(hubSlug)}/table`}
            className="text-sm text-[var(--pr-mc-link,#54b989)] hover:underline"
          >
            Back to table
          </Link>
        ) : (
          <Link href="/players/compare" className="text-sm text-[var(--pr-mc-link,#54b989)] hover:underline">
            Compare players
          </Link>
        )}
      </div>

      {canCompare ? (
        <CompareTeamsResult slugA={sideA.teamSlug} slugB={sideB.teamSlug} />
      ) : null}
    </div>
  );
}
