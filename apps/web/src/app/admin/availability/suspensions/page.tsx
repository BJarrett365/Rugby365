"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AvailabilityDashboardPanels } from "@/components/admin/AvailabilityDashboardPanels";
import { AvailabilityKindNav } from "@/components/admin/AvailabilityKindNav";
import { GroupedTeamSelect } from "@/components/admin/GroupedTeamSelect";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { PageHeader } from "@/components/shell/PageHeader";
import {
  SUSPENSION_CARD_TYPES,
  SUSPENSION_STATUSES,
  suspensionStatusLabel,
  type SuspensionStatus,
} from "@/lib/availability-types";
import type { SuspensionRow } from "@/lib/suspension-admin-service";
import type { TeamPickerGroup } from "@/lib/team-picker-groups";

type Player = { id: string; name: string; clubTeamName?: string | null };
type Season = { id: string; label: string };
type Competition = { id: string; name: string };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

const emptyForm = {
  playerId: "",
  teamId: "",
  competitionId: "",
  seasonId: "",
  fixtureId: "",
  incidentDate: "",
  offence: "",
  cardType: "red",
  hearingDate: "",
  suspensionStart: "",
  suspensionEnd: "",
  matchesSuspended: "",
  matchesServed: "0",
  matchesRemaining: "",
  status: "suspended" as SuspensionStatus,
  source: "",
  sourceUrl: "",
  notes: "",
  lastVerifiedDate: "",
};

