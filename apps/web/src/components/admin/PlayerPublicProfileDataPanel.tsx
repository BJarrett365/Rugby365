"use client";

import { useEffect, useState } from "react";
import {
  PLAYER_TITLE_TYPES,
  type PlayerTitleRow,
} from "@/lib/player-titles-types";
import { PlayerValueHistoryBackfillPanel } from "@/components/admin/PlayerValueHistoryBackfillPanel";

const TITLE_TYPE_LABELS: Record<string, string> = {
  world_cup: "World Cup",
  top_14: "Top 14",
  premiership: "Premiership",
  six_nations: "Six Nations",
  urc: "URC",
  champions_cup: "Champions Cup",
  currie_cup: "Currie Cup",
  other: "Other",
};

type Props = {
  playerId: string;
  onApplied?: () => void;
};

/**
 * CMS controls that feed the public analytics profile:
 * contract, salary, agent, debut, status override, titles, market-value recompute.
 */
export function PlayerPublicProfileDataPanel({ playerId, onApplied }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [valueBusy, setValueBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [titles, setTitles] = useState<PlayerTitleRow[]>([]);
  const [form, setForm] = useState({
    statusOverride: "",
    contractExpiresOn: "",
    reportedSalaryGbp: "",
    salaryAsOf: "",
    agentName: "",
    agentAgency: "",
    clubDebutOn: "",
  });
  const [titleForm, setTitleForm] = useState({
    titleType: "world_cup",
    title: "",
    year: "",
    seasonLabel: "",
    count: "1",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [playerRes, titlesRes] = await Promise.all([
        fetch(`/api/admin/players/${playerId}`, { cache: "no-store" }),
        fetch(`/api/admin/players/${playerId}/titles`, { cache: "no-store" }),
      ]);
      const playerData = await playerRes.json();
      const titlesData = await titlesRes.json();
      if (!playerRes.ok) throw new Error(playerData.error ?? "Failed to load player");
      if (!titlesRes.ok) throw new Error(titlesData.error ?? "Failed to load titles");
      const p = playerData.player as Record<string, unknown>;
      setForm({
        statusOverride: p.statusOverride ? String(p.statusOverride) : "",
        contractExpiresOn: p.contractExpiresOn ? String(p.contractExpiresOn).slice(0, 10) : "",
        reportedSalaryGbp: p.reportedSalaryGbp != null ? String(p.reportedSalaryGbp) : "",
        salaryAsOf: p.salaryAsOf ? String(p.salaryAsOf).slice(0, 10) : "",
        agentName: p.agentName ? String(p.agentName) : "",
        agentAgency: p.agentAgency ? String(p.agentAgency) : "",
        clubDebutOn: p.clubDebutOn ? String(p.clubDebutOn).slice(0, 10) : "",
      });
      setTitles(titlesData.titles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  async function saveProfileFields(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const res = await fetch(`/api/admin/players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        statusOverride: form.statusOverride || null,
        contractExpiresOn: form.contractExpiresOn || null,
        reportedSalaryGbp:
          form.reportedSalaryGbp.trim() === "" ? null : Number(form.reportedSalaryGbp),
        salaryAsOf: form.salaryAsOf || null,
        agentName: form.agentName || null,
        agentAgency: form.agentAgency || null,
        clubDebutOn: form.clubDebutOn || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    setMessage("Public profile fields saved.");
    onApplied?.();
    await load();
  }

  async function addTitle(e: React.FormEvent) {
    e.preventDefault();
    if (!titleForm.title.trim()) return;
    setError("");
    const res = await fetch(`/api/admin/players/${playerId}/titles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleType: titleForm.titleType,
        title: titleForm.title.trim(),
        year: titleForm.year ? Number(titleForm.year) : null,
        seasonLabel: titleForm.seasonLabel || null,
        count: titleForm.count ? Number(titleForm.count) : 1,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not add title");
      return;
    }
    setTitleForm({ titleType: "world_cup", title: "", year: "", seasonLabel: "", count: "1" });
    await load();
    onApplied?.();
  }

  async function removeTitle(id: string) {
    if (!confirm("Remove this title?")) return;
    const res = await fetch(`/api/admin/players/${playerId}/titles?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Delete failed");
      return;
    }
    await load();
    onApplied?.();
  }

  async function recalculateValue() {
    setValueBusy(true);
    setError("");
    setMessage("");
    const res = await fetch(`/api/admin/players/${playerId}/value`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setValueBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Value calculation failed");
      return;
    }
    setMessage(
      data.value?.marketValueLabel
        ? `Market value recalculated: ${data.value.marketValueLabel}`
        : "Market value recalculated.",
    );
    onApplied?.();
  }

  if (loading) {
    return (
      <div className="cms-card mb-4">
        <h3 className="font-semibold m-0">Public profile data</h3>
        <p className="text-sm text-zinc-500 mt-2 mb-0">Loading…</p>
      </div>
    );
  }

  return (
    <div className="cms-card mb-4 space-y-4">
      <div>
        <h3 className="font-semibold m-0">Public profile data</h3>
        <p className="text-sm text-zinc-500 mt-1 mb-0">
          Fields that power the public analytics profile (contract, agent, titles, FIT status, market
          value). Existing bio, stats, ratings and images stay as they are.
        </p>
      </div>

      {error ? <p className="text-red-400 text-sm m-0">{error}</p> : null}
      {message ? <p className="text-emerald-400 text-sm m-0">{message}</p> : null}

      <form onSubmit={saveProfileFields} className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm text-zinc-400">Public status override</span>
          <select
            className="cms-select w-full mt-1"
            value={form.statusOverride}
            onChange={(e) => setForm((f) => ({ ...f, statusOverride: e.target.value }))}
          >
            <option value="">Auto (from injuries / career)</option>
            <option value="active">FIT / Active</option>
            <option value="injured">Injured</option>
            <option value="suspended">Suspended</option>
            <option value="unattached">Unattached</option>
            <option value="retired">Retired</option>
            <option value="released">Released</option>
            <option value="legend">Legend</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Club debut</span>
          <input
            type="date"
            className="cms-input w-full mt-1"
            value={form.clubDebutOn}
            onChange={(e) => setForm((f) => ({ ...f, clubDebutOn: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Contract expires</span>
          <input
            type="date"
            className="cms-input w-full mt-1"
            value={form.contractExpiresOn}
            onChange={(e) => setForm((f) => ({ ...f, contractExpiresOn: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Reported salary (£ / year)</span>
          <input
            type="number"
            min={0}
            className="cms-input w-full mt-1"
            value={form.reportedSalaryGbp}
            onChange={(e) => setForm((f) => ({ ...f, reportedSalaryGbp: e.target.value }))}
            placeholder="e.g. 880000"
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Salary as of</span>
          <input
            type="date"
            className="cms-input w-full mt-1"
            value={form.salaryAsOf}
            onChange={(e) => setForm((f) => ({ ...f, salaryAsOf: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Agent name</span>
          <input
            className="cms-input w-full mt-1"
            value={form.agentName}
            onChange={(e) => setForm((f) => ({ ...f, agentName: e.target.value }))}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm text-zinc-400">Agency</span>
          <input
            className="cms-input w-full mt-1"
            value={form.agentAgency}
            onChange={(e) => setForm((f) => ({ ...f, agentAgency: e.target.value }))}
            placeholder="e.g. Roc Nation Sports"
          />
        </label>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <button type="submit" className="cms-btn cms-btn--primary" disabled={saving}>
            {saving ? "Saving…" : "Save profile data"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            disabled={valueBusy}
            onClick={() => void recalculateValue()}
          >
            {valueBusy ? "Calculating…" : "Recalculate market value"}
          </button>
        </div>
      </form>

      <div className="border-t border-white/10 pt-4">
        <h4 className="font-semibold m-0 mb-1 text-sm uppercase tracking-wide">
          Market value
        </h4>
        <p className="text-xs text-zinc-500 mt-0 mb-0">
          Live recalculation writes a LIVE snapshot when material / monthly rules allow. Use History
          below to reconstruct month-end BACKFILLED points.
        </p>
      </div>

      <PlayerValueHistoryBackfillPanel playerId={playerId} onApplied={onApplied} />

      <div className="border-t border-white/10 pt-4">
        <h4 className="font-semibold m-0 mb-2 text-sm">Titles & trophies</h4>
        <p className="text-xs text-zinc-500 mt-0 mb-3">
          Structured titles feed milestone icons (World Cup, Top 14, etc.) on the public profile.
        </p>
        {titles.length > 0 ? (
          <ul className="m-0 mb-3 p-0 list-none space-y-2">
            {titles.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm border border-zinc-800 rounded-lg px-3 py-2"
              >
                <span>
                  <strong>{TITLE_TYPE_LABELS[t.titleType] ?? t.titleType}</strong>
                  {" · "}
                  {t.title}
                  {t.year != null ? ` (${t.year})` : ""}
                  {t.count > 1 ? ` ×${t.count}` : ""}
                  {t.visibility !== "public" ? (
                    <span className="text-zinc-500"> · hidden</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary text-xs"
                  onClick={() => void removeTitle(t.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500 mt-0 mb-3">No titles yet.</p>
        )}
        <form onSubmit={addTitle} className="grid gap-2 sm:grid-cols-5">
          <select
            className="cms-select"
            value={titleForm.titleType}
            onChange={(e) => setTitleForm((f) => ({ ...f, titleType: e.target.value }))}
          >
            {PLAYER_TITLE_TYPES.map((type) => (
              <option key={type} value={type}>
                {TITLE_TYPE_LABELS[type] ?? type}
              </option>
            ))}
          </select>
          <input
            className="cms-input sm:col-span-2"
            placeholder="Title label"
            value={titleForm.title}
            onChange={(e) => setTitleForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <input
            className="cms-input"
            type="number"
            placeholder="Year"
            value={titleForm.year}
            onChange={(e) => setTitleForm((f) => ({ ...f, year: e.target.value }))}
          />
          <button type="submit" className="cms-btn cms-btn--secondary">
            Add title
          </button>
        </form>
      </div>
    </div>
  );
}
