"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import type { SquadAuditClubSummary } from "@/lib/premiership-squad-audit-service";

const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  source_added: "Source added",
  preview_ready: "Preview ready",
  needs_review: "Needs review",
  import_approved: "Import approved",
  complete: "Complete",
  source_failed: "Source failed",
};

function statusTone(status: string) {
  switch (status) {
    case "complete":
      return "text-emerald-400";
    case "needs_review":
    case "source_failed":
      return "text-amber-400";
    case "import_approved":
    case "preview_ready":
      return "text-sky-400";
    default:
      return "text-zinc-400";
  }
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function SquadAuditOverviewPage() {
  const [clubs, setClubs] = useState<SquadAuditClubSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [runningTeamId, setRunningTeamId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadClubs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/squad-audit/clubs");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load clubs");
      setClubs(data.clubs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load clubs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClubs();
  }, [loadClubs]);

  async function startJob(teamId: string, jobType: "preview" | "dry_run") {
    setRunningTeamId(teamId);
    setMessage("");
    try {
      const res = await fetch("/api/admin/squad-audit/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, jobType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start job");
      setMessage(`Job queued for ${jobType}. Refresh in a few seconds.`);
      setTimeout(() => void loadClubs(), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start job");
    } finally {
      setRunningTeamId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Premiership squad audit"
        description="Import and reconcile current Premiership squads against official club sources. Process one club at a time — start with Exeter Chiefs."
      />

      {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-400 m-0">{message}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900/80 text-left text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">Club</th>
              <th className="px-3 py-2 font-medium">Official source</th>
              <th className="px-3 py-2 font-medium">Last checked</th>
              <th className="px-3 py-2 font-medium">Official</th>
              <th className="px-3 py-2 font-medium">Rugby365</th>
              <th className="px-3 py-2 font-medium">Matched</th>
              <th className="px-3 py-2 font-medium">Missing</th>
              <th className="px-3 py-2 font-medium">Extra</th>
              <th className="px-3 py-2 font-medium">Pos.</th>
              <th className="px-3 py-2 font-medium">Club</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-zinc-500">
                  Loading Premiership clubs…
                </td>
              </tr>
            ) : clubs.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-zinc-500">
                  No Premiership clubs found.
                </td>
              </tr>
            ) : (
              clubs.map((club) => (
                <tr key={club.teamId} className="border-t border-zinc-800/80">
                  <td className="px-3 py-2 text-zinc-100">
                    <Link href={`/admin/squad-audit/${club.teamId}`} className="text-emerald-400 hover:underline">
                      {club.teamName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 max-w-[12rem] truncate">
                    {club.officialSquadUrl ? (
                      <a
                        href={club.officialSquadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 hover:underline"
                      >
                        {club.sourceType}
                      </a>
                    ) : (
                      <span className="text-amber-400">Missing source</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{formatWhen(club.sourceCheckedAt)}</td>
                  <td className="px-3 py-2">{club.playersOnOfficialSource}</td>
                  <td className="px-3 py-2">{club.playersInRugby365}</td>
                  <td className="px-3 py-2 text-emerald-400">{club.matched}</td>
                  <td className="px-3 py-2 text-amber-400">{club.missingInRugby365}</td>
                  <td className="px-3 py-2 text-orange-400">{club.extraInRugby365}</td>
                  <td className="px-3 py-2">{club.positionConflicts}</td>
                  <td className="px-3 py-2">{club.clubConflicts}</td>
                  <td className={`px-3 py-2 ${statusTone(club.status)}`}>
                    {STATUS_LABELS[club.status] ?? club.status}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/squad-audit/${club.teamId}`}
                        className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800"
                      >
                        Review
                      </Link>
                      <button
                        type="button"
                        disabled={!club.officialSquadUrl || runningTeamId === club.teamId}
                        onClick={() => void startJob(club.teamId, "preview")}
                        className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-40"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        disabled={!club.officialSquadUrl || runningTeamId === club.teamId}
                        onClick={() => void startJob(club.teamId, "dry_run")}
                        className="rounded border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-800 disabled:opacity-40"
                      >
                        Dry run
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
