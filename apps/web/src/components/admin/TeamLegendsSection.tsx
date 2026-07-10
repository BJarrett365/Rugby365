"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LEGEND_LEVELS, legendLevelLabel } from "@/lib/legend-types";
import type { LegendRow } from "@/lib/legend-admin-service";

export function TeamLegendsSection({ teamId }: { teamId: string }) {
  const [legends, setLegends] = useState<LegendRow[]>([]);
  const [eraFilter, setEraFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [players, setPlayers] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    playerId: "",
    legendLevel: "club_legend",
    era: "",
    reason: "",
    careerSummary: "",
    keyAchievements: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [legendsRes, playersRes] = await Promise.all([
      fetch(`/api/admin/teams/${teamId}/legends`),
      fetch("/api/admin/players?picker=1"),
    ]);
    const legendsData = await legendsRes.json();
    const playersData = await playersRes.json();
    setLegends(legendsData.legends ?? []);
    setPlayers(playersData.players ?? []);
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  const filtered = useMemo(() => {
    return legends.filter((legend) => {
      if (eraFilter && !(legend.era ?? "").toLowerCase().includes(eraFilter.toLowerCase())) {
        return false;
      }
      if (
        positionFilter &&
        !(legend.playerPosition ?? "").toLowerCase().includes(positionFilter.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [legends, eraFilter, positionFilter]);

  async function createLegend(e: React.FormEvent) {
    e.preventDefault();
    if (!form.playerId) return;
    setSaving(true);
    const res = await fetch("/api/admin/legends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: form.playerId,
        teamId,
        legendLevel: form.legendLevel,
        era: form.era || null,
        reason: form.reason || null,
        careerSummary: form.careerSummary || null,
        keyAchievements: form.keyAchievements
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      }),
    });
    if (res.ok) {
      setForm({
        playerId: "",
        legendLevel: "club_legend",
        era: "",
        reason: "",
        careerSummary: "",
        keyAchievements: "",
      });
      await load();
    } else {
      const err = await res.json();
      alert(err.error ?? "Failed to mark legend");
    }
    setSaving(false);
  }

  async function removeLegend(id: string) {
    if (!confirm("Remove this legend status?")) return;
    const res = await fetch(`/api/admin/legends/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading legends…</p>;

  return (
    <div className="cms-card mb-4">
      <h3 className="font-semibold m-0">Club legends</h3>
      <p className="text-sm text-zinc-500 mt-1 mb-4">
        Editorial legend status for iconic players — separate from calculated Player Ratings.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <input
          className="cms-input w-full"
          placeholder="Filter by era"
          value={eraFilter}
          onChange={(e) => setEraFilter(e.target.value)}
        />
        <input
          className="cms-input w-full"
          placeholder="Filter by position"
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-600 mb-4">No club legends recorded yet.</p>
      ) : (
        <div className="grid gap-3 mb-6">
          {filtered.map((legend) => (
            <div key={legend.id} className="rounded-lg border border-zinc-800 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/admin/players/${legend.playerId}/edit`} className="text-emerald-400 font-medium">
                    {legend.playerName}
                  </Link>
                  <span className="ml-2 text-xs uppercase tracking-wide text-amber-300">
                    {legend.legendLevelLabel}
                  </span>
                  {legend.playerPosition ? (
                    <span className="ml-2 text-xs text-zinc-500">{legend.playerPosition}</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => removeLegend(legend.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Remove
                </button>
              </div>
              {legend.era ? <p className="text-xs text-zinc-500 mt-1 mb-0">Era: {legend.era}</p> : null}
              {legend.reason ? <p className="text-sm text-zinc-400 mt-2 mb-0">{legend.reason}</p> : null}
              {legend.keyAchievements.length > 0 ? (
                <ul className="mt-2 mb-0 pl-4 text-sm text-zinc-500">
                  {legend.keyAchievements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={createLegend} className="grid gap-3 sm:grid-cols-2 border-t border-zinc-800 pt-4">
        <h4 className="text-sm font-medium text-zinc-300 m-0 sm:col-span-2">Mark player as legend</h4>
        <select
          className="cms-select w-full sm:col-span-2"
          value={form.playerId}
          onChange={(e) => setForm((f) => ({ ...f, playerId: e.target.value }))}
          required
        >
          <option value="">Select player…</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
        <select
          className="cms-select w-full"
          value={form.legendLevel}
          onChange={(e) => setForm((f) => ({ ...f, legendLevel: e.target.value }))}
        >
          {LEGEND_LEVELS.map((level) => (
            <option key={level} value={level}>
              {legendLevelLabel(level)}
            </option>
          ))}
        </select>
        <input
          className="cms-input w-full"
          placeholder="Era (e.g. 1990s, 2010–2020)"
          value={form.era}
          onChange={(e) => setForm((f) => ({ ...f, era: e.target.value }))}
        />
        <textarea
          className="cms-input w-full sm:col-span-2"
          rows={2}
          placeholder="Reason / legend summary"
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
        />
        <textarea
          className="cms-input w-full sm:col-span-2"
          rows={2}
          placeholder="Career summary"
          value={form.careerSummary}
          onChange={(e) => setForm((f) => ({ ...f, careerSummary: e.target.value }))}
        />
        <textarea
          className="cms-input w-full sm:col-span-2"
          rows={3}
          placeholder="Key achievements (one per line)"
          value={form.keyAchievements}
          onChange={(e) => setForm((f) => ({ ...f, keyAchievements: e.target.value }))}
        />
        <button type="submit" disabled={saving} className="cms-btn cms-btn--primary text-sm sm:col-span-2">
          {saving ? "Saving…" : "Mark as legend"}
        </button>
      </form>
    </div>
  );
}
