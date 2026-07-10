"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type PreviewRow = {
  fixtureId: string;
  slug: string;
  kickoffAt: string | null;
  competitionName: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  venueName: string | null;
  suggestedVenueId: string | null;
  suggestedVenueName: string | null;
  matchMethod: string | null;
};

type VenueOption = { id: string; name: string };

function formatKickoff(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function MapFixtureVenuesPage() {
  const [previews, setPreviews] = useState<PreviewRow[]>([]);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [summary, setSummary] = useState({ unmapped: 0, mappable: 0, unresolved: 0 });
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(false);
  const [message, setMessage] = useState("");
  const [manualVenueByFixture, setManualVenueByFixture] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [previewRes, venuesRes] = await Promise.all([
      fetch("/api/admin/fixtures/assign-venues?limit=300"),
      fetch("/api/admin/venues"),
    ]);
    const previewData = await previewRes.json();
    const venuesData = await venuesRes.json();
    setPreviews(previewData.previews ?? []);
    setSummary(previewData.summary ?? { unmapped: 0, mappable: 0, unresolved: 0 });
    setVenues((venuesData.venues ?? []).map((venue: VenueOption) => ({ id: venue.id, name: venue.name })));
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  async function mapAll() {
    if (!confirm(`Map ${summary.mappable} fixtures to CMS venues?`)) return;
    setMapping(true);
    setMessage("");
    const res = await fetch("/api/admin/fixtures/assign-venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Mapping failed");
    } else {
      setMessage(
        `Mapped ${data.mapped} fixtures · ${data.unresolved} unresolved · ${data.failures?.length ?? 0} failed`,
      );
      await load();
    }
    setMapping(false);
  }

  async function mapOne(fixtureId: string) {
    setMapping(true);
    const venueId = manualVenueByFixture[fixtureId];
    const res = await fetch("/api/admin/fixtures/assign-venues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureId, venueId: venueId || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Failed to map fixture");
    } else {
      await load();
    }
    setMapping(false);
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Map fixtures to venues"
        description="Assign imported fixtures to venues already in the CMS using venue labels, aliases and home-team grounds."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="cms-btn cms-btn--primary"
              disabled={mapping || summary.mappable === 0}
              onClick={() => void mapAll()}
            >
              {mapping ? "Mapping…" : `Map ${summary.mappable} fixtures`}
            </button>
            <Link href="/admin/venues" className="cms-btn cms-btn--secondary">
              Back to venues
            </Link>
          </div>
        }
      />

      {message ? <p className="text-sm text-emerald-400 mb-4">{message}</p> : null}

      <div className="cms-card mb-4 text-sm text-zinc-500">
        <p className="m-0">
          {summary.unmapped} unmapped fixtures · {summary.mappable} auto-matchable · {summary.unresolved}{" "}
          need manual venue selection
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : previews.length === 0 ? (
        <div className="cms-card">
          <p className="text-zinc-400 m-0">All fixtures are already linked to CMS venues.</p>
        </div>
      ) : (
        <div className="cms-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">Match</th>
                <th className="py-2 pr-3">Fixture venue label</th>
                <th className="py-2 pr-3">Suggested CMS venue</th>
                <th className="py-2 pr-3">Method</th>
                <th className="py-2 pr-3">Manual venue</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {previews.map((row) => (
                <tr key={row.fixtureId} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/matches/${row.fixtureId}/edit`} className="text-emerald-400">
                      {row.homeTeamName ?? "Home"} v {row.awayTeamName ?? "Away"}
                    </Link>
                    <span className="block text-xs text-zinc-600">
                      {formatKickoff(row.kickoffAt)}
                      {row.competitionName ? ` · ${row.competitionName}` : ""}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">{row.venueName ?? "—"}</td>
                  <td className="py-2 pr-3 text-zinc-300">{row.suggestedVenueName ?? "—"}</td>
                  <td className="py-2 pr-3 text-zinc-500">{row.matchMethod ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <select
                      className="cms-select w-full min-w-[12rem]"
                      value={manualVenueByFixture[row.fixtureId] ?? row.suggestedVenueId ?? ""}
                      onChange={(e) =>
                        setManualVenueByFixture((current) => ({
                          ...current,
                          [row.fixtureId]: e.target.value,
                        }))
                      }
                    >
                      <option value="">Select CMS venue…</option>
                      {venues.map((venue) => (
                        <option key={venue.id} value={venue.id}>
                          {venue.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={mapping}
                      onClick={() => void mapOne(row.fixtureId)}
                      className="cms-btn cms-btn--secondary text-xs"
                    >
                      Assign
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
