"use client";

import Link from "next/link";
import { useState } from "react";
import { LEGEND_LEVELS, legendLevelLabel } from "@/lib/legend-types";
import type { LegendRow } from "@/lib/legend-admin-service";

export function PlayerLegendSection({
  playerId,
  legends: initialLegends,
  onUpdated,
}: {
  playerId: string;
  legends: LegendRow[];
  onUpdated: () => void;
}) {
  const [legends, setLegends] = useState(initialLegends);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    legendLevel: "club_legend",
    era: "",
    reason: "",
    careerSummary: "",
    keyAchievements: "",
    editorNotes: "",
    sourceUrl: "",
  });

  async function createLegend(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/legends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId,
        legendLevel: form.legendLevel,
        era: form.era || null,
        reason: form.reason || null,
        careerSummary: form.careerSummary || null,
        keyAchievements: form.keyAchievements
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        editorNotes: form.editorNotes || null,
        sourceUrl: form.sourceUrl || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setLegends((rows) => [...rows, data.legend]);
      setForm({
        legendLevel: "club_legend",
        era: "",
        reason: "",
        careerSummary: "",
        keyAchievements: "",
        editorNotes: "",
        sourceUrl: "",
      });
      onUpdated();
    } else {
      const err = await res.json();
      alert(err.error ?? "Failed to create legend");
    }
    setSaving(false);
  }

  async function saveLegend(id: string) {
    setSaving(true);
    const res = await fetch(`/api/admin/legends/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legendLevel: form.legendLevel,
        era: form.era || null,
        reason: form.reason || null,
        careerSummary: form.careerSummary || null,
        keyAchievements: form.keyAchievements
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
        editorNotes: form.editorNotes || null,
        sourceUrl: form.sourceUrl || null,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setLegends((rows) => rows.map((row) => (row.id === id ? data.legend : row)));
      setEditingId(null);
      onUpdated();
    }
    setSaving(false);
  }

  async function deactivateLegend(id: string) {
    const res = await fetch(`/api/admin/legends/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ legendStatus: "inactive" }),
    });
    if (res.ok) {
      setLegends((rows) => rows.filter((row) => row.id !== id));
      onUpdated();
    }
  }

  function startEdit(legend: LegendRow) {
    setEditingId(legend.id);
    setForm({
      legendLevel: legend.legendLevel,
      era: legend.era ?? "",
      reason: legend.reason ?? "",
      careerSummary: legend.careerSummary ?? "",
      keyAchievements: legend.keyAchievements.join("\n"),
      editorNotes: legend.editorNotes ?? "",
      sourceUrl: legend.sourceUrl ?? "",
    });
  }

  return (
    <div className="cms-card mb-4">
      <h3 className="font-semibold m-0">Rugby365 Legend</h3>
      <p className="text-sm text-zinc-500 mt-1 mb-4">
        Editorial legend status — independent of calculated Player Ratings.
      </p>

      {legends.length > 0 ? (
        <div className="space-y-4 mb-6">
          {legends.map((legend) => (
            <div key={legend.id} className="rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs uppercase tracking-wide text-amber-300 font-medium">
                  {legend.legendLevelLabel}
                </span>
                {legend.teamName ? (
                  <Link href={`/admin/teams/${legend.teamId}/edit`} className="text-xs text-zinc-500">
                    {legend.teamName}
                  </Link>
                ) : null}
                {legend.era ? <span className="text-xs text-zinc-500">· {legend.era}</span> : null}
              </div>
              {editingId === legend.id ? (
                <LegendForm
                  form={form}
                  setForm={setForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveLegend(legend.id);
                  }}
                  saving={saving}
                  submitLabel="Save legend"
                />
              ) : (
                <>
                  {legend.reason ? <p className="text-sm text-zinc-300 m-0">{legend.reason}</p> : null}
                  {legend.careerSummary ? (
                    <p className="text-sm text-zinc-500 mt-2 mb-0">{legend.careerSummary}</p>
                  ) : null}
                  {legend.keyAchievements.length > 0 ? (
                    <ul className="mt-2 mb-0 pl-4 text-sm text-zinc-400">
                      {legend.keyAchievements.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="flex gap-3 mt-3">
                    <button
                      type="button"
                      onClick={() => startEdit(legend)}
                      className="text-xs text-emerald-400 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deactivateLegend(legend.id)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Remove legend status
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-zinc-600 mb-4">This player is not marked as a Rugby365 Legend.</p>
      )}

      {editingId === null ? (
        <div className="border-t border-zinc-800 pt-4">
          <h4 className="text-sm font-medium text-zinc-300 m-0 mb-3">Mark as legend</h4>
          <LegendForm
            form={form}
            setForm={setForm}
            onSubmit={createLegend}
            saving={saving}
            submitLabel="Add legend status"
          />
        </div>
      ) : null}
    </div>
  );
}

function LegendForm({
  form,
  setForm,
  onSubmit,
  saving,
  submitLabel,
}: {
  form: {
    legendLevel: string;
    era: string;
    reason: string;
    careerSummary: string;
    keyAchievements: string;
    editorNotes: string;
    sourceUrl: string;
  };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
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
        placeholder="Era"
        value={form.era}
        onChange={(e) => setForm((f) => ({ ...f, era: e.target.value }))}
      />
      <textarea
        className="cms-input w-full sm:col-span-2"
        rows={2}
        placeholder="Reason shown on profile"
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
      <textarea
        className="cms-input w-full sm:col-span-2"
        rows={2}
        placeholder="Editor notes (admin only)"
        value={form.editorNotes}
        onChange={(e) => setForm((f) => ({ ...f, editorNotes: e.target.value }))}
      />
      <input
        className="cms-input w-full sm:col-span-2"
        placeholder="Source URL"
        value={form.sourceUrl}
        onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
      />
      <button type="submit" disabled={saving} className="cms-btn cms-btn--primary text-sm sm:col-span-2">
        {saving ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
