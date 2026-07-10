"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type VenueRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  countryName: string | null;
  capacity: number | null;
  recordAttendance: number | null;
  wikipediaUrl: string | null;
  teamId: string | null;
  teamName: { name: string } | null;
  fixtureCount: number;
  lastAttendance: number | null;
};

export default function VenuesAdminPage() {
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [importingCapacities, setImportingCapacities] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/venues");
    const data = await res.json();
    setVenues(data.venues ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  async function remove(id: string, name: string) {
    if (!confirm(`Delete venue “${name}”?`)) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/venues/${id}`, { method: "DELETE" });
    if (res.ok) await load();
    else {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
    setDeletingId(null);
  }

  async function enrichOne(id: string) {
    setEnrichingId(id);
    setMessage("");
    const res = await fetch(`/api/admin/venues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enrich-wikipedia" }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(
        `Updated ${data.venue?.name ?? "venue"} — capacity ${data.result?.capacity?.toLocaleString() ?? "—"}, record attendance ${data.result?.recordAttendance?.toLocaleString() ?? "—"}`,
      );
      await load();
    } else {
      setMessage(data.error ?? "Wikipedia enrich failed");
    }
    setEnrichingId(null);
  }

  async function importCapacitiesFromWikiList() {
    if (
      !confirm(
        "Import stadium capacities from Wikipedia's rugby union stadium list? Unmatched venues will fall back to individual Wikipedia articles.",
      )
    ) {
      return;
    }
    setImportingCapacities(true);
    setMessage("");
    const res = await fetch("/api/admin/venues/import-capacity-list", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setMessage(
        `Capacity import complete — ${data.updatedFromList} from Wikipedia list, ${data.enrichedFromInfobox} from venue articles, ${data.stillMissing} still without capacity.`,
      );
      await load();
    } else {
      setMessage(data.error ?? "Capacity import failed");
    }
    setImportingCapacities(false);
  }

  async function enrichAll() {
    if (!confirm("Enrich all venues from Wikipedia? This may take a minute.")) return;
    setBulkEnriching(true);
    setMessage("");
    const res = await fetch("/api/admin/venues/enrich-wikipedia", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Wikipedia enrich complete — ${data.enriched}/${data.total} venues updated.`);
      await load();
    } else {
      setMessage(data.error ?? "Bulk enrich failed");
    }
    setBulkEnriching(false);
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Venues"
        description="Stadiums and grounds. Import capacities from Wikipedia's rugby union stadium list, enrich individual venues, or set attendance per fixture in matches."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/venues/map-fixtures" className="cms-btn cms-btn--secondary touch-target">
              Map fixtures
            </Link>
            <button
              type="button"
              disabled={importingCapacities || loading || venues.length === 0}
              onClick={() => void importCapacitiesFromWikiList()}
              className="cms-btn cms-btn--primary touch-target"
            >
              {importingCapacities ? "Importing capacities…" : "Import capacities (Wiki list)"}
            </button>
            <button
              type="button"
              disabled={bulkEnriching || loading || venues.length === 0}
              onClick={() => void enrichAll()}
              className="cms-btn cms-btn--secondary touch-target"
            >
              {bulkEnriching ? "Enriching from Wiki…" : "Enrich all from Wiki"}
            </button>
            <Link href="/admin/venues/new" className="cms-btn cms-btn--primary touch-target">
              New venue
            </Link>
          </div>
        }
      />

      {message ? <p className="text-sm text-emerald-400 mb-4">{message}</p> : null}

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : venues.length === 0 ? (
        <div className="cms-card">
          <p className="text-zinc-400 m-0">No venues yet. Add manually or sync Sport365 matches.</p>
        </div>
      ) : (
        <div className="cms-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">Venue</th>
                <th className="py-2 pr-3">Home team</th>
                <th className="py-2 pr-3">Capacity</th>
                <th className="py-2 pr-3">Fixtures</th>
                <th className="py-2 pr-3">Last attendance</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {venues.map((v) => (
                <tr key={v.id} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/venues/${v.id}/edit`} className="text-emerald-400 font-medium">
                      {v.name}
                    </Link>
                    <span className="block text-xs text-zinc-600">
                      {[v.city, v.countryName].filter(Boolean).join(", ") || v.slug}
                    </span>
                    {v.wikipediaUrl ? (
                      <a
                        href={v.wikipediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs text-zinc-500 hover:text-emerald-400 mt-0.5"
                      >
                        Wikipedia ↗
                      </a>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">{v.teamName?.name ?? "—"}</td>
                  <td className="py-2 pr-3 font-mono text-zinc-400">
                    {v.capacity != null ? v.capacity.toLocaleString() : "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono text-zinc-400">{v.fixtureCount}</td>
                  <td className="py-2 pr-3 font-mono text-zinc-400">
                    {v.lastAttendance != null ? v.lastAttendance.toLocaleString() : "—"}
                    {v.recordAttendance != null && v.lastAttendance === v.recordAttendance ? (
                      <span className="block text-[10px] uppercase tracking-wide text-zinc-600">Wiki record</span>
                    ) : null}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <button
                      type="button"
                      disabled={enrichingId === v.id || bulkEnriching || importingCapacities}
                      onClick={() => void enrichOne(v.id)}
                      className="cms-btn cms-btn--secondary text-xs mr-2"
                    >
                      {enrichingId === v.id ? "Wiki…" : "Wiki"}
                    </button>
                    <Link href={`/admin/venues/${v.id}/edit`} className="cms-btn cms-btn--secondary text-xs mr-2">
                      Edit
                    </Link>
                    <button
                      type="button"
                      disabled={deletingId === v.id}
                      onClick={() => remove(v.id, v.name)}
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
