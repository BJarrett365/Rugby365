"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";

type MappingRow = {
  id: string;
  entityType: string;
  externalId: string;
  externalName: string | null;
  rugby365Id: string | null;
  rugby365Name: string | null;
  status: string;
  confidence: number;
};

type Summary = Record<string, number>;

export default function RugbyDataMappingsPage() {
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [summary, setSummary] = useState<Summary>({});
  const [statusFilter, setStatusFilter] = useState("unmapped");
  const [entityType, setEntityType] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [rowActionId, setRowActionId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ view: "mappings", status: statusFilter });
    if (entityType) params.set("entityType", entityType);
    const res = await fetch(`/api/admin/integrations/rugby-data?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load mappings");
    } else {
      setMappings(data.mappings ?? []);
      setSummary(data.summary ?? {});
    }
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, [statusFilter, entityType]);

  async function confirmMapping(row: MappingRow) {
    if (!confirmId.trim()) {
      setError("Enter a Rugby365 entity UUID to link.");
      return;
    }
    setRowActionId(row.id);
    setError("");
    setMessage("");
    const res = await fetch("/api/admin/integrations/rugby-data", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirm-mapping",
        entityType: row.entityType,
        externalId: row.externalId,
        rugby365Id: confirmId.trim(),
        rugby365Name: row.externalName,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Confirm failed");
    } else {
      setMessage(`Confirmed ${row.entityType} ${row.externalId}`);
      setConfirmId("");
      await load();
    }
    setRowActionId(null);
  }

  async function ignoreMapping(row: MappingRow) {
    setRowActionId(row.id);
    const res = await fetch("/api/admin/integrations/rugby-data", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ignore-mapping",
        entityType: row.entityType,
        externalId: row.externalId,
      }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Ignore failed");
    else {
      setMessage(`Ignored ${row.entityType} ${row.externalId}`);
      await load();
    }
    setRowActionId(null);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <PageHeader
        title="Rugby Data mappings"
        subtitle="Review unmapped or ambiguous provider entities before bulk import."
      />

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/admin/keys/rugby-data" className="text-blue-600 hover:underline">
          ← Rugby Data API settings
        </Link>
        <label className="flex items-center gap-2">
          Status
          <select
            className="rounded border px-2 py-1"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="unmapped">unmapped</option>
            <option value="suggested">suggested</option>
            <option value="conflict">conflict</option>
            <option value="confirmed">confirmed</option>
            <option value="ignored">ignored</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Entity
          <select
            className="rounded border px-2 py-1"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          >
            <option value="">all</option>
            <option value="competition">competition</option>
            <option value="team">team</option>
            <option value="player">player</option>
            <option value="match">match</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Link UUID
          <input
            className="w-72 rounded border px-2 py-1 font-mono text-xs"
            value={confirmId}
            onChange={(e) => setConfirmId(e.target.value)}
            placeholder="rugby365 entity id"
          />
        </label>
      </div>

      {Object.keys(summary).length > 0 && (
        <div className="rounded border bg-slate-50 p-3 text-sm text-slate-700">
          {Object.entries(summary).map(([key, value]) => (
            <span key={key} className="mr-4">
              {key}: <strong>{value}</strong>
            </span>
          ))}
        </div>
      )}

      {message && <p className="text-sm text-green-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading mappings…</p>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-600">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">External</th>
                <th className="px-3 py-2">CMS link</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Conf.</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">{row.entityType}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.externalName ?? row.externalId}</div>
                    <div className="font-mono text-xs text-slate-500">{row.externalId}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div>{row.rugby365Name ?? "—"}</div>
                    <div className="font-mono text-xs text-slate-500">{row.rugby365Id ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{row.confidence}</td>
                  <td className="px-3 py-2 space-x-2">
                    <button
                      type="button"
                      className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                      disabled={rowActionId === row.id}
                      onClick={() => confirmMapping(row)}
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                      disabled={rowActionId === row.id}
                      onClick={() => ignoreMapping(row)}
                    >
                      Ignore
                    </button>
                  </td>
                </tr>
              ))}
              {mappings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No mappings for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
