"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LeagueTable } from "@/components/competitions/LeagueTable";
import { PageHeader } from "@/components/shell/PageHeader";

type Season = {
  id: string;
  label: string;
  year: number;
  isActive: boolean;
  syncedAt: string | null;
};

type Standing = {
  rank: number;
  teamName: string;
  teamSlug: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  pointsDiff: number;
  bonusPoints: number;
  points: number;
  form: string | null;
};

export default function EditCompetitionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [competitionName, setCompetitionName] = useState("");
  const [competitionSlug, setCompetitionSlug] = useState("");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [values, setValues] = useState({
    name: "",
    slug: "",
    competitionType: "domestic",
    sdmsCompCode: "",
    planetRugbySlug: "",
  });

  function load() {
    return fetch(`/api/admin/competitions/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.competition) {
          setCompetitionName(d.competition.name);
          setCompetitionSlug(d.competition.slug);
          setValues({
            name: d.competition.name,
            slug: d.competition.slug,
            competitionType: d.competition.competitionType ?? "domestic",
            sdmsCompCode: d.competition.sdmsCompCode ?? "",
            planetRugbySlug: d.competition.planetRugbySlug ?? "",
          });
        }
        setSeasons(d.seasons ?? []);
        setStandings(
          (d.standings ?? []).map((r: Standing) => ({
            rank: r.rank,
            teamName: r.teamName,
            teamSlug: r.teamSlug,
            played: r.played,
            won: r.won,
            draw: r.draw,
            lost: r.lost,
            pointsDiff: r.pointsDiff,
            bonusPoints: r.bonusPoints,
            points: r.points,
            form: r.form,
          })),
        );
        setLoading(false);
      });
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on id change only
  }, [id]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/competitions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        sdmsCompCode: values.sdmsCompCode || null,
        planetRugbySlug: values.planetRugbySlug || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Failed to save");
    else await load();
    setSaving(false);
  }

  async function syncSeasons() {
    setSyncing(true);
    const res = await fetch(`/api/admin/competitions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync-seasons" }),
    });
    const data = await res.json();
    if (res.ok) await load();
    else alert(data.error ?? "Sync failed");
    setSyncing(false);
  }

  async function syncStandings(seasonLabel?: string) {
    setSyncing(true);
    const res = await fetch(`/api/admin/competitions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync-standings", seasonLabel }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Synced ${data.rowsUpserted} standing rows.`);
      await load();
    } else alert(data.error ?? "Sync failed");
    setSyncing(false);
  }

  async function recomputeForm() {
    setSyncing(true);
    const res = await fetch(`/api/admin/competitions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "recompute-form", force: true, allSeasons: true }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Form updated on ${data.rowsUpdated ?? 0} standing row(s).`);
      await load();
    } else alert(data.error ?? "Form recompute failed");
    setSyncing(false);
  }

  async function remove() {
    if (!confirm("Delete this competition and all seasons/standings?")) return;
    const res = await fetch(`/api/admin/competitions/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/competitions");
    else {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
  }

  if (loading) return <p className="text-zinc-500 text-sm">Loading…</p>;

  return (
    <>
      <PageHeader eyebrow="CMS" title={competitionName || "Edit competition"} />

      <form onSubmit={submit} className="cms-card space-y-4 max-w-lg mb-4">
        {error && <p className="text-red-400 text-sm m-0">{error}</p>}
        <label className="block">
          <span className="text-sm text-zinc-400">Name</span>
          <input
            className="cms-input w-full mt-1"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Slug</span>
          <input
            className="cms-input w-full mt-1"
            value={values.slug}
            onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Type</span>
          <select
            className="cms-select w-full mt-1"
            value={values.competitionType}
            onChange={(e) => setValues((v) => ({ ...v, competitionType: e.target.value }))}
          >
            <option value="domestic">Domestic league</option>
            <option value="international">International</option>
            <option value="world_cup">World Cup</option>
            <option value="european">European</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">SDMS comp code</span>
          <input
            className="cms-input w-full mt-1 font-mono text-sm"
            value={values.sdmsCompCode}
            onChange={(e) => setValues((v) => ({ ...v, sdmsCompCode: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Planet Rugby slug</span>
          <input
            className="cms-input w-full mt-1"
            value={values.planetRugbySlug}
            onChange={(e) => setValues((v) => ({ ...v, planetRugbySlug: e.target.value }))}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className="cms-btn cms-btn--primary">
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            disabled={syncing || !values.sdmsCompCode}
            onClick={syncSeasons}
            className="cms-btn cms-btn--secondary"
          >
            Sync seasons
          </button>
          <button
            type="button"
            disabled={syncing || !values.sdmsCompCode}
            onClick={() => syncStandings()}
            className="cms-btn cms-btn--secondary"
          >
            {syncing ? "Syncing…" : "Sync table"}
          </button>
          <button
            type="button"
            disabled={syncing}
            onClick={recomputeForm}
            className="cms-btn cms-btn--secondary"
            title="Rebuild Form (W/D/L) from finished fixtures in this competition"
          >
            Recompute form
          </button>
          <Link href="/admin/competitions/import" className="cms-btn cms-btn--secondary">
            Import Planet Rugby
          </Link>
          <Link href={`/competitions/${competitionSlug}`} className="cms-btn cms-btn--secondary" target="_blank">
            View league hub
          </Link>
          <Link href="/admin/competitions" className="cms-btn cms-btn--secondary">
            Back
          </Link>
          <button type="button" onClick={remove} className="cms-btn cms-btn--secondary text-red-400">
            Delete
          </button>
        </div>
      </form>

      {seasons.length > 0 && (
        <div className="cms-card mb-4">
          <h3 className="font-semibold m-0">Seasons</h3>
          <ul className="mt-2 space-y-1 text-sm text-zinc-400">
            {seasons.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span>
                  {s.label}
                  {s.isActive && <span className="text-emerald-400 ml-2 text-xs">Active</span>}
                  {s.syncedAt && (
                    <span className="text-zinc-600 ml-2 text-xs">
                      · synced {new Date(s.syncedAt).toLocaleString()}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="text-xs text-emerald-400"
                  disabled={syncing}
                  onClick={() => syncStandings(s.label)}
                >
                  Sync
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="cms-card">
        <h3 className="font-semibold m-0 mb-3">Current table (overall)</h3>
        <LeagueTable rows={standings} />
      </div>
    </>
  );
}
