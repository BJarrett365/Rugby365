"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type RefereeRow = {
  id: string;
  name: string;
  slug: string;
  countryName: string | null;
  matchCount: number;
  yellowCardCount: number;
  redCardCount: number;
  sourceProvider: string;
  wikipediaUrl: string | null;
};

export default function RefereesAdminPage() {
  const [referees, setReferees] = useState<RefereeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [mapping, setMapping] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/admin/referees");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Failed to load referees (${res.status})`);
      }
      setReferees(data.referees ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load referees";
      setLoadError(
        message.includes("too many clients")
          ? "Database is busy — wait a moment and retry. If this persists, restart the dev server."
          : message,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const visibleReferees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return referees;
    return referees.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.countryName?.toLowerCase().includes(q) ||
        row.slug.toLowerCase().includes(q),
    );
  }, [referees, search]);

  async function mapFromMatches() {
    setMapping(true);
    const res = await fetch("/api/admin/referees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "map-from-matches" }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(`Mapped ${data.refereesUpserted} referees from match data.`);
      await load();
    } else alert(data.error ?? "Map failed");
    setMapping(false);
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete referee “${name}”?`)) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/referees/${id}`, { method: "DELETE" });
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
        title="Referees"
        description="Match officials — fixtures officiated, yellow and red cards, Wikipedia import."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/referees/import" className="cms-btn cms-btn--secondary touch-target">
              Import from Wikipedia
            </Link>
            <button
              type="button"
              disabled={mapping}
              onClick={mapFromMatches}
              className="cms-btn cms-btn--secondary touch-target"
            >
              {mapping ? "Mapping…" : "Map from matches"}
            </button>
            <Link href="/admin/referees/new" className="cms-btn cms-btn--primary touch-target">
              New referee
            </Link>
          </div>
        }
      />

      {loadError ? (
        <div className="cms-card mb-4 border border-red-900/60 flex flex-wrap items-center justify-between gap-3">
          <p className="text-red-400 text-sm m-0">{loadError}</p>
          <button
            type="button"
            disabled={loading}
            onClick={() => load()}
            className="cms-btn cms-btn--secondary text-xs"
          >
            {loading ? "Retrying…" : "Retry"}
          </button>
        </div>
      ) : null}

      <div className="cms-card mb-4">
        <input
          className="cms-input w-full max-w-md"
          placeholder="Search referees…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : visibleReferees.length === 0 ? (
        <div className="cms-card">
          <p className="text-zinc-400 m-0">
            {referees.length === 0 ? "No referees yet." : "No referees match your search."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleReferees.map((r) => (
            <article key={r.id} className="cms-card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-lg m-0">{r.name}</h2>
                  <p className="text-sm text-zinc-500 m-0 mt-1">
                    {r.countryName ?? "—"} · {r.matchCount} matches ·{" "}
                    <span className="text-amber-300">{r.yellowCardCount} yellow</span> ·{" "}
                    <span className="text-red-400">{r.redCardCount} red</span>
                    {r.wikipediaUrl ? (
                      <>
                        {" "}
                        ·{" "}
                        <a href={r.wikipediaUrl} target="_blank" rel="noreferrer" className="text-emerald-400">
                          Wikipedia
                        </a>
                      </>
                    ) : null}
                  </p>
                  <p className="text-xs text-zinc-600 m-0 mt-1">Slug: {r.slug}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/referees/${r.id}/edit`} className="cms-btn cms-btn--secondary text-xs">
                    Edit
                  </Link>
                  <button
                    type="button"
                    disabled={deletingId === r.id}
                    onClick={() => remove(r.id, r.name)}
                    className="cms-btn cms-btn--secondary text-xs text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
