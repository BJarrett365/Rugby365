"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { COACHING_ROLES, coachingRoleLabel } from "@/lib/coach-types";
import type { CoachingStaffRow } from "@/lib/coach-admin-service";
import type { CoachIntelligenceSummary } from "@/lib/coach-intelligence-service";

type CoachingStaffRowWithIntelligence = CoachingStaffRow & CoachIntelligenceSummary;

type CoachOption = { id: string; name: string; slug: string };
type SeasonOption = { id: string; label: string };

type TeamCoachingStaff = {
  current: CoachingStaffRowWithIntelligence[];
  past: CoachingStaffRowWithIntelligence[];
  bySeason: Array<{ season: string; items: CoachingStaffRowWithIntelligence[] }>;
};

export function TeamCoachingStaffSection({ teamId }: { teamId: string }) {
  const [data, setData] = useState<TeamCoachingStaff | null>(null);
  const [coaches, setCoaches] = useState<CoachOption[]>([]);
  const [seasons, setSeasons] = useState<SeasonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    coachId: "",
    role: "head_coach",
    seasonId: "",
    startDate: "",
    endDate: "",
    isCurrent: true,
    bioSummary: "",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [staffRes, coachesRes, seasonsRes] = await Promise.all([
      fetch(`/api/admin/teams/${teamId}/coaching-staff`),
      fetch("/api/admin/coaches"),
      fetch("/api/admin/seasons"),
    ]);
    const staffData = await staffRes.json();
    const coachesData = await coachesRes.json();
    const seasonsData = await seasonsRes.json();
    setData(staffData.coachingStaff ?? null);
    setCoaches(coachesData.coaches ?? []);
    setSeasons(
      (seasonsData.seasons ?? []).map((season: { id: string; label: string }) => ({
        id: season.id,
        label: season.label,
      })),
    );
    setLoading(false);
  }, [teamId]);

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [load]);

  async function assignStaff(e: React.FormEvent) {
    e.preventDefault();
    if (!form.coachId) return;
    setSaving(true);
    const res = await fetch(`/api/admin/teams/${teamId}/coaching-staff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        seasonId: form.seasonId || null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
      }),
    });
    if (res.ok) {
      setForm((f) => ({ ...f, coachId: "", bioSummary: "", notes: "" }));
      await load();
    } else {
      const err = await res.json();
      alert(err.error ?? "Failed to assign coach");
    }
    setSaving(false);
  }

  async function removeAssignment(id: string) {
    if (!confirm("Remove this coaching staff assignment?")) return;
    const res = await fetch(`/api/admin/coaching-staff/${id}`, { method: "DELETE" });
    if (res.ok) await load();
    else {
      const err = await res.json();
      alert(err.error ?? "Failed to remove assignment");
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading coaching staff…</p>;

  return (
    <div className="cms-card mb-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div>
          <h3 className="font-semibold m-0">Coaching staff</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-0">
            Current and past coaching staff by role and season.
          </p>
        </div>
        <Link href="/admin/coaches/new" className="cms-btn cms-btn--secondary text-sm">
          Add coach
        </Link>
      </div>

      {data && data.current.length > 0 ? (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-emerald-400 m-0 mb-2">Current staff</h4>
          <StaffTable rows={data.current} onRemove={removeAssignment} />
        </div>
      ) : (
        <p className="text-sm text-zinc-600 mb-4">No current coaching staff recorded.</p>
      )}

      {data && data.bySeason.length > 0 ? (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-zinc-300 m-0 mb-3">By season</h4>
          {data.bySeason.map(({ season, items }) => (
            <div key={season} className="mb-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">{season}</p>
              <StaffTable rows={items} onRemove={removeAssignment} />
            </div>
          ))}
        </div>
      ) : null}

      <form onSubmit={assignStaff} className="grid gap-3 sm:grid-cols-2 border-t border-zinc-800 pt-4">
        <h4 className="text-sm font-medium text-zinc-300 m-0 sm:col-span-2">Assign coach to team</h4>
        <select
          className="cms-select w-full"
          value={form.coachId}
          onChange={(e) => setForm((f) => ({ ...f, coachId: e.target.value }))}
          required
        >
          <option value="">Select coach…</option>
          {coaches.map((coach) => (
            <option key={coach.id} value={coach.id}>
              {coach.name}
            </option>
          ))}
        </select>
        <select
          className="cms-select w-full"
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
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
          onChange={(e) => setForm((f) => ({ ...f, seasonId: e.target.value }))}
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
            onChange={(e) => setForm((f) => ({ ...f, isCurrent: e.target.checked }))}
          />
          Current role
        </label>
        <input
          className="cms-input w-full"
          type="date"
          value={form.startDate}
          onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          placeholder="Start date"
        />
        <input
          className="cms-input w-full"
          type="date"
          value={form.endDate}
          onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
          placeholder="End date"
        />
        <textarea
          className="cms-input w-full sm:col-span-2"
          rows={2}
          placeholder="Bio summary for this role"
          value={form.bioSummary}
          onChange={(e) => setForm((f) => ({ ...f, bioSummary: e.target.value }))}
        />
        <button type="submit" disabled={saving} className="cms-btn cms-btn--primary text-sm sm:col-span-2">
          {saving ? "Saving…" : "Assign coach"}
        </button>
      </form>
    </div>
  );
}

function StaffTable({
  rows,
  onRemove,
}: {
  rows: CoachingStaffRowWithIntelligence[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500 border-b border-zinc-800">
            <th className="py-2 pr-3">Name</th>
            <th className="py-2 pr-3">Role</th>
            <th className="py-2 pr-3">Rating</th>
            <th className="py-2 pr-3">Bio</th>
            <th className="py-2 pr-3">Season</th>
            <th className="py-2 pr-3">Dates</th>
            <th className="py-2 pr-3">Summary</th>
            <th className="py-2 pr-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-zinc-800/60">
              <td className="py-2 pr-3">
                <Link href={`/admin/coaches/${row.coachId}/edit`} className="text-emerald-400">
                  {row.coachName}
                </Link>
              </td>
              <td className="py-2 pr-3 text-zinc-400">{row.roleLabel}</td>
              <td className="py-2 pr-3 text-zinc-300">{row.coachRating ?? "—"}</td>
              <td className="py-2 pr-3 text-zinc-500 capitalize">{row.bioStatus}</td>
              <td className="py-2 pr-3 text-zinc-500">{row.seasonLabel ?? "—"}</td>
              <td className="py-2 pr-3 text-zinc-500 whitespace-nowrap">
                {row.startDate ?? "—"}
                {row.endDate ? ` → ${row.endDate}` : row.isCurrent ? " → present" : ""}
              </td>
              <td className="py-2 pr-3 text-zinc-500 max-w-xs truncate">
                {row.bioSummary ?? "—"}
              </td>
              <td className="py-2 pr-3 text-right">
                <button
                  type="button"
                  onClick={() => onRemove(row.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
