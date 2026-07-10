"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AvailabilityDashboardPanels } from "@/components/admin/AvailabilityDashboardPanels";
import { AvailabilityKindNav } from "@/components/admin/AvailabilityKindNav";
import { GroupedTeamSelect } from "@/components/admin/GroupedTeamSelect";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { PageHeader } from "@/components/shell/PageHeader";
import { INJURY_STATUSES, injuryStatusLabel, type InjuryStatus } from "@/lib/availability-types";
import type { InjuryRow } from "@/lib/injury-admin-service";
import type { TeamPickerGroup } from "@/lib/team-picker-groups";

type Player = { id: string; name: string; clubTeamName?: string | null };
type Season = { id: string; label: string };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

const emptyForm = {
  playerId: "",
  teamId: "",
  seasonId: "",
  injuryType: "",
  bodyArea: "",
  injuryDate: "",
  dateReported: "",
  expectedReturnDate: "",
  actualReturnDate: "",
  status: "injured" as InjuryStatus,
  matchesMissed: "0",
  source: "",
  sourceUrl: "",
  notes: "",
  lastVerifiedDate: "",
};

export default function InjuriesAdminPage() {
  const searchParams = useSearchParams();
  const [injuries, setInjuries] = useState<InjuryRow[]>([]);
  const [dashboard, setDashboard] = useState<Parameters<typeof AvailabilityDashboardPanels>[0]["dashboard"]>(null);
  const [teamGroups, setTeamGroups] = useState<TeamPickerGroup[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ teamId: "", seasonId: "", status: "", search: "" });
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
    const [teamsRes, playersRes, seasonsRes] = await Promise.all([
      fetch("/api/admin/teams?grouped=1"),
      fetch("/api/admin/players?picker=1"),
      fetch("/api/admin/seasons"),
    ]);
    const [teamsData, playersData, seasonsData] = await Promise.all([
      teamsRes.json(),
      playersRes.json(),
      seasonsRes.json(),
    ]);
    setTeamGroups(teamsData.groups ?? []);
    setPlayers(playersData.players ?? []);
    setSeasons(seasonsData.seasons ?? []);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (filters.teamId) params.set("teamId", filters.teamId);
    if (filters.seasonId) params.set("seasonId", filters.seasonId);
    if (filters.status) params.set("status", filters.status);
    if (filters.search) params.set("search", filters.search);

    const dashParams = new URLSearchParams();
    if (filters.teamId) dashParams.set("teamId", filters.teamId);
    if (filters.seasonId) dashParams.set("seasonId", filters.seasonId);

    const [injuriesRes, dashboardRes] = await Promise.all([
      fetch(`/api/admin/availability/injuries?${params}`),
      fetch(`/api/admin/availability/dashboard?${dashParams}`),
    ]);

    if (!injuriesRes.ok || !dashboardRes.ok) {
      setError("Failed to load injuries");
      setLoading(false);
      return;
    }

    const [injuriesData, dashboardData] = await Promise.all([injuriesRes.json(), dashboardRes.json()]);
    setInjuries(injuriesData.injuries ?? []);
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
    loadData().catch(() => setError("Failed to load injuries"));
  }, [loadData]);

  async function saveInjury() {
    if (!form.playerId) {
      setError("Player is required");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      ...form,
      teamId: form.teamId || null,
      seasonId: form.seasonId || null,
      matchesMissed: Number(form.matchesMissed) || 0,
      injuryDate: form.injuryDate || null,
      dateReported: form.dateReported || null,
      expectedReturnDate: form.expectedReturnDate || null,
      actualReturnDate: form.actualReturnDate || null,
      source: form.source || null,
      sourceUrl: form.sourceUrl || null,
      notes: form.notes || null,
      lastVerifiedDate: form.lastVerifiedDate || null,
      injuryType: form.injuryType || null,
      bodyArea: form.bodyArea || null,
      ...(editingId ? { id: editingId } : {}),
    };

    const res = await fetch("/api/admin/availability/injuries", {
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

  async function deleteInjury(id: string) {
    if (!confirm("Delete this injury record?")) return;
    const res = await fetch(`/api/admin/availability/injuries?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Delete failed");
      return;
    }
    await loadData();
  }

  function startEdit(row: InjuryRow) {
    setEditingId(row.id);
    setForm({
      playerId: row.playerId,
      teamId: row.teamId ?? "",
      seasonId: row.seasonId ?? "",
      injuryType: row.injuryType ?? "",
      bodyArea: row.bodyArea ?? "",
      injuryDate: row.injuryDate ?? "",
      dateReported: row.dateReported ?? "",
      expectedReturnDate: row.expectedReturnDate ?? "",
      actualReturnDate: row.actualReturnDate ?? "",
      status: row.status,
      matchesMissed: String(row.matchesMissed),
      source: row.source ?? "",
      sourceUrl: row.sourceUrl ?? "",
      notes: row.notes ?? "",
      lastVerifiedDate: row.lastVerifiedDate ?? "",
    });
  }

  return (
    <div className="cms-page">
      <PageHeader
        title="Injuries"
        description="Track public injury availability only. Do not store private medical records."
        actions={
          <Link href="/admin/availability/suspensions" className="cms-button cms-button--secondary">
            Suspensions
          </Link>
        }
      />

      {error ? <p className="text-red-400 text-sm">{error}</p> : null}

      <AvailabilityKindNav />

      <AvailabilityDashboardPanels dashboard={dashboard} />

      <div className="cms-card mb-4">
        <h3 className="font-semibold m-0 mb-3">Filters</h3>
        <div className="grid gap-3 md:grid-cols-4">
          <input
            className="cms-input"
            placeholder="Search player or injury type"
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
            {INJURY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {injuryStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="cms-card mb-4">
        <h3 className="font-semibold m-0 mb-3">{editingId ? "Edit injury" : "Add injury"}</h3>
        <p className="text-xs text-zinc-500 mb-3">
          Public rugby availability information only — injury type, body area, dates and verified sources.
        </p>
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
            placeholder="Injury type"
            value={form.injuryType}
            onChange={(e) => setForm((f) => ({ ...f, injuryType: e.target.value }))}
          />
          <input
            className="cms-input"
            placeholder="Body area"
            value={form.bodyArea}
            onChange={(e) => setForm((f) => ({ ...f, bodyArea: e.target.value }))}
          />
          <select
            className="cms-input"
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as InjuryStatus }))}
          >
            {INJURY_STATUSES.map((status) => (
              <option key={status} value={status}>
                {injuryStatusLabel(status)}
              </option>
            ))}
          </select>
          <input className="cms-input" type="date" value={form.injuryDate} onChange={(e) => setForm((f) => ({ ...f, injuryDate: e.target.value }))} />
          <input className="cms-input" type="date" value={form.dateReported} onChange={(e) => setForm((f) => ({ ...f, dateReported: e.target.value }))} />
          <input className="cms-input" type="date" value={form.expectedReturnDate} onChange={(e) => setForm((f) => ({ ...f, expectedReturnDate: e.target.value }))} />
          <input className="cms-input" type="date" value={form.actualReturnDate} onChange={(e) => setForm((f) => ({ ...f, actualReturnDate: e.target.value }))} />
          <input className="cms-input" type="number" min={0} placeholder="Matches missed" value={form.matchesMissed} onChange={(e) => setForm((f) => ({ ...f, matchesMissed: e.target.value }))} />
          <input className="cms-input" placeholder="Source" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
          <input className="cms-input" placeholder="Source URL" value={form.sourceUrl} onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))} />
          <input className="cms-input" type="date" value={form.lastVerifiedDate} onChange={(e) => setForm((f) => ({ ...f, lastVerifiedDate: e.target.value }))} />
          <textarea
            className="cms-input md:col-span-3"
            rows={2}
            placeholder="Public notes (no confidential medical detail)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <div className="flex gap-2 mt-3">
          <button type="button" className="cms-button" disabled={saving} onClick={() => saveInjury()}>
            {saving ? "Saving…" : editingId ? "Update injury" : "Add injury"}
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
        <h3 className="font-semibold m-0 mb-3">Injury records</h3>
        {loading ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : injuries.length === 0 ? (
          <p className="text-sm text-zinc-500">No injury records match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="cms-table w-full text-sm">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Team</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Injury date</th>
                  <th>Expected return</th>
                  <th>Missed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {injuries.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/players/${row.playerId}/edit`} className="text-emerald-400">
                        {row.playerName}
                      </Link>
                    </td>
                    <td>{row.teamName ?? "—"}</td>
                    <td>
                      {row.injuryType ?? "—"}
                      {row.bodyArea ? ` (${row.bodyArea})` : ""}
                    </td>
                    <td>{injuryStatusLabel(row.status)}</td>
                    <td>{formatDate(row.injuryDate)}</td>
                    <td>{formatDate(row.expectedReturnDate)}</td>
                    <td>{row.matchesMissed}</td>
                    <td className="text-right space-x-2">
                      <button type="button" className="text-xs text-emerald-400" onClick={() => startEdit(row)}>
                        Edit
                      </button>
                      <button type="button" className="text-xs text-red-400" onClick={() => deleteInjury(row.id)}>
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
