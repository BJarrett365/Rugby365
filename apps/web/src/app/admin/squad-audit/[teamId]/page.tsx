"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { CLUB_SQUAD_PARSER_OPTIONS, SQUAD_SOURCE_TYPE_OPTIONS } from "@/lib/club-squad-parser-registry";
import type { SquadAuditGroupType } from "@/lib/club-squad-compare-service";
import type { SquadAuditPlayerRow } from "@/lib/premiership-squad-audit-service";

type ClubDetail = {
  teamId: string;
  officialClubName: string;
  officialSquadUrl: string | null;
  sourceType: string;
  backupSourceType: string | null;
  importParser: string | null;
  status: string;
  sourceCheckedAt: string | null;
  lastError: string | null;
  teamName: string;
  summary: {
    playersOnOfficialSource: number;
    playersInRugby365: number;
    matched: number;
    missingInRugby365: number;
    extraInRugby365: number;
    positionConflicts: number;
    clubConflicts: number;
    latestJobId: string | null;
  } | null;
  latestJob: {
    id: string;
    status: string;
    jobType: string;
    error: string | null;
    report: Record<string, number>;
  } | null;
};

const GROUP_LABELS: Record<SquadAuditGroupType, string> = {
  matched: "Official squad matched in Rugby365",
  missing_in_rugby365: "Official squad missing in Rugby365",
  extra_in_rugby365: "Rugby365 player not on official squad",
  conflicting: "Conflicting records",
};

