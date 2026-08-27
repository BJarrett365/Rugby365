"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { GroupedTeamSelect } from "@/components/admin/GroupedTeamSelect";
import { PageHeader } from "@/components/shell/PageHeader";
import { coachHeroNameLines } from "@/lib/coach-display-name";
import type { TeamPickerGroup } from "@/lib/team-picker-groups";

type CoachRow = {
  id: string;
  name: string;
  slug: string;
  fullName: string | null;
  knownAs: string | null;
  nationality: string | null;
  imageUrl: string | null;
  currentTeamName: string | null;
  currentRoleLabel: string | null;
  isCurrent: boolean;
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
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [countryTeamId, setCountryTeamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [assigningTeams, setAssigningTeams] = useState(false);
  const [assignMessage, setAssignMessage] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
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
    if (!listRes.ok) {
      setCoaches([]);
      setLoadError(data.error ?? "Failed to list coaches");
    } else {
      setCoaches(data.coaches ?? []);
    }
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
  const currentCoaches = visibleCoaches.filter((c) => c.isCurrent);
  const otherCoaches = visibleCoaches.filter((c) => !c.isCurrent);

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
                <Link href={`/admin/coaches/${row.id}`} className="text-emerald-400">
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
          Search by name, known as, or nationality
          <input
            className="cms-input w-full mt-1"
            placeholder="Johan, Rassie, South Africa…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
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
      {loadError ? <p className="text-sm text-red-400 mb-4">{loadError}</p> : null}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : visibleCoaches.length === 0 ? (
        <p className="text-sm text-zinc-500">{loadError ? "Could not load coaches." : "No coaches found."}</p>
      ) : (
        <article className="pr-coach-profile cms-coach-dir">
          {currentCoaches.length > 0 ? (
            <section>
              <p className="cms-coach-dir__kicker">Current coaches</p>
              <div className="cms-coach-dir__grid">
                {currentCoaches.map((coach) => (
                  <CoachDirCard key={coach.id} coach={coach} reasons={attentionById.get(coach.id) ?? []} />
                ))}
              </div>
            </section>
          ) : null}
          {otherCoaches.length > 0 ? (
            <section>
              <p className="cms-coach-dir__kicker">{currentCoaches.length > 0 ? "All coaches" : "Coaches"}</p>
              <div className="cms-coach-dir__grid">
                {otherCoaches.map((coach) => (
                  <CoachDirCard key={coach.id} coach={coach} reasons={attentionById.get(coach.id) ?? []} />
                ))}
              </div>
            </section>
          ) : null}
        </article>
      )}
    </>
  );
}

function CoachDirCard({
  coach,
  reasons,
}: {
  coach: CoachRow;
  reasons: string[];
}) {
  const lines = coachHeroNameLines({
    name: coach.name,
    knownAs: coach.knownAs,
    fullName: coach.fullName,
  });
  const roleLine = [coach.currentRoleLabel, coach.currentTeamName || coach.coachedCountries[0]]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="cms-coach-dir-card">
      <Link href={`/admin/coaches/${coach.id}`} className="cms-coach-dir-card__main">
        <div className="cms-coach-dir-card__image">
          {coach.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coach.imageUrl} alt={coach.name} />
          ) : (
            <div className="cms-coach-dir-card__silhouette" aria-hidden />
          )}
        </div>
        <div className="cms-coach-dir-card__identity">
          <h2>
            <span className="pr-coach-hero__name-line">{lines.line1}</span>
            {lines.line2 ? <span className="pr-coach-hero__name-line">{lines.line2}</span> : null}
          </h2>
          <p className="cms-coach-dir-card__nat">{coach.nationality ?? "—"}</p>
          {roleLine ? <p className="cms-coach-dir-card__role">{roleLine}</p> : null}
          {reasons.length > 0 ? (
            <span className="cms-coach-dir-card__flag">{reasons[0]}</span>
          ) : null}
        </div>
      </Link>
      <div className="cms-coach-dir-card__actions">
        <Link href={`/admin/coaches/${coach.id}/edit`}>Edit CMS</Link>
        <Link href={`/coaches/${encodeURIComponent(coach.slug)}`}>Public profile</Link>
      </div>
    </article>
  );
}
