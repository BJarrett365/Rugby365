"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  SeasonCompetitionScope,
  type SeasonCompetitionScopeValue,
} from "@/components/admin/SeasonCompetitionScope";
import type { TeamPickerGroup } from "@/lib/team-picker-groups";

type TeamRow = {
  id: string;
  name: string;
  slug: string;
  shortName: string | null;
  externalProviderId: string | null;
  sourceProvider: string;
};

type CompetitionRow = {
  id: string;
  name: string;
  slug: string;
  competitionType: string;
  activeSeason?: { id: string; label?: string } | null;
};

export default function TeamsAdminPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [groups, setGroups] = useState<TeamPickerGroup[]>([]);
  const [scope, setScope] = useState<SeasonCompetitionScopeValue>({ competitionId: "", seasonId: "" });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicateGroups, setDuplicateGroups] = useState(0);
  const [duplicateRows, setDuplicateRows] = useState(0);
  const [deduping, setDeduping] = useState(false);

  useEffect(() => {
    fetch("/api/admin/competitions")
      .then((res) => res.json())
      .then((data) => {
        const competitions = (data.competitions ?? []) as CompetitionRow[];
        const prem = competitions.find((row) => row.slug === "premiership");
        if (prem?.activeSeason?.id) {
          setScope({ competitionId: prem.id, seasonId: prem.activeSeason.id });
        }
      })
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ grouped: "1" });
    if (scope.competitionId && scope.seasonId) {
      params.set("competitionId", scope.competitionId);
      params.set("seasonId", scope.seasonId);
    }
    const [teamsRes, dupRes] = await Promise.all([
      fetch(`/api/admin/teams?${params}`),
      fetch("/api/admin/entities/duplicates"),
    ]);
    const data = await teamsRes.json();
    const dupData = await dupRes.json();
    setTeams(data.teams ?? []);
    setGroups(data.groups ?? []);
    setDuplicateGroups(dupData.teams?.groups ?? 0);
    setDuplicateRows(dupData.teams?.rows ?? 0);
    setLoading(false);
  }, [scope.competitionId, scope.seasonId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const visibleGroups = useMemo(() => groups, [groups]);

  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);

  async function remove(id: string, name: string) {
    if (!confirm(`Delete team “${name}”?`)) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/teams/${id}`, { method: "DELETE" });
    if (res.ok) await load();
    else {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
    setDeletingId(null);
  }

  async function mergeDuplicates() {
    if (duplicateRows === 0) return;
    if (
      !confirm(
        `Merge ${duplicateRows} duplicate team record${duplicateRows === 1 ? "" : "s"} across ${duplicateGroups} group${duplicateGroups === 1 ? "" : "s"}? The best-quality name and external ID will be kept.`,
      )
    ) {
      return;
    }
    setDeduping(true);
    const res = await fetch("/api/admin/entities/dedupe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "teams" }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Merged ${data.teams?.deleted ?? 0} duplicate team record(s).`);
      await load();
    } else {
      alert(data.error ?? "Merge failed");
    }
    setDeduping(false);
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Teams"
        description="Manage national and club teams. Scoped by competition and season — standings first, fixtures fallback."
        actions={
          <div className="flex flex-wrap gap-2">
            {duplicateRows > 0 ? (
              <button
                type="button"
                disabled={deduping}
                onClick={mergeDuplicates}
                className="cms-btn cms-btn--secondary touch-target"
              >
                {deduping
                  ? "Merging…"
                  : `Merge ${duplicateRows} duplicate${duplicateRows === 1 ? "" : "s"}`}
              </button>
            ) : null}
            <Link href="/admin/teams/new" className="cms-btn cms-btn--primary touch-target">
              New team
            </Link>
          </div>
        }
      />

      <div className="cms-card mb-4 space-y-3">
        <p className="text-sm text-zinc-400 m-0">
          Teams are loaded for the selected competition and canonical season only (not all-time).
        </p>
        <SeasonCompetitionScope value={scope} onChange={setScope} />
        <p className="text-xs text-zinc-500 m-0">
          <Link href="/admin/data-audit" className="text-zinc-300 underline">
            Data audit
          </Link>{" "}
          — duplicate seasons, historic clubs in current season, alias gaps.
        </p>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : teams.length === 0 ? (
        <div className="cms-card">
          <p className="text-zinc-400 m-0">No teams yet.</p>
        </div>
      ) : visibleGroups.length === 0 ? (
        <div className="cms-card">
          <p className="text-zinc-400 m-0">No teams match this competition filter.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {visibleGroups.map((group) => (
            <section key={group.id}>
              <h2 className="text-lg font-semibold text-zinc-200 mb-3">{group.label}</h2>
              <div className="space-y-3">
                {group.teams.map((teamRef) => {
                  const t = teamById.get(teamRef.id);
                  if (!t) return null;
                  return (
                    <article key={t.id} className="cms-card">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-semibold text-lg m-0">{t.name}</h3>
                          <p className="text-sm text-zinc-500 m-0 mt-1">
                            {t.shortName ?? "—"} · {t.sourceProvider}
                          </p>
                          <p className="text-xs text-zinc-600 m-0 mt-1">Slug: {t.slug}</p>
                          {t.externalProviderId && (
                            <p className="text-xs text-zinc-600 m-0 mt-1">Sport365: {t.externalProviderId}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/admin/teams/${t.id}/edit`} className="cms-btn cms-btn--secondary text-xs">
                            Edit
                          </Link>
                          <button
                            type="button"
                            disabled={deletingId === t.id}
                            onClick={() => remove(t.id, t.name)}
                            className="cms-btn cms-btn--secondary text-xs text-red-400"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
