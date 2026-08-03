"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type CompetitionRow = {
  id: string;
  name: string;
  slug: string;
  competitionType: string;
  sdmsCompCode: string | null;
  activeSeason: { label: string; syncedAt: string | null } | null;
};

const TYPE_LABELS: Record<string, string> = {
  domestic: "Domestic",
  international: "International",
  world_cup: "World Cup",
  european: "European",
};

export default function CompetitionsAdminPage() {
  const [competitions, setCompetitions] = useState<CompetitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [importingAll, setImportingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/competitions");
    const data = await res.json();
    setCompetitions(data.competitions ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  async function syncAll() {
    setSyncingAll(true);
    const res = await fetch("/api/admin/competitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync-all-standings" }),
    });
    const data = await res.json();
    if (res.ok) {
      const ok = (data.results ?? []).filter((r: { error?: string }) => !r.error).length;
      alert(`Synced standings for ${ok} competition(s).`);
      await load();
    } else alert(data.error ?? "Sync failed");
    setSyncingAll(false);
  }

  async function importAllFromPlanetRugby() {
    if (!confirm("Import all preset leagues from Planet Rugby (table + matches)?")) return;
    setImportingAll(true);
    const res = await fetch("/api/admin/competitions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import-all-planet-rugby", mode: "full" }),
    });
    const data = await res.json();
    if (res.ok) {
      const ok = (data.results ?? []).filter((r: { error?: string }) => !r.error).length;
      alert(`Imported ${ok} of ${(data.results ?? []).length} leagues from Planet Rugby.`);
      await load();
    } else alert(data.error ?? "Import failed");
    setImportingAll(false);
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete competition “${name}”?`)) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/competitions/${id}`, { method: "DELETE" });
    if (res.ok) await load();
    else {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
    setDeletingId(null);
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Competitions & tables"
        description="Domestic leagues, Internationals, Six Nations, Rugby World Cup. Import from Planet Rugby or sync SDMS tables."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={syncingAll}
              onClick={syncAll}
              className="cms-btn cms-btn--secondary touch-target"
            >
              {syncingAll ? "Syncing…" : "Sync all tables"}
            </button>
            <button
              type="button"
              disabled={importingAll}
              onClick={importAllFromPlanetRugby}
              className="cms-btn cms-btn--secondary touch-target"
            >
              {importingAll ? "Importing…" : "Import all from Planet Rugby"}
            </button>
            <Link href="/admin/competitions/catalog" className="cms-btn cms-btn--secondary touch-target">
              Competition catalog
            </Link>
            <Link href="/admin/competitions/import" className="cms-btn cms-btn--primary touch-target">
              Import Planet Rugby
            </Link>
            <Link href="/admin/competitions/new" className="cms-btn cms-btn--primary touch-target">
              New league
            </Link>
          </div>
        }
      />
      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : competitions.length === 0 ? (
        <div className="cms-card">
          <p className="text-zinc-400 m-0">No competitions yet.</p>
        </div>
      ) : (
        <div className="cms-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">Competition</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">SDMS code</th>
                <th className="py-2 pr-3">Active season</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {competitions.map((c) => (
                <tr key={c.id} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/competitions/${c.id}/edit`} className="text-emerald-400 font-medium">
                      {c.name}
                    </Link>
                    <span className="block text-xs text-zinc-600">{c.slug}</span>
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">
                    {TYPE_LABELS[c.competitionType] ?? c.competitionType}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-zinc-500">
                    {c.sdmsCompCode ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">
                    {c.activeSeason?.label ?? "—"}
                    {c.activeSeason?.syncedAt && (
                      <span className="block text-xs text-zinc-600">
                        Synced {new Date(c.activeSeason.syncedAt).toLocaleDateString()}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Link
                      href={`/competitions/${c.slug}/table`}
                      className="cms-btn cms-btn--secondary text-xs mr-2"
                      target="_blank"
                    >
                      View table
                    </Link>
                    <Link href={`/admin/competitions/${c.id}/edit`} className="cms-btn cms-btn--secondary text-xs mr-2">
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={deletingId === c.id}
                      onClick={() => remove(c.id, c.name)}
                      className="cms-btn cms-btn--secondary text-xs text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
