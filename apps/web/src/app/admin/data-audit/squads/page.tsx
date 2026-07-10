"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  SeasonCompetitionScope,
  type SeasonCompetitionScopeValue,
} from "@/components/admin/SeasonCompetitionScope";
import type { FullSquadAuditReport, TeamSeasonSquadAudit } from "@/lib/player-squad-audit-service";

function TeamAuditCard({ audit }: { audit: TeamSeasonSquadAudit }) {
  const hasIssues =
    audit.historicLeaking.length > 0 ||
    audit.departed.length > 0 ||
    audit.duplicateGroups.length > 0 ||
    audit.reversedNames.length > 0 ||
    audit.noSeasonMembership.length > 0;

  if (!hasIssues) return null;

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">
          {audit.teamName} — {audit.seasonLabel}
        </h2>
        <span className="text-xs text-zinc-500">{audit.competitionName}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 text-sm">
        <div>
          <h3 className="text-emerald-300 mb-1">Valid current ({audit.validCurrent.length})</h3>
          <p className="text-zinc-400 m-0">{audit.validCurrent.map((p) => p.name).join(", ") || "—"}</p>
        </div>
        <div>
          <h3 className="text-sky-300 mb-1">Incoming ({audit.incoming.length})</h3>
          <p className="text-zinc-400 m-0">{audit.incoming.map((p) => p.name).join(", ") || "—"}</p>
        </div>
        <div>
          <h3 className="text-amber-300 mb-1">Departed still shown ({audit.departed.length})</h3>
          <ul className="text-zinc-400 m-0 pl-4">
            {audit.departed.map((p) => (
              <li key={p.id}>
                {p.name}
                {p.destinationClub ? ` → ${p.destinationClub}` : ""}
                {p.source ? ` (${p.source})` : ""}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-red-300 mb-1">Historic leaking ({audit.historicLeaking.length})</h3>
          <p className="text-zinc-400 m-0">{audit.historicLeaking.map((p) => p.name).join(", ") || "—"}</p>
        </div>
        <div>
          <h3 className="text-orange-300 mb-1">Duplicates ({audit.duplicateGroups.length})</h3>
          <ul className="text-zinc-400 m-0 pl-4">
            {audit.duplicateGroups.map((group) => (
              <li key={group.key}>{group.players.map((p) => p.name).join(" / ")}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-violet-300 mb-1">Reversed names ({audit.reversedNames.length})</h3>
          <ul className="text-zinc-400 m-0 pl-4">
            {audit.reversedNames.map((p) => (
              <li key={p.id}>
                {p.name} → {p.suggestedName}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default function SquadAuditAdminPage() {
  const [report, setReport] = useState<FullSquadAuditReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuild, setRebuild] = useState(false);
  const [scope, setScope] = useState<SeasonCompetitionScopeValue>({ competitionId: "", seasonId: "" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (scope.competitionId) params.set("competitionId", scope.competitionId);
      if (scope.seasonId) params.set("seasonId", scope.seasonId);
      if (rebuild) params.set("rebuild", "1");
      const res = await fetch(`/api/admin/player-squad-audit?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Audit failed");
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }, [rebuild, scope.competitionId, scope.seasonId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const teamsWithIssues = useMemo(
    () =>
      (report?.teams ?? []).filter(
        (team) =>
          team.historicLeaking.length > 0 ||
          team.departed.length > 0 ||
          team.duplicateGroups.length > 0 ||
          team.reversedNames.length > 0,
      ),
    [report],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Squad & membership audit"
        description="Compare Rugby365 club_team_id lists with season memberships, fixture squads and confirmed transfers."
        actions={
          <div className="flex gap-2">
            <Link href="/admin/data-audit" className="cms-button-secondary">
              Data audit
            </Link>
            <button type="button" className="cms-button-secondary" onClick={() => load()} disabled={loading}>
              {loading ? "Running…" : "Re-run"}
            </button>
          </div>
        }
      />

      <div className="cms-card space-y-4">
        <SeasonCompetitionScope value={scope} onChange={setScope} />
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input type="checkbox" checked={rebuild} onChange={(e) => setRebuild(e.target.checked)} />
          Rebuild memberships from fixtures / stats / transfers before audit
        </label>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded border border-zinc-800 p-3 text-sm">
              <div className="text-zinc-400">Teams audited</div>
              <div className="text-2xl">{report.teamCount}</div>
            </div>
            <div className="rounded border border-red-900/40 p-3 text-sm">
              <div className="text-red-300">Historic leaks</div>
              <div className="text-2xl">{report.totals.historicLeaking}</div>
            </div>
            <div className="rounded border border-amber-900/40 p-3 text-sm">
              <div className="text-amber-300">Departed stale</div>
              <div className="text-2xl">{report.totals.departed}</div>
            </div>
            <div className="rounded border border-orange-900/40 p-3 text-sm">
              <div className="text-orange-300">Duplicate groups</div>
              <div className="text-2xl">{report.totals.duplicateGroups}</div>
            </div>
          </div>

          {teamsWithIssues.length === 0 ? (
            <p className="text-sm text-zinc-400">No squad issues detected for the selected scope.</p>
          ) : (
            teamsWithIssues.map((team) => <TeamAuditCard key={`${team.teamId}-${team.seasonId}`} audit={team} />)
          )}
        </>
      ) : loading ? (
        <p className="text-sm text-zinc-400">Running squad audit…</p>
      ) : null}
    </div>
  );
}
