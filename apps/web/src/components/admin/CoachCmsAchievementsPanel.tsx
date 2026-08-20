"use client";

import { useCallback, useEffect, useState } from "react";

type Props = {
  coachId: string;
};

type AchievementRow = {
  id: string;
  achievementType: string;
  year: number | null;
  competitionName: string | null;
  titleOverride: string | null;
  placing: string | null;
  medalType: string;
  roleType: string | null;
  honourLevel: string;
  verificationStatus: string;
  award?: { name: string; organisation: string | null } | null;
};

export function CoachCmsAchievementsPanel({ coachId }: Props) {
  const [rows, setRows] = useState<AchievementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const res = await fetch(`/api/admin/coaches/${coachId}/achievements`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load achievements");
      setRows([]);
    } else {
      setRows(data.achievements ?? []);
    }
    setLoading(false);
  }, [coachId]);

  useEffect(() => {
    void load();
  }, [load]);

  const syncLegacy = async () => {
    setBusy(true);
    setError("");
    setStatus("");
    const res = await fetch(`/api/admin/coaches/${coachId}/achievements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync_legacy" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Sync failed");
    } else {
      setStatus(
        `Synced legacy → achievements (honours ${data.honours}, awards ${data.awards}, medals ${data.medals}).`,
      );
      await load();
    }
    setBusy(false);
  };

  const byType = (type: string) => rows.filter((r) => r.achievementType === type);

  return (
    <div className="cms-card space-y-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="m-0 text-base font-semibold">Shared achievements</h3>
          <p className="m-0 text-sm text-zinc-400">
            Reusable across coaches, players, referees and teams. Legacy coach tables remain until
            CMS forms fully migrate.
          </p>
        </div>
        <button
          type="button"
          className="cms-btn cms-btn--secondary touch-target"
          disabled={busy}
          onClick={() => void syncLegacy()}
        >
          {busy ? "Syncing…" : "Sync from legacy tables"}
        </button>
      </div>

      {error ? <p className="text-red-400 text-sm m-0">{error}</p> : null}
      {status ? <p className="text-emerald-400 text-sm m-0">{status}</p> : null}

      {loading ? (
        <p className="m-0 text-sm">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {(
            [
              ["PERSONAL_AWARD", "Personal awards"],
              ["TEAM_HONOUR", "Team honours"],
              ["MEDAL", "Medal record"],
            ] as const
          ).map(([type, label]) => {
            const list = byType(type);
            return (
              <div key={type}>
                <h4 className="m-0 mb-2 text-xs uppercase tracking-wide text-zinc-500">
                  {label} ({list.length})
                </h4>
                {list.length === 0 ? (
                  <p className="m-0 text-sm text-zinc-500">None yet.</p>
                ) : (
                  <ul className="m-0 p-0 list-none space-y-2 text-sm">
                    {list.slice(0, 12).map((r) => (
                      <li key={r.id} className="border-b border-zinc-800 pb-2">
                        <strong>{r.year ?? "—"}</strong>{" "}
                        {r.award?.name ??
                          r.titleOverride ??
                          r.competitionName ??
                          type}{" "}
                        <span className="text-zinc-500">
                          · {(r.placing ?? "").replace(/_/g, " ")} · {r.verificationStatus}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
