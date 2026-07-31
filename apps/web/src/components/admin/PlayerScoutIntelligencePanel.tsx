"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ScoutRecommendation } from "@/lib/player-scout-intelligence-math";

type ScoutProfilePayload = {
  rriScore: number;
  rriBand: string;
  rriGrade: string;
  recommendation: ScoutRecommendation;
  recommendationLabel: string;
  recommendationConfidence: number;
  aiSummary: string;
  potential: number;
  ceiling: number;
  availabilityScore: number;
  riskInjury: string;
  published: boolean;
  cmsNotes: string | null;
  notes: Array<{
    id: string;
    observedOn: string | null;
    venue: string | null;
    matchContext: string | null;
    notes: string;
    confidence: string;
  }>;
};

const RECS: ScoutRecommendation[] = [
  "sign_now",
  "monitor",
  "loan",
  "academy",
  "do_not_pursue",
];

type Props = {
  playerId: string;
  playerSlug?: string | null;
  onApplied?: () => void;
};

export function PlayerScoutIntelligencePanel({ playerId, playerSlug, onApplied }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<ScoutProfilePayload | null>(null);
  const [form, setForm] = useState({
    rriScore: "",
    recommendation: "" as ScoutRecommendation | "",
    aiSummary: "",
    cmsNotes: "",
    published: true,
  });
  const [noteForm, setNoteForm] = useState({
    notes: "",
    observedOn: "",
    venue: "",
    matchContext: "",
    confidence: "high",
  });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/players/${playerId}/scout`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      const p = data.profile as ScoutProfilePayload;
      setProfile(p);
      setForm({
        rriScore: String(p.rriScore ?? ""),
        recommendation: p.recommendation,
        aiSummary: p.aiSummary ?? "",
        cmsNotes: p.cmsNotes ?? "",
        published: p.published,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [playerId]);

  async function recalculate() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/players/${playerId}/scout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recalculate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Recalculate failed");
      setProfile(data.profile);
      setForm((f) => ({
        ...f,
        rriScore: String(data.profile.rriScore),
        recommendation: data.profile.recommendation,
        aiSummary: data.profile.aiSummary ?? "",
      }));
      setMessage("RRI recalculated from live ratings, form, contract and availability.");
      onApplied?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recalculate failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveOverrides(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/players/${playerId}/scout`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rriScore: form.rriScore ? Number(form.rriScore) : null,
          recommendation: form.recommendation || null,
          aiSummary: form.aiSummary || null,
          cmsNotes: form.cmsNotes || null,
          published: form.published,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setProfile(data.profile);
      setMessage("Scout overrides saved.");
      onApplied?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!noteForm.notes.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/players/${playerId}/scout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "note",
          notes: noteForm.notes,
          observedOn: noteForm.observedOn || null,
          venue: noteForm.venue || null,
          matchContext: noteForm.matchContext || null,
          confidence: noteForm.confidence,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Note failed");
      setProfile(data.profile);
      setNoteForm({ notes: "", observedOn: "", venue: "", matchContext: "", confidence: "high" });
      setMessage("Scout note added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Note failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-zinc-500 text-sm cms-card mb-4">Loading Scout Intelligence…</p>;
  }

  return (
    <section className="cms-card mb-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="cms-card__title m-0">Recruitment Index (enhances Scouting)</h2>
          <p className="text-sm text-zinc-500 m-0 mt-1">
            Adds RRI to the existing public Scouting view — does not replace scouting bios, radar or
            bio automation. Ability, potential, form, availability, contract and character.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="cms-btn cms-btn--secondary text-sm"
            disabled={busy}
            onClick={() => void recalculate()}
          >
            Recalculate RRI
          </button>
          {playerSlug ? (
            <Link
              href={`/players/${playerSlug}/scouting`}
              className="cms-btn cms-btn--secondary text-sm"
              target="_blank"
            >
              Public scouting →
            </Link>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-red-400 m-0">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-400 m-0">{message}</p> : null}

      {profile ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="RRI" value={String(profile.rriScore)} hint={`${profile.rriGrade} · ${profile.rriBand}`} />
          <Metric label="Recommendation" value={profile.recommendationLabel} hint={`${profile.recommendationConfidence}% conf.`} />
          <Metric label="Potential" value={String(profile.potential)} hint={`Ceiling ${profile.ceiling}`} />
          <Metric label="Availability" value={String(profile.availabilityScore)} hint={`Injury risk: ${profile.riskInjury}`} />
        </div>
      ) : null}

      <form onSubmit={saveOverrides} className="space-y-3 max-w-2xl">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-zinc-400">RRI override (0–100)</span>
            <input
              className="cms-input mt-1 w-full"
              value={form.rriScore}
              onChange={(e) => setForm((f) => ({ ...f, rriScore: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">Recommendation</span>
            <select
              className="cms-input mt-1 w-full"
              value={form.recommendation}
              onChange={(e) =>
                setForm((f) => ({ ...f, recommendation: e.target.value as ScoutRecommendation }))
              }
            >
              {RECS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-zinc-400">AI / scout summary</span>
          <textarea
            className="cms-input mt-1 w-full min-h-[6rem]"
            value={form.aiSummary}
            onChange={(e) => setForm((f) => ({ ...f, aiSummary: e.target.value }))}
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-400">CMS notes (internal)</span>
          <textarea
            className="cms-input mt-1 w-full min-h-[4rem]"
            value={form.cmsNotes}
            onChange={(e) => setForm((f) => ({ ...f, cmsNotes: e.target.value }))}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
          />
          Published on public Scouting profile
        </label>
        <button type="submit" className="cms-btn cms-btn--primary text-sm" disabled={busy}>
          Save scout overrides
        </button>
      </form>

      <form onSubmit={addNote} className="space-y-3 border-t border-zinc-800 pt-4 max-w-2xl">
        <h3 className="text-sm font-semibold text-zinc-200 m-0">Add scout note</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-zinc-400">Observed on</span>
            <input
              type="date"
              className="cms-input mt-1 w-full"
              value={noteForm.observedOn}
              onChange={(e) => setNoteForm((f) => ({ ...f, observedOn: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">Confidence</span>
            <select
              className="cms-input mt-1 w-full"
              value={noteForm.confidence}
              onChange={(e) => setNoteForm((f) => ({ ...f, confidence: e.target.value }))}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">Venue</span>
            <input
              className="cms-input mt-1 w-full"
              value={noteForm.venue}
              onChange={(e) => setNoteForm((f) => ({ ...f, venue: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-zinc-400">Match context</span>
            <input
              className="cms-input mt-1 w-full"
              value={noteForm.matchContext}
              onChange={(e) => setNoteForm((f) => ({ ...f, matchContext: e.target.value }))}
              placeholder="England v Argentina"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-zinc-400">Observation</span>
          <textarea
            className="cms-input mt-1 w-full min-h-[4rem]"
            value={noteForm.notes}
            onChange={(e) => setNoteForm((f) => ({ ...f, notes: e.target.value }))}
            required
          />
        </label>
        <button type="submit" className="cms-btn cms-btn--secondary text-sm" disabled={busy}>
          Add note
        </button>
      </form>

      {profile?.notes?.length ? (
        <ul className="space-y-2 m-0 p-0 list-none border-t border-zinc-800 pt-4">
          {profile.notes.map((n) => (
            <li key={n.id} className="text-sm text-zinc-300">
              <span className="text-zinc-500">
                {[n.observedOn, n.venue, n.matchContext].filter(Boolean).join(" · ") || "Note"}
                {n.confidence ? ` · ${n.confidence}` : ""}
              </span>
              <p className="m-0 mt-1">{n.notes}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2">
      <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="m-0 mt-1 text-lg font-semibold text-zinc-100">{value}</p>
      <p className="m-0 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}