export default function SquadAuditClubPage({ params }: { params: Promise<{ teamId: string }> }) {
  const [teamId, setTeamId] = useState("");
  const [club, setClub] = useState<ClubDetail | null>(null);
  const [players, setPlayers] = useState<SquadAuditPlayerRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingSource, setSavingSource] = useState(false);
  const [jobRunning, setJobRunning] = useState(false);
  const [sourceForm, setSourceForm] = useState({
    officialSquadUrl: "",
    sourceType: "club_website",
    backupSourceType: "",
    importParser: "",
    notes: "",
  });
  const [filters, setFilters] = useState({
    groupType: "" as "" | SquadAuditGroupType,
    reviewStatus: "",
    matchConfidence: "",
    conflictType: "",
    sourceType: "",
  });

  useEffect(() => {
    void params.then((value) => setTeamId(value.teamId));
  }, [params]);

  const jobId = club?.latestJob?.id ?? club?.summary?.latestJobId ?? "";

  const loadClub = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/squad-audit/clubs/${teamId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load club");
      const loaded = data.club as ClubDetail;
      setClub(loaded);
      setSourceForm({
        officialSquadUrl: loaded.officialSquadUrl ?? "",
        sourceType: loaded.sourceType ?? "club_website",
        backupSourceType: loaded.backupSourceType ?? "",
        importParser: loaded.importParser ?? "",
        notes: "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load club");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const loadPlayers = useCallback(async () => {
    if (!teamId) return;
    setPlayersLoading(true);
    try {
      const qs = new URLSearchParams({
        teamId,
        page: String(pagination.page),
        pageSize: "20",
      });
      if (jobId) qs.set("jobId", jobId);
      if (filters.groupType) qs.set("groupType", filters.groupType);
      if (filters.reviewStatus) qs.set("reviewStatus", filters.reviewStatus);
      if (filters.matchConfidence) qs.set("matchConfidence", filters.matchConfidence);
      if (filters.conflictType) qs.set("conflictType", filters.conflictType);
      if (filters.sourceType) qs.set("sourceType", filters.sourceType);

      const res = await fetch(`/api/admin/squad-audit/players?${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load players");
      setPlayers(data.rows ?? []);
      setPagination({
        page: data.page ?? 1,
        pageSize: data.pageSize ?? 20,
        total: data.total ?? 0,
        totalPages: data.totalPages ?? 1,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load players");
    } finally {
      setPlayersLoading(false);
    }
  }, [teamId, jobId, pagination.page, filters]);

  useEffect(() => {
    void loadClub();
  }, [loadClub]);

  useEffect(() => {
    void loadPlayers();
  }, [loadPlayers]);

  const summary = club?.summary;
  const report = club?.latestJob?.report ?? {};

  async function saveSource() {
    setSavingSource(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/squad-audit/clubs/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sourceForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save source");
      setMessage("Source saved.");
      await loadClub();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save source");
    } finally {
      setSavingSource(false);
    }
  }

  async function runJob(jobType: "preview" | "dry_run" | "import") {
    setJobRunning(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/squad-audit/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, jobType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start job");
      setMessage(`${jobType} job queued (${data.job?.id ?? ""}).`);
      setTimeout(() => {
        void loadClub();
        void loadPlayers();
      }, 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start job");
    } finally {
      setJobRunning(false);
    }
  }

  async function runAction(action: string) {
    if (!jobId) return;
    setMessage("");
    try {
      const res = await fetch("/api/admin/squad-audit/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, teamId, jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setMessage(`Action ${action} completed.`);
      await loadClub();
      await loadPlayers();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of Object.keys(GROUP_LABELS)) counts[key] = 0;
    for (const row of players) counts[row.groupType] = (counts[row.groupType] ?? 0) + 1;
    return counts;
  }, [players]);

  if (loading && !club) {
    return <p className="text-sm text-zinc-500">Loading club audit…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={club?.teamName ?? "Club squad audit"}
        description="Preview official squad data, review differences, approve changes, then import one club at a time."
        actions={
          <Link href="/admin/squad-audit" className="text-sm text-emerald-400 hover:underline">
            ← All clubs
          </Link>
        }
      />

      {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-400 m-0">{message}</p> : null}
      {club?.lastError ? <p className="text-sm text-amber-400 m-0">Last error: {club.lastError}</p> : null}

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
        <h2 className="text-lg font-medium m-0">Source setup</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm space-y-1">
            <span className="text-zinc-400">Official squad URL</span>
            <input
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              value={sourceForm.officialSquadUrl}
              onChange={(e) => setSourceForm((prev) => ({ ...prev, officialSquadUrl: e.target.value }))}
            />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-zinc-400">Import parser</span>
            <select
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              value={sourceForm.importParser}
              onChange={(e) => setSourceForm((prev) => ({ ...prev, importParser: e.target.value }))}
            >
              <option value="">Select parser</option>
              {CLUB_SQUAD_PARSER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-zinc-400">Source type</span>
            <select
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              value={sourceForm.sourceType}
              onChange={(e) => setSourceForm((prev) => ({ ...prev, sourceType: e.target.value }))}
            >
              {SQUAD_SOURCE_TYPE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-zinc-400">Backup source</span>
            <select
              className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
              value={sourceForm.backupSourceType}
              onChange={(e) => setSourceForm((prev) => ({ ...prev, backupSourceType: e.target.value }))}
            >
              <option value="">None</option>
              {SQUAD_SOURCE_TYPE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          disabled={savingSource}
          onClick={() => void saveSource()}
          className="rounded bg-emerald-700 px-3 py-2 text-sm hover:bg-emerald-600 disabled:opacity-50"
        >
          Save source
        </button>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <h2 className="text-lg font-medium mb-3">Club audit summary</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>Official squad: {summary?.playersOnOfficialSource ?? report.officialCount ?? "—"}</div>
          <div>Rugby365 squad: {summary?.playersInRugby365 ?? "—"}</div>
          <div className="text-emerald-400">Matched: {summary?.matched ?? report.matched ?? "—"}</div>
          <div className="text-amber-400">Missing: {summary?.missingInRugby365 ?? report.missingInRugby365 ?? "—"}</div>
          <div className="text-orange-400">Extra: {summary?.extraInRugby365 ?? report.extraInRugby365 ?? "—"}</div>
          <div>Arrivals: {report.arrivalsFound ?? "—"}</div>
          <div>Departures: {report.departuresFound ?? "—"}</div>
          <div>Transfers proposed: {report.transferRecordsCreated ?? "—"}</div>
          <div>Position conflicts: {summary?.positionConflicts ?? report.positionConflicts ?? "—"}</div>
          <div>Club conflicts: {summary?.clubConflicts ?? report.clubConflicts ?? "—"}</div>
          <div>Needs review: {report.needsReview ?? "—"}</div>
          <div>Job: {club?.latestJob?.status ?? "—"} ({club?.latestJob?.jobType ?? "none"})</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={jobRunning || !sourceForm.officialSquadUrl}
            onClick={() => void runJob("preview")}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-40"
          >
            Preview squad
          </button>
          <button
            type="button"
            disabled={jobRunning || !sourceForm.officialSquadUrl}
            onClick={() => void runJob("dry_run")}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-40"
          >
            Dry import
          </button>
          <button
            type="button"
            disabled={!jobId}
            onClick={() => void runAction("approve_high_confidence")}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-40"
          >
            Approve high-confidence
          </button>
          <button
            type="button"
            disabled={!jobId}
            onClick={() => void runAction("import_approved")}
            className="rounded border border-emerald-800 px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-950 disabled:opacity-40"
          >
            Import approved changes
          </button>
          <Link
            href={`/admin/transfers?teamId=${teamId}`}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
          >
            View transfers
          </Link>
          <button
            type="button"
            onClick={() => void runAction("mark_complete")}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
          >
            Mark club complete
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm space-y-1">
            <span className="text-zinc-400">Group</span>
            <select
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
              value={filters.groupType}
              onChange={(e) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilters((prev) => ({ ...prev, groupType: e.target.value as "" | SquadAuditGroupType }));
              }}
            >
              <option value="">All groups</option>
              {Object.entries(GROUP_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-zinc-400">Review status</span>
            <select
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
              value={filters.reviewStatus}
              onChange={(e) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilters((prev) => ({ ...prev, reviewStatus: e.target.value }));
              }}
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="auto_approved">Auto approved</option>
              <option value="approved">Approved</option>
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-zinc-400">Match confidence</span>
            <select
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
              value={filters.matchConfidence}
              onChange={(e) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilters((prev) => ({ ...prev, matchConfidence: e.target.value }));
              }}
            >
              <option value="">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-zinc-400">Conflict</span>
            <select
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5"
              value={filters.conflictType}
              onChange={(e) => {
                setPagination((prev) => ({ ...prev, page: 1 }));
                setFilters((prev) => ({ ...prev, conflictType: e.target.value }));
              }}
            >
              <option value="">All</option>
              <option value="current_club_conflict">Club conflict</option>
              <option value="position_conflict">Position conflict</option>
              <option value="missing_player">Missing player</option>
              <option value="possible_departure">Possible departure</option>
              <option value="name_mismatch">Name mismatch</option>
            </select>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="py-2 pr-3">Official name</th>
                <th className="py-2 pr-3">Rugby365 name</th>
                <th className="py-2 pr-3">Position</th>
                <th className="py-2 pr-3">Squad #</th>
                <th className="py-2 pr-3">R365 club</th>
                <th className="py-2 pr-3">Official club</th>
                <th className="py-2 pr-3">Confidence</th>
                <th className="py-2 pr-3">Conflict</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {playersLoading ? (
                <tr>
                  <td colSpan={10} className="py-6 text-zinc-500">
                    Loading comparison rows…
                  </td>
                </tr>
              ) : players.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-6 text-zinc-500">
                    No comparison rows yet — run preview first.
                  </td>
                </tr>
              ) : (
                players.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-800/80">
                    <td className="py-2 pr-3">{row.sourcePlayerName ?? "—"}</td>
                    <td className="py-2 pr-3">
                      {row.playerId ? (
                        <Link href={`/admin/players/${row.playerId}/edit`} className="text-emerald-400">
                          {row.matchedPlayerName}
                        </Link>
                      ) : (
                        row.matchedPlayerName ?? "—"
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {row.position ?? row.rugby365Position ?? "—"}
                      {row.rugby365Position && row.position && row.rugby365Position !== row.position
                        ? ` / R365: ${row.rugby365Position}`
                        : ""}
                    </td>
                    <td className="py-2 pr-3">{row.squadNumber ?? row.rugby365SquadNumber ?? "—"}</td>
                    <td className="py-2 pr-3">{row.rugby365Club ?? "—"}</td>
                    <td className="py-2 pr-3">{row.officialClub ?? "—"}</td>
                    <td className="py-2 pr-3">{row.matchConfidence ?? "—"}</td>
                    <td className="py-2 pr-3">{row.conflictType ?? row.groupType}</td>
                    <td className="py-2 pr-3">
                      {row.sourceUrl ? (
                        <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="text-sky-400">
                          {row.sourceType ?? "source"}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2">
                      {row.reviewStatus !== "approved" ? (
                        <button
                          type="button"
                          className="text-xs text-emerald-400 hover:underline"
                          onClick={() =>
                            void fetch("/api/admin/squad-audit/actions", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "approve_rows",
                                teamId,
                                playerRowIds: [row.id],
                              }),
                            }).then(() => loadPlayers())
                          }
                        >
                          Approve
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-500">Approved</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-zinc-400">
          <span>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} players
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              className="rounded border border-zinc-700 px-2 py-1 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 text-xs text-zinc-500">
          {Object.entries(GROUP_LABELS).map(([key, label]) => (
            <div key={key}>
              {label}: {groupCounts[key] ?? 0} on this page
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
