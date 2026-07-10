"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GroupedTeamSelect } from "@/components/admin/GroupedTeamSelect";
import { PageHeader } from "@/components/shell/PageHeader";
import type { TeamPickerGroup } from "@/lib/team-picker-groups";

type CoachRow = {
  id: string;
  name: string;
  slug: string;
  nationality: string | null;
  birthDate: string | null;
  bioSummary: string | null;
  wikipediaUrl: string | null;
  sourceProvider: string;
  coachedCountries: string[];
};

export default function CoachesAdminPage() {
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [teamGroups, setTeamGroups] = useState<TeamPickerGroup[]>([]);
  const [search, setSearch] = useState("");
  const [countryTeamId, setCountryTeamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [assigningTeams, setAssigningTeams] = useState(false);
  const [assignMessage, setAssignMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (countryTeamId) params.set("countryTeamId", countryTeamId);
    const qs = params.toString();
    const res = await fetch(`/api/admin/coaches${qs ? `?${qs}` : ""}`);
    const data = await res.json();
    setCoaches(data.coaches ?? []);
    setLoading(false);
  }, [search, countryTeamId]);

  useEffect(() => {
    fetch("/api/admin/teams?grouped=1")
      .then((r) => r.json())
      .then((data) => setTeamGroups(data.groups ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  async function assignAllToCmsTeams() {
    if (
      !confirm(
        "Assign all coaches to existing CMS teams? This relinks duplicate national team names and refreshes assignments from Wikipedia where available.",
      )
    ) {
      return;
    }
    setAssigningTeams(true);
    setAssignMessage("");
    const res = await fetch("/api/admin/coaches/assign-teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) {
      setAssignMessage(data.error ?? "Assign to CMS teams failed");
    } else {
      setAssignMessage(
        `Assigned ${data.coachesProcessed} coaches · +${data.assignmentsCreated} created · ${data.assignmentsRelinked} relinked · ${data.failures?.length ?? 0} failed`,
      );
      await load();
    }
    setAssigningTeams(false);
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Coaches"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="cms-btn cms-btn--secondary"
              disabled={assigningTeams}
              onClick={() => assignAllToCmsTeams()}
            >
              {assigningTeams ? "Assigning to CMS teams…" : "Assign all to CMS teams"}
            </button>
            <Link href="/admin/coaches/import" className="cms-btn cms-btn--secondary">
              Import from Wikipedia
            </Link>
            <Link href="/admin/coaches/new" className="cms-btn cms-btn--primary">
              Add coach
            </Link>
          </div>
        }
      />
      <div className="cms-card mb-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm text-zinc-400">
          Search by name or nationality
          <input
            className="cms-input w-full mt-1"
            placeholder="Name or nationality…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="block text-sm text-zinc-400">
          Filter by coached country / team
          <div className="mt-1">
            <GroupedTeamSelect
              groups={teamGroups}
              value={countryTeamId}
              onChange={setCountryTeamId}
              placeholder="All countries"
              className="cms-select block w-full"
            />
          </div>
        </label>
      </div>
      {assignMessage ? <p className="text-sm text-zinc-400 mb-4">{assignMessage}</p> : null}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : coaches.length === 0 ? (
        <p className="text-sm text-zinc-500">No coaches found.</p>
      ) : (
        <div className="cms-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Nationality</th>
                <th className="py-2 pr-3">Coached countries</th>
                <th className="py-2 pr-3">DOB</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Bio</th>
              </tr>
            </thead>
            <tbody>
              {coaches.map((coach) => (
                <tr key={coach.id} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/coaches/${coach.id}/edit`} className="text-emerald-400">
                      {coach.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-zinc-500">{coach.nationality ?? "—"}</td>
                  <td className="py-2 pr-3 text-zinc-500">
                    {coach.coachedCountries.length > 0 ? coach.coachedCountries.join(", ") : "—"}
                  </td>
                  <td className="py-2 pr-3 text-zinc-500">{coach.birthDate ?? "—"}</td>
                  <td className="py-2 pr-3 text-zinc-500">
                    {coach.wikipediaUrl ? (
                      <a href={coach.wikipediaUrl} target="_blank" rel="noreferrer" className="text-emerald-400">
                        Wikipedia
                      </a>
                    ) : (
                      coach.sourceProvider
                    )}
                  </td>
                  <td className="py-2 pr-3 text-zinc-500 max-w-md truncate">
                    {coach.bioSummary ?? "—"}
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
