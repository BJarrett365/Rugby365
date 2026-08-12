"use client";

import { useCallback, useEffect, useState } from "react";
import { GroupedTeamSelect } from "@/components/admin/GroupedTeamSelect";
import { COACHING_ROLES, coachingRoleLabel } from "@/lib/coach-types";
import type { CoachingStaffRow } from "@/lib/coach-admin-service";
import type { TeamPickerGroup } from "@/lib/team-picker-groups";

type SeasonOption = { id: string; label: string };

export function CoachTeamAssignmentSection({
  coachId,
  assignments,
  onChanged,
}: {
  coachId: string;
  assignments: CoachingStaffRow[];
  onChanged: () => Promise<void> | void;
}) {
  const [teamGroups, setTeamGroups] = useState<TeamPickerGroup[]>([]);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [assigningAll, setAssigningAll] = useState(false);
  const [form, setForm] = useState({
    teamId: "",
    role: "head_coach",
    seasonId: "",
    startDate: "",
    endDate: "",
    isCurrent: true,
    bioSummary: "",
    notes: "",
  });

  const loadMeta = useCallback(async () => {
    const [teamsRes, seasonsRes] = await Promise.all([
      fetch("/api/admin/teams?grouped=1"),
      fetch("/api/admin/seasons"),
    ]);
    const teamsData = await teamsRes.json();
    const seasonsData = await seasonsRes.json();
    setTeamGroups(teamsData.groups ?? []);
    setSeasons(
      (seasonsData.seasons ?? []).map((season: { id: string; label: string }) => ({
        id: season.id,
        label: season.label,
      })),
    );
  }, []);

  useEffect(() => {
    loadMeta().catch(() => undefined);
  }, [loadMeta]);

  async function assignToTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!form.teamId) return;
    setSaving(true);
    const res = await fetch(`/api/admin/teams/${form.teamId}/coaching-staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coachId,
        role: form.role,
        seasonId: form.seasonId || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        isCurrent: form.isCurrent,
        bioSummary: form.bioSummary || null,
        notes: form.notes || null,
      }),
    });
    if (res.ok) {
      setForm((current) => ({
        ...current,
        teamId: "",
        bioSummary: "",
        notes: "",
      }));
      await onChanged();
    } else {
      const data = await res.json();
      alert(data.error ?? "Failed to assign coach to team");
    }
    setSaving(false);
  }

  async function assignFromCmsTeams() {
    setAssigningAll(true);
    const res = await fetch("/api/admin/coaches/assign-teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coachId }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Failed to assign coach to CMS teams");
    } else {
      await onChanged();
    }
    setAssigningAll(false);
  }

  async function removeAssignment(assignmentId: string) {
    if (!confirm("Remove this team assignment?")) return;
    const res = await fetch(`/api/admin/coaching-staff/${assignmentId}`, { method: "DELETE" });
    if (res.ok) await onChanged();
    else {
      const data = await res.json();
      alert(data.error ?? "Failed to remove assignment");
    }
  }

  async function toggleOverview(assignmentId: string, showOnOverview: boolean) {
    const res = await fetch(`/api/admin/coaching-staff/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showOnOverview }),
    });
    if (res.ok) await onChanged();
    else {
      const data = await res.json();
      alert(data.error ?? "Failed to update overview flag");
    }
  }

  async function setRecordStatus(assignmentId: string, recordStatus: string) {
    const res = await fetch(`/api/admin/coaching-staff/${assignmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordStatus }),
    });
    if (res.ok) await onChanged();
    else {
      const data = await res.json();
      alert(data.error ?? "Failed to update record status");
    }
  }

  return (
    <div className="cms-card overflow-x-auto mb-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h3 className="font-semibold m-0">CMS team assignments</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-0">
            Link this coach to teams already in the CMS. Wikipedia imports now match existing teams
            instead of creating duplicates.
          </p>
        </div>
        <button
          type="button"
          className="cms-btn cms-btn--secondary text-xs"
          disabled={assigningAll}
          onClick={() => assignFromCmsTeams()}
        >
          {assigningAll ? "Assigning…" : "Assign from Wikipedia / notes"}
        </button>
      </div>

      {assignments.length > 0 ? (
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-800">
              <th className="py-2 pr-3">Team</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3">Dates</th>
              <th className="py-2 pr-3">Overview</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Crest</th>
              <th className="py-2 pr-3">Current</th>
              <th className="py-2 pr-3" />
            </tr>
          </thead>
          <tbody>
            {assignments.map((row) => (
              <tr key={row.id} className="border-b border-zinc-800/60">
                <td className="py-2 pr-3 text-emerald-400">
                  {row.teamDisplayName || row.teamName}
                  {row.overviewLabel ? (
                    <div className="text-[10px] text-zinc-500">Overview: {row.overviewLabel}</div>
                  ) : null}
                </td>
                <td className="py-2 pr-3 text-zinc-400">
                  {row.roleLabel}
                  <div className="text-[10px] text-zinc-600 uppercase">{row.careerType}</div>
                </td>
                <td className="py-2 pr-3 text-zinc-500 whitespace-nowrap">
                  {row.startDate ?? "—"}
                  {row.endDate ? ` → ${row.endDate}` : row.isCurrent ? " → present" : ""}
                </td>
                <td className="py-2 pr-3">
                  <label className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={row.showOnOverview || row.isCurrent}
                      onChange={(e) => toggleOverview(row.id, e.target.checked)}
                    />
                    Show
                  </label>
                </td>
                <td className="py-2 pr-3 text-xs uppercase tracking-wide">
                  <select
                    className="cms-select text-xs py-1"
                    value={row.recordStatus || "needs_review"}
                    onChange={(e) => setRecordStatus(row.id, e.target.value)}
                  >
                    <option value="verified">Verified</option>
                    <option value="editor_approved">Editor approved</option>
                    <option value="found">Found</option>
                    <option value="conflict">Conflict</option>
                    <option value="needs_review">Needs review</option>
                  </select>
                </td>
                <td className="py-2 pr-3 text-xs">
                  {row.missingCrest ? (
                    <span className="text-amber-400 font-semibold">MISSING CREST</span>
                  ) : (
                    <span className="text-zinc-600">OK</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-zinc-500">{row.isCurrent ? "Current" : "Past"}</td>
                <td className="py-2 pr-3 text-right">
                  <button
                    type="button"
                    onClick={() => removeAssignment(row.id)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-zinc-600 mb-4">No CMS team assignments yet.</p>
      )}

      <form onSubmit={assignToTeam} className="grid gap-3 sm:grid-cols-2 border-t border-zinc-800 pt-4">
        <h4 className="text-sm font-medium text-zinc-300 m-0 sm:col-span-2">Assign to CMS team</h4>
        <label className="block text-sm text-zinc-400 sm:col-span-2">
          Team
          <GroupedTeamSelect
            groups={teamGroups}
            value={form.teamId}
            onChange={(value) => setForm((current) => ({ ...current, teamId: value }))}
            placeholder="Select CMS team…"
            className="cms-select block w-full mt-1"
          />
        </label>
        <select
          className="cms-select w-full"
          value={form.role}
          onChange={(e) => setForm((current) => ({ ...current, role: e.target.value }))}
        >
          {COACHING_ROLES.map((role) => (
            <option key={role} value={role}>
              {coachingRoleLabel(role)}
            </option>
          ))}
        </select>
        <select
          className="cms-select w-full"
          value={form.seasonId}
          onChange={(e) => setForm((current) => ({ ...current, seasonId: e.target.value }))}
        >
          <option value="">Season (optional)</option>
          {seasons.map((season) => (
            <option key={season.id} value={season.id}>
              {season.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input
            type="checkbox"
            checked={form.isCurrent}
            onChange={(e) => setForm((current) => ({ ...current, isCurrent: e.target.checked }))}
          />
          Current role
        </label>
        <input
          className="cms-input w-full"
          type="date"
          value={form.startDate}
          onChange={(e) => setForm((current) => ({ ...current, startDate: e.target.value }))}
        />
        <input
          className="cms-input w-full"
          type="date"
          value={form.endDate}
          onChange={(e) => setForm((current) => ({ ...current, endDate: e.target.value }))}
        />
        <textarea
          className="cms-input w-full sm:col-span-2"
          rows={2}
          placeholder="Bio summary for this role"
          value={form.bioSummary}
          onChange={(e) => setForm((current) => ({ ...current, bioSummary: e.target.value }))}
        />
        <button type="submit" disabled={saving || !form.teamId} className="cms-btn cms-btn--primary text-sm sm:col-span-2">
          {saving ? "Saving…" : "Assign to team"}
        </button>
      </form>
    </div>
  );
}