export default function SuspensionsAdminPage() {
  const searchParams = useSearchParams();
  const [suspensions, setSuspensions] = useState<SuspensionRow[]>([]);
  const [dashboard, setDashboard] = useState<Parameters<typeof AvailabilityDashboardPanels>[0]["dashboard"]>(null);
  const [teamGroups, setTeamGroups] = useState<TeamPickerGroup[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    teamId: "",
    seasonId: "",
    competitionId: "",
    status: "",
    search: "",
  });
  const [form, setForm] = useState(emptyForm);

  const playerOptions = useMemo(
    () =>
      players.map((p) => ({
        id: p.id,
        label: p.name,
        hint: p.clubTeamName ?? undefined,
      })),
    [players],
  );

  const loadMeta = useCallback(async () => {
    const [teamsRes, playersRes, seasonsRes, competitionsRes] = await Promise.all([
      fetch("/api/admin/teams?grouped=1"),
      fetch("/api/admin/players?picker=1"),
      fetch("/api/admin/seasons"),
      fetch("/api/admin/competitions"),
    ]);
    const [teamsData, playersData, seasonsData, competitionsData] = await Promise.all([
      teamsRes.json(),
      playersRes.json(),
      seasonsRes.json(),
      competitionsRes.json(),
    ]);
    setTeamGroups(teamsData.groups ?? []);
    setPlayers(playersData.players ?? []);
    setSeasons(seasonsData.seasons ?? []);
    setCompetitions(competitionsData.competitions ?? []);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (filters.teamId) params.set("teamId", filters.teamId);
    if (filters.seasonId) params.set("seasonId", filters.seasonId);
    if (filters.competitionId) params.set("competitionId", filters.competitionId);
    if (filters.status) params.set("status", filters.status);
    if (filters.search) params.set("search", filters.search);

    const dashParams = new URLSearchParams();
    if (filters.teamId) dashParams.set("teamId", filters.teamId);
    if (filters.seasonId) dashParams.set("seasonId", filters.seasonId);
    if (filters.competitionId) dashParams.set("competitionId", filters.competitionId);

    const [suspensionsRes, dashboardRes] = await Promise.all([
      fetch(`/api/admin/availability/suspensions?${params}`),
      fetch(`/api/admin/availability/dashboard?${dashParams}`),
    ]);

    if (!suspensionsRes.ok || !dashboardRes.ok) {
      setError("Failed to load suspensions");
      setLoading(false);
      return;
    }

    const [suspensionsData, dashboardData] = await Promise.all([
      suspensionsRes.json(),
      dashboardRes.json(),
    ]);
    setSuspensions(suspensionsData.suspensions ?? []);
    setDashboard(dashboardData.dashboard ?? null);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    const playerId = searchParams.get("playerId");
    if (playerId) {
      setForm((f) => ({ ...f, playerId }));
      setFilters((f) => ({ ...f, search: "" }));
    }
  }, [searchParams]);

  useEffect(() => {
    loadMeta().catch(() => setError("Failed to load filters"));
  }, [loadMeta]);

  useEffect(() => {
    loadData().catch(() => setError("Failed to load suspensions"));
  }, [loadData]);

  async function saveSuspension() {
    if (!form.playerId) {
      setError("Player is required");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      teamId: form.teamId || null,
      competitionId: form.competitionId || null,
      seasonId: form.seasonId || null,
      fixtureId: form.fixtureId || null,
      matchesSuspended: form.matchesSuspended ? Number(form.matchesSuspended) : null,
      matchesServed: Number(form.matchesServed) || 0,
      matchesRemaining: form.matchesRemaining ? Number(form.matchesRemaining) : null,
      incidentDate: form.incidentDate || null,
      hearingDate: form.hearingDate || null,
      suspensionStart: form.suspensionStart || null,
      suspensionEnd: form.suspensionEnd || null,
      offence: form.offence || null,
      source: form.source || null,
      sourceUrl: form.sourceUrl || null,
      notes: form.notes || null,
      lastVerifiedDate: form.lastVerifiedDate || null,
      ...(editingId ? { id: editingId } : {}),
    };

    const res = await fetch("/api/admin/availability/suspensions", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
      setSaving(false);
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setSaving(false);
    await loadData();
  }

  async function deleteSuspension(id: string) {
    if (!confirm("Delete this suspension record?")) return;
    const res = await fetch(`/api/admin/availability/suspensions?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Delete failed");
      return;
    }
    await loadData();
  }

  function startEdit(row: SuspensionRow) {
    setEditingId(row.id);
    setForm({
      playerId: row.playerId,
      teamId: row.teamId ?? "",
      competitionId: row.competitionId ?? "",
      seasonId: row.seasonId ?? "",
      fixtureId: row.fixtureId ?? "",
      incidentDate: row.incidentDate ?? "",
      offence: row.offence ?? "",
      cardType: row.cardType ?? "red",
      hearingDate: row.hearingDate ?? "",
      suspensionStart: row.suspensionStart ?? "",
      suspensionEnd: row.suspensionEnd ?? "",
      matchesSuspended: row.matchesSuspended != null ? String(row.matchesSuspended) : "",
      matchesServed: String(row.matchesServed),
      matchesRemaining: row.matchesRemaining != null ? String(row.matchesRemaining) : "",
      status: row.status,
      source: row.source ?? "",
      sourceUrl: row.sourceUrl ?? "",
      notes: row.notes ?? "",
      lastVerifiedDate: row.lastVerifiedDate ?? "",
    });
  }

  return (
    <div className="cms-page">
      <PageHeader
        title="Suspensions"
        description="Public disciplinary availability — hearings, card types and match bans from verified sources."
        actions={
          <Link href="/admin/availability/injuries" className="cms-button cms-button--secondary">
            Injuries
          </Link>
        }
      />

      {error ? <p className="text-red-400 text-sm">{error}</p> : null}

      <AvailabilityKindNav />

      <AvailabilityDashboardPanels dashboard={dashboard} />

      <div className="cms-card mb-4">
        <h3 className="font-semibold m-0 mb-3">Filters</h3>
        <div className="grid gap-3 md:grid-cols-5">
          <input
            className="cms-input"
            placeholder="Search player or offence"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <GroupedTeamSelect
            groups={teamGroups}
            value={filters.teamId}
            onChange={(teamId) => setFilters((f) => ({ ...f, teamId }))}
            placeholder="All teams"
          />
          <select
            className="cms-input"
            value={filters.competitionId}
            onChange={(e) => setFilters((f) => ({ ...f, competitionId: e.target.value }))}
          >
            <option value="">All competitions</option>
            {competitions.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competition.name}
              </option>
            ))}
          </select>
          <select
            className="cms-input"
            value={filters.seasonId}
            onChange={(e) => setFilters((f) => ({ ...f, seasonId: e.target.value }))}
          >
            <option value="">All seasons</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.label}
              </option>
            ))}
          </select>
          <select
            className="cms-input"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">All statuses</option>
            {SUSPENSION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {suspensionStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="cms-card mb-4">
        <h3 className="font-semibold m-0 mb-3">{editingId ? "Edit suspension" : "Add suspension"}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <SearchableSelect
            options={playerOptions}
            value={form.playerId}
            onChange={(playerId) => setForm((f) => ({ ...f, playerId }))}
            placeholder="Search players…"
          />
          <GroupedTeamSelect
            groups={teamGroups}
            value={form.teamId}
            onChange={(teamId) => setForm((f) => ({ ...f, teamId }))}
            placeholder="No team"
          />
          <select
            className="cms-input"
            value={form.competitionId}
            onChange={(e) => setForm((f) => ({ ...f, competitionId: e.target.value }))}
          >
            <option value="">Competition</option>
            {competitions.map((competition) => (
              <option key={competition.id} value={competition.id}>
                {competition.name}
              </option>
            ))}
          </select>
          <select
            className="cms-input"
            value={form.seasonId}
            onChange={(e) => setForm((f) => ({ ...f, seasonId: e.target.value }))}
          >
            <option value="">Season</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.label}
              </option>
            ))}
          </select>
          <input
            className="cms-input"
            placeholder="Fixture ID (optional)"
            value={form.fixtureId}
            onChange={(e) => setForm((f) => ({ ...f, fixtureId: e.target.value }))}
          />
          <select
            className="cms-input"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as SuspensionStatus }))}
          >
            {SUSPENSION_STATUSES.map((status) => (
              <option key={status} value={status}>
                {suspensionStatusLabel(status)}
              </option>
            ))}
          </select>
          <input className="cms-input" type="date" value={form.incidentDate} onChange={(e) => setForm((f) => ({ ...f, incidentDate: e.target.value }))} />
          <input className="cms-input" placeholder="Offence" value={form.offence} onChange={(e) => setForm((f) => ({ ...f, offence: e.target.value }))} />
          <select className="cms-input" value={form.cardType} onChange={(e) => setForm((f) => ({ ...f, cardType: e.target.value }))}>
            {SUSPENSION_CARD_TYPES.map((card) => (
              <option key={card} value={card}>
                {card}
              </option>
            ))}
          </select>
          <input className="cms-input" type="date" value={form.hearingDate} onChange={(e) => setForm((f) => ({ ...f, hearingDate: e.target.value }))} />
          <input className="cms-input" type="date" value={form.suspensionStart} onChange={(e) => setForm((f) => ({ ...f, suspensionStart: e.target.value }))} />
          <input className="cms-input" type="date" value={form.suspensionEnd} onChange={(e) => setForm((f) => ({ ...f, suspensionEnd: e.target.value }))} />
          <input className="cms-input" type="number" min={0} placeholder="Matches suspended" value={form.matchesSuspended} onChange={(e) => setForm((f) => ({ ...f, matchesSuspended: e.target.value }))} />
          <input className="cms-input" type="number" min={0} placeholder="Matches served" value={form.matchesServed} onChange={(e) => setForm((f) => ({ ...f, matchesServed: e.target.value }))} />
          <input className="cms-input" type="number" min={0} placeholder="Matches remaining" value={form.matchesRemaining} onChange={(e) => setForm((f) => ({ ...f, matchesRemaining: e.target.value }))} />
          <input className="cms-input" placeholder="Source" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
          <input className="cms-input" placeholder="Source URL" value={form.sourceUrl} onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))} />
          <input className="cms-input" type="date" value={form.lastVerifiedDate} onChange={(e) => setForm((f) => ({ ...f, lastVerifiedDate: e.target.value }))} />
          <textarea
            className="cms-input md:col-span-3"
            rows={2}
            placeholder="Public notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <div className="flex gap-2 mt-3">
          <button type="button" className="cms-button" disabled={saving} onClick={() => saveSuspension()}>
            {saving ? "Saving…" : editingId ? "Update suspension" : "Add suspension"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="cms-button cms-button--secondary"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </div>

      <div className="cms-card">
        <h3 className="font-semibold m-0 mb-3">Suspension records</h3>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : suspensions.length === 0 ? (
          <p className="text-sm text-zinc-500">No suspension records match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="cms-table w-full text-sm">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Competition</th>
                  <th>Offence</th>
                  <th>Status</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Remaining</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {suspensions.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/players/${row.playerId}/edit`} className="text-emerald-400">
                        {row.playerName}
                      </Link>
                    </td>
                    <td>{row.teamName ?? "—"}</td>
                    <td>{row.competitionName ?? "—"}</td>
                    <td>
                      {row.offence ?? "—"}
                      {row.cardType ? ` (${row.cardType})` : ""}
                    </td>
                    <td>{suspensionStatusLabel(row.status)}</td>
                    <td>{formatDate(row.suspensionStart)}</td>
                    <td>{formatDate(row.suspensionEnd)}</td>
                    <td>{row.matchesRemaining ?? "—"}</td>
                    <td className="text-right space-x-2">
                      <button type="button" className="text-xs text-emerald-400" onClick={() => startEdit(row)}>
                        Edit
                      </button>
                      <button type="button" className="text-xs text-red-400" onClick={() => deleteSuspension(row.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
