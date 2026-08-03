"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type Team = { id: string; name: string };

type VenueFixture = {
  id: string;
  slug: string;
  kickoffAt: string | null;
  status: string;
  attendance: number | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeScore: number;
  awayScore: number;
  competitionName: string | null;
};

function formatKickoff(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function EditVenuePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [fixtures, setFixtures] = useState<VenueFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wikiBusy, setWikiBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [wikiMessage, setWikiMessage] = useState("");
  const [error, setError] = useState("");
  const [venueName, setVenueName] = useState("");
  const [wikipediaUrl, setWikipediaUrl] = useState<string | null>(null);
  const [recordAttendance, setRecordAttendance] = useState<number | null>(null);
  const [values, setValues] = useState({
    name: "",
    slug: "",
    city: "",
    countryName: "",
    countryCode: "",
    capacity: "",
    latitude: "",
    longitude: "",
    teamId: "",
  });

  function load() {
    return Promise.all([
      fetch(`/api/admin/venues/${id}`).then((r) => r.json()),
      fetch("/api/admin/teams").then((r) => r.json()),
    ]).then(([detail, teamsData]) => {
      if (detail.venue) {
        setVenueName(detail.venue.name);
        setWikipediaUrl(detail.venue.wikipediaUrl ?? null);
        setRecordAttendance(detail.venue.recordAttendance ?? null);
        setValues({
          name: detail.venue.name,
          slug: detail.venue.slug,
          city: detail.venue.city ?? "",
          countryName: detail.venue.countryName ?? "",
          countryCode: detail.venue.countryCode ?? "",
          capacity: detail.venue.capacity != null ? String(detail.venue.capacity) : "",
          latitude: detail.venue.latitude != null ? String(detail.venue.latitude) : "",
          longitude: detail.venue.longitude != null ? String(detail.venue.longitude) : "",
          teamId: detail.venue.teamId ?? "",
        });
      }
      setFixtures(detail.fixtures ?? []);
      setTeams(teamsData.teams ?? []);
      setLoading(false);
    });
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on id change only
  }, [id]);

  async function enrichFromWikipedia() {
    setWikiBusy(true);
    setWikiMessage("");
    const res = await fetch(`/api/admin/venues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enrich-wikipedia" }),
    });
    const data = await res.json();
    if (res.ok) {
      setWikiMessage(
        `Updated from Wikipedia — capacity ${data.result?.capacity?.toLocaleString() ?? "—"}, record attendance ${data.result?.recordAttendance?.toLocaleString() ?? "—"}`,
      );
      await load();
    } else {
      setWikiMessage(data.error ?? "Wikipedia enrich failed");
    }
    setWikiBusy(false);
  }

  async function geocodeVenue() {
    setGeoBusy(true);
    setWikiMessage("");
    setError("");
    const res = await fetch(`/api/admin/venues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "geocode", force: true }),
    });
    const data = await res.json();
    if (res.ok) {
      setWikiMessage(
        `Geocoded — ${data.result?.latitude}, ${data.result?.longitude}${
          data.result?.countryCode ? ` (${data.result.countryCode})` : ""
        }`,
      );
      await load();
    } else {
      setError(data.error ?? data.result?.reason ?? "Geocode failed");
    }
    setGeoBusy(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/admin/venues/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        capacity: values.capacity ? Number(values.capacity) : null,
        latitude: values.latitude ? Number(values.latitude) : null,
        longitude: values.longitude ? Number(values.longitude) : null,
        countryCode: values.countryCode || null,
        teamId: values.teamId || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Failed to save");
    else await load();
    setSaving(false);
  }

  async function remove() {
    if (!confirm("Delete this venue?")) return;
    const res = await fetch(`/api/admin/venues/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/venues");
    else {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
  }

  if (loading) return <p className="text-zinc-500 text-sm">Loading…</p>;

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title={venueName || "Edit venue"}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={geoBusy}
              onClick={() => void geocodeVenue()}
              className="cms-btn cms-btn--secondary touch-target"
            >
              {geoBusy ? "Geocoding…" : "Geocode (Open-Meteo)"}
            </button>
            <button
              type="button"
              disabled={wikiBusy}
              onClick={() => void enrichFromWikipedia()}
              className="cms-btn cms-btn--secondary touch-target"
            >
              {wikiBusy ? "Fetching Wiki…" : "Enrich from Wikipedia"}
            </button>
          </div>
        }
      />

      {wikiMessage ? <p className="text-sm text-emerald-400 mb-4">{wikiMessage}</p> : null}

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
          <span className="text-sm text-zinc-400">City</span>
          <input
            className="cms-input w-full mt-1"
            value={values.city}
            onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Country</span>
          <input
            className="cms-input w-full mt-1"
            value={values.countryName}
            onChange={(e) => setValues((v) => ({ ...v, countryName: e.target.value }))}
          />
        </label>
        <label className="block">
          <span className="text-sm text-zinc-400">Country code (ISO)</span>
          <input
            className="cms-input w-full mt-1"
            value={values.countryCode}
            onChange={(e) => setValues((v) => ({ ...v, countryCode: e.target.value }))}
            placeholder="e.g. GB, FR, ZA"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-zinc-400">Latitude</span>
            <input
              className="cms-input w-full mt-1"
              value={values.latitude}
              onChange={(e) => setValues((v) => ({ ...v, latitude: e.target.value }))}
              placeholder="51.4559"
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Longitude</span>
            <input
              className="cms-input w-full mt-1"
              value={values.longitude}
              onChange={(e) => setValues((v) => ({ ...v, longitude: e.target.value }))}
              placeholder="-0.3415"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-sm text-zinc-400">Capacity</span>
          <input
            type="number"
            className="cms-input w-full mt-1"
            value={values.capacity}
            onChange={(e) => setValues((v) => ({ ...v, capacity: e.target.value }))}
          />
        </label>
        {recordAttendance != null ? (
          <p className="text-sm text-zinc-500 m-0">
            Wikipedia record attendance:{" "}
            <span className="font-mono text-zinc-300">{recordAttendance.toLocaleString()}</span>
          </p>
        ) : null}
        {wikipediaUrl ? (
          <p className="text-sm text-zinc-500 m-0">
            <a href={wikipediaUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
              Wikipedia article ↗
            </a>
          </p>
        ) : null}
        <label className="block">
          <span className="text-sm text-zinc-400">Home team</span>
          <select
            className="cms-select w-full mt-1"
            value={values.teamId}
            onChange={(e) => setValues((v) => ({ ...v, teamId: e.target.value }))}
          >
            <option value="">None</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={saving} className="cms-btn cms-btn--primary">
            {saving ? "Saving…" : "Save"}
          </button>
          <Link href="/admin/venues" className="cms-btn cms-btn--secondary">
            Back
          </Link>
          <button type="button" onClick={remove} className="cms-btn cms-btn--secondary text-red-400">
            Delete
          </button>
        </div>
      </form>

      <div className="cms-card overflow-x-auto">
        <h3 className="font-semibold m-0">Fixtures at this venue</h3>
        <p className="text-sm text-zinc-500 mt-1 mb-3">Attendance is set per match in the match editor.</p>
        {fixtures.length === 0 ? (
          <p className="text-sm text-zinc-500 m-0">No fixtures linked yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Match</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3">Attendance</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {fixtures.map((f) => (
                <tr key={f.id} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">{formatKickoff(f.kickoffAt)}</td>
                  <td className="py-2 pr-3">
                    {f.homeTeam} vs {f.awayTeam}
                    {f.competitionName && (
                      <span className="block text-xs text-zinc-600">{f.competitionName}</span>
                    )}
                  </td>
                  <td className="py-2 pr-3 font-mono">
                    {f.homeScore}–{f.awayScore}
                  </td>
                  <td className="py-2 pr-3 font-mono text-zinc-400">
                    {f.attendance != null ? f.attendance.toLocaleString() : "—"}
                  </td>
                  <td className="py-2 text-right">
                    <Link href={`/admin/matches/${f.id}/edit`} className="text-emerald-400 text-xs">
                      Edit match
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
