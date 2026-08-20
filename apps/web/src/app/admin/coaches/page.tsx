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

type AttentionRow = {
  id: string;
  name: string;
  slug: string;
  reasons: string[];
};

export default function CoachesAdminPage() {
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [attention, setAttention] = useState<AttentionRow[]>([]);
  const [showAttentionOnly, setShowAttentionOnly] = useState(false);
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
    const [listRes, attentionRes] = await Promise.all([
      fetch(`/api/admin/coaches${qs ? `?${qs}` : ""}`),
      fetch("/api/admin/coaches/attention"),
    ]);
    const data = await listRes.json();
    const attentionData = await attentionRes.json();
    setCoaches(data.coaches ?? []);
    setAttention(attentionData.coaches ?? []);
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

  const attentionById = new Map(attention.map((a) => [a.id, a.reasons]));
  const visibleCoaches = showAttentionOnly
    ? coaches.filter((c) => attentionById.has(c.id))
    : coaches;

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

      <div className="cms-card mb-4 border border-amber-900/40">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold m-0">Coaches needing attention</h3>
          <button
            type="button"
            className={`cms-btn text-xs ${showAttentionOnly ? "cms-btn--primary" : "cms-btn--secondary"}`}
            onClick={() => setShowAttentionOnly((v) => !v)}
          >
            {showAttentionOnly ? "Showing queue only" : `Queue (${attention.length})`}
          </button>
        </div>
        <p className="text-sm text-zinc-500 mt-0 mb-3">
          Working list for editors — missing team, career, image, honours, source, or needs review.
        </p>
        {attention.length === 0 ? (
          <p className="text-sm text-zinc-500 m-0">No coaches currently need attention.</p>
        ) : (
          <ul className="space-y-2 list-none p-0 m-0 max-h-56 overflow-y-auto">
            {attention.slice(0, 25).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm border-b border-zinc-800/60 pb-2"
              >
                <Link href={`/admin/coaches/${row.id}/edit`} className="text-emerald-400">
                  {row.name}
                </Link>
                <span className="flex flex-wrap gap-1">
                  {row.reasons.map((reason) => (
                    <span
                      key={reason}
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide bg-amber-950 text-amber-300 border border-amber-800"
                    >
                      {reason}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

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
      ) : visibleCoaches.length === 0 ? (
        <p className="text-sm text-zinc-500">No coaches found.</p>
      ) : (
        <div className="cms-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Nationality</th>
                <th className="py-2 pr-3">Coached countries</th>
                <th className="py-2 pr-3">Attention</th>
                <th className="py-2 pr-3">DOB</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Bio</th>
              </tr>
            </thead>
            <tbody>
              {visibleCoaches.map((coach) => (
                <tr key={coach.id} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-3">
                    <Link href={`/admin/coaches/${coach.id}/edit`} className="text-emerald-400">
                      {coach.name}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">{coach.nationality ?? "—"}</td>
                  <td className="py-2 pr-3 text-zinc-400">
                    {coach.coachedCountries?.length ? coach.coachedCountries.join(", ") : "—"}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="flex flex-wrap gap-1">
                      {(attentionById.get(coach.id) ?? []).slice(0, 2).map((reason) => (
                        <span
                          key={reason}
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide bg-amber-950 text-amber-300 border border-amber-800"
                        >
                          {reason}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">{coach.birthDate ?? "—"}</td>
                  <td className="py-2 pr-3 text-zinc-400">{coach.sourceProvider ?? "—"}</td>
                  <td className="py-2 pr-3 text-zinc-500 max-w-xs truncate">
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
