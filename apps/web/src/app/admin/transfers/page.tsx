"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GroupedTeamSelect } from "@/components/admin/GroupedTeamSelect";
import { SearchableSelect } from "@/components/admin/SearchableSelect";
import { PageHeader } from "@/components/shell/PageHeader";
import { TransferAuditBadges, TransferSourceCell } from "@/components/admin/TransferAuditCells";
import { TransferClubAuditPanel } from "@/components/admin/TransferClubAuditPanel";
import { TRANSFER_AUDIT_STATUSES, transferAuditStatusLabel } from "@/lib/transfer-audit-utils";
import { TRANSFER_SOURCE_OPTIONS } from "@/lib/transfer-source-utils";
import type { TransferAuditStatus } from "@/lib/transfer-audit-utils";
import type { ClubTransferAuditReport } from "@/lib/transfer-club-audit-service";
import type { TransferSourceConfidence } from "@/lib/transfer-source-utils";
import { movementTypeLabel } from "@/lib/transfer-types";
import type { TeamPickerGroup } from "@/lib/team-picker-groups";

type TransferRow = {
  id: string;
  playerId: string;
  playerName: string;
  transferType: string;
  movementType: string;
  fromTeamName: string | null;
  toTeamName: string | null;
  fromClub: string | null;
  toClub: string | null;
  seasonLabel: string | null;
  effectiveDate: string | null;
  notes: string | null;
  sourceLabel: string;
  sourceUrl: string | null;
  sourceConfidence: TransferSourceConfidence;
  auditStatuses: TransferAuditStatus[];
};

type Player = { id: string; name: string; clubTeamName?: string | null };
type Season = {
  id: string;
  label: string;
  displayLabel?: string;
  status?: "current" | "previous" | "historical";
  year?: number;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

const MOVEMENT_TYPES = [
  "permanent",
  "loan",
  "contract_extension",
  "released",
  "academy_promotion",
  "retirement",
  "unknown",
] as const;

export default function TransfersAdminPage() {
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [teamGroups, setTeamGroups] = useState<TeamPickerGroup[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [metaError, setMetaError] = useState("");
  const [metaLoading, setMetaLoading] = useState(true);
  const [metaReady, setMetaReady] = useState(false);
  const [pendingMatches, setPendingMatches] = useState<
    Array<{
      importKey: string;
      playerName: string;
      candidates: Array<{ id: string; name: string; score: number }>;
    }>
  >([]);
  const [forcePlayerIds, setForcePlayerIds] = useState<Record<string, string>>({});
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [clubAudit, setClubAudit] = useState<ClubTransferAuditReport | null>(null);
  const [clubAuditLoading, setClubAuditLoading] = useState(false);
  const [clubAuditError, setClubAuditError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    seasonId: "",
    teamId: "",
    teamDirection: "" as "" | "in" | "out" | "current",
    movementType: "",
    transferType: "",
    sourceKey: "",
    sourceConfidence: "" as "" | TransferSourceConfidence,
    auditStatus: "",
    sortBy: "effectiveDate" as "effectiveDate" | "playerName" | "createdAt",
    sortDir: "desc" as "asc" | "desc",
  });
  const [form, setForm] = useState({
    playerId: "",
    transferType: "club" as "club" | "international",
    movementType: "permanent",
    fromTeamId: "",
    toTeamId: "",
    seasonId: "",
    competitionId: "",
    effectiveDate: "",
    notes: "",
  });
  const [importSources, setImportSources] = useState<
    Array<{ seasonLabel: string; url: string; description?: string }>
  >([]);
  const [importSource, setImportSource] = useState({
    seasonLabel: "2026–27",
    url: "https://en.wikipedia.org/wiki/List_of_2026%E2%80%9327_Premiership_Rugby_transfers",
  });

  const orderedSeasons = useMemo(() => {
    const statusRank: Record<string, number> = { current: 0, previous: 1, historical: 2 };
    return [...seasons].sort((a, b) => {
      const yearA = a.year ?? 0;
      const yearB = b.year ?? 0;
      if (yearA !== yearB) return yearB - yearA;
      const rankA = statusRank[a.status ?? "historical"] ?? 2;
      const rankB = statusRank[b.status ?? "historical"] ?? 2;
      if (rankA !== rankB) return rankA - rankB;
      return (b.label ?? "").localeCompare(a.label ?? "");
    });
  }, [seasons]);

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
    setMetaLoading(true);
    setMetaError("");
    try {
      const res = await fetch("/api/admin/transfers/setup");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Setup failed (${res.status})`);
      }

      setTeamGroups(data.teams?.groups ?? []);
      setPlayers(data.players ?? []);
      const meta = data.import ?? {};
      setSeasons(meta.seasons ?? []);
      setImportSources(meta.sources ?? []);
      if (meta.defaultSeasonLabel && meta.defaultUrl) {
        setImportSource({
          seasonLabel: meta.defaultSeasonLabel,
          url: meta.defaultUrl,
        });
      }
      setForm((f) => ({
        ...f,
        competitionId: meta.competitionId ?? f.competitionId,
        seasonId: meta.defaultSeasonId ?? f.seasonId,
      }));
      if (meta.defaultSeasonId) {
        setFilters((f) => ({ ...f, seasonId: meta.defaultSeasonId }));
      }
      setMetaReady(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load transfer setup";
      setMetaError(
        message.includes("too many clients")
          ? "Database is busy — wait a moment and retry. If this persists, restart the dev server."
          : message,
      );
    } finally {
      setMetaLoading(false);
    }
  }, []);

  const loadTransfers = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const params = new URLSearchParams({
      page: String(pagination.page),
      pageSize: String(pagination.pageSize),
      sortBy: filters.sortBy,
      sortDir: filters.sortDir,
    });
    if (filters.search) params.set("search", filters.search);
    if (filters.seasonId) params.set("seasonId", filters.seasonId);
    if (filters.teamId) params.set("teamId", filters.teamId);
    if (filters.teamDirection) params.set("teamDirection", filters.teamDirection);
    if (filters.movementType) params.set("movementType", filters.movementType);
    if (filters.transferType) params.set("transferType", filters.transferType);
    if (filters.sourceKey) params.set("sourceKey", filters.sourceKey);
    if (filters.sourceConfidence) params.set("sourceConfidence", filters.sourceConfidence);
    if (filters.auditStatus) params.set("auditStatus", filters.auditStatus);

    const tRes = await fetch(`/api/admin/transfers?${params}`);
    if (!tRes.ok) {
      const data = await tRes.json().catch(() => ({}));
      throw new Error(data.error ?? `Failed to load transfers (${tRes.status})`);
    }
    const tData = await tRes.json();
    setTransfers(tData.transfers ?? []);
    setPagination(tData.pagination ?? pagination);
    setLoading(false);
  }, [filters, pagination.page, pagination.pageSize]);

  const load = useCallback(async () => {
    try {
      await loadTransfers();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load transfers");
      setLoading(false);
    }
  }, [loadTransfers]);

  useEffect(() => {
    loadMeta().catch(() => undefined);
  }, [loadMeta]);

  useEffect(() => {
    if (!metaReady) return;
    load().catch(() => undefined);
  }, [load, metaReady]);

  const loadClubAudit = useCallback(async () => {
    if (!filters.teamId || !filters.seasonId) {
      setClubAudit(null);
      setClubAuditError("");
      return;
    }
    setClubAuditLoading(true);
    setClubAuditError("");
    try {
      const params = new URLSearchParams({
        teamId: filters.teamId,
        seasonId: filters.seasonId,
      });
      const res = await fetch(`/api/admin/transfers/club-audit?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Club audit failed (${res.status})`);
      setClubAudit(data.report ?? null);
    } catch (error) {
      setClubAudit(null);
      setClubAuditError(error instanceof Error ? error.message : "Club audit failed");
    } finally {
      setClubAuditLoading(false);
    }
  }, [filters.teamId, filters.seasonId]);

  useEffect(() => {
    loadClubAudit().catch(() => undefined);
  }, [loadClubAudit]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.playerId) {
      alert("Select a player.");
      return;
    }
    if (!form.toTeamId && !["released", "retirement"].includes(form.movementType)) {
      alert("Select a destination team.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setForm((f) => ({
        playerId: "",
        transferType: "club",
        movementType: "permanent",
        fromTeamId: "",
        toTeamId: "",
        seasonId: f.seasonId,
        competitionId: f.competitionId,
        effectiveDate: "",
        notes: "",
      }));
      await load();
    } else alert(data.error ?? "Transfer failed");
    setSaving(false);
  }

  async function runImport(dryRun: boolean) {
    setImporting(true);
    setImportSummary(null);
    setLoadError("");
    if (!dryRun) setPendingMatches([]);
    try {
      const res = await fetch("/api/admin/transfers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun,
          url: importSource.url,
          seasonLabel: importSource.seasonLabel,
          forcePlayerIds: dryRun ? undefined : forcePlayerIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `Import failed (${res.status})`);
      }
      const s = data.summary;
      setImportSummary(
        `${dryRun ? "Preview" : "Import"}: +${s.transfersAdded} added, ${s.transfersUpdated} updated, ${s.transfersSkipped ?? 0} skipped, ${s.newPlayers} new players, ${s.existingPlayersLinked} linked, ${s.pendingPlayerMatches?.length ?? 0} need review, ${s.warnings?.length ?? 0} warnings, ${s.errors?.length ?? 0} errors.`,
      );
      if (s.pendingPlayerMatches?.length) {
        setPendingMatches(s.pendingPlayerMatches);
      } else if (!dryRun) {
        setPendingMatches([]);
        setForcePlayerIds({});
      }
      if (!dryRun) await load();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function resolvePendingAndReimport() {
    const unresolved = pendingMatches.filter((p) => !forcePlayerIds[p.importKey]);
    if (unresolved.length > 0) {
      alert(`Select a player match for ${unresolved.length} pending row(s) before re-importing.`);
      return;
    }
    await runImport(false);
  }

  async function remove(id: string) {
    if (!confirm("Delete this transfer record?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/transfers?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) await load();
    else {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
    setDeletingId(null);
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} transfer record(s)?`)) return;
    const res = await fetch("/api/admin/transfers/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selectedIds] }),
    });
    const data = await res.json();
    if (res.ok) {
      setSelectedIds(new Set());
      await load();
    } else alert(data.error ?? "Bulk delete failed");
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="CMS"
        title="Transfers"
        description="Audit Premiership squads and transfers against Wikipedia and other sources. Review conflicts before updating player clubs."
      />

      {loadError ? (
        <div className="cms-card mb-4 border border-red-900/60">
          <p className="text-red-400 text-sm m-0">{loadError}</p>
        </div>
      ) : null}

      {metaError ? (
        <div className="cms-card mb-4 border border-red-900/60 flex flex-wrap items-center justify-between gap-3">
          <p className="text-red-400 text-sm m-0">{metaError}</p>
          <button
            type="button"
            disabled={metaLoading}
            onClick={() => loadMeta()}
            className="cms-btn cms-btn--secondary text-xs"
          >
            {metaLoading ? "Retrying…" : "Retry setup"}
          </button>
        </div>
      ) : null}

      <div className="cms-card mb-4">
        <h3 className="font-semibold m-0">Wikipedia import</h3>
        <p className="text-sm text-zinc-500 mt-1 mb-3">
          Import Premiership transfers from Wikipedia for audit. Default audit season is{" "}
          <strong className="font-normal text-zinc-400">2026–27</strong>. Imports add transfer
          history only — they do not overwrite player current clubs. Filter by season to review
          each window separately.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 mb-3">
          <label className="text-sm">
            <span className="block text-zinc-500 mb-1">Transfer window</span>
            <select
              className="cms-select w-full"
              value={`${importSource.seasonLabel}|${importSource.url}`}
              onChange={(e) => {
                const [seasonLabel, url] = e.target.value.split("|");
                setImportSource({ seasonLabel: seasonLabel ?? "2026–27", url: url ?? "" });
              }}
            >
              {importSources.length > 0 ? (
                importSources.map((source) => (
                  <option key={source.seasonLabel} value={`${source.seasonLabel}|${source.url}`}>
                    {source.seasonLabel} season
                  </option>
                ))
              ) : (
                <option value={`${importSource.seasonLabel}|${importSource.url}`}>
                  {importSource.seasonLabel} season
                </option>
              )}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block text-zinc-500 mb-1">Wikipedia URL</span>
            <input
              className="cms-input w-full"
              value={importSource.url}
              onChange={(e) => setImportSource((source) => ({ ...source, url: e.target.value }))}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={importing || metaLoading || Boolean(metaError)}
            onClick={() => runImport(true)}
            className="cms-btn cms-btn--secondary"
          >
            {importing ? "Working…" : "Preview import"}
          </button>
          <button
            type="button"
            disabled={importing || metaLoading || Boolean(metaError)}
            onClick={() => runImport(false)}
            className="cms-btn cms-btn--primary"
          >
            {importing ? "Importing…" : "Import from Wikipedia"}
          </button>
        </div>
        {metaLoading ? (
          <p className="text-sm text-zinc-500 mt-3 mb-0">Loading import options…</p>
        ) : null}
        {importSummary ? <p className="text-sm text-zinc-400 mt-3 mb-0">{importSummary}</p> : null}
        {pendingMatches.length > 0 ? (
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <h4 className="text-sm font-medium m-0 mb-2">Player match review</h4>
            <p className="text-xs text-zinc-500 mb-3">
              Fuzzy match confidence was below the auto-link threshold. Choose the correct existing
              player for each row, then re-run import.
            </p>
            <ul className="space-y-3 text-sm">
              {pendingMatches.map((row) => (
                <li key={row.importKey} className="rounded border border-zinc-800 p-3">
                  <p className="m-0 font-medium text-zinc-200">{row.playerName}</p>
                  <select
                    className="cms-select w-full mt-2"
                    value={forcePlayerIds[row.importKey] ?? ""}
                    onChange={(e) =>
                      setForcePlayerIds((prev) => ({ ...prev, [row.importKey]: e.target.value }))
                    }
                  >
                    <option value="">Select existing player…</option>
                    {row.candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({Math.round(c.score * 100)}% match)
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={importing}
              onClick={resolvePendingAndReimport}
              className="cms-btn cms-btn--primary mt-3"
            >
              {importing ? "Importing…" : "Apply matches & re-import"}
            </button>
          </div>
        ) : null}
      </div>

      <form onSubmit={submit} className="cms-card space-y-4 max-w-3xl mb-4">
        <h3 className="font-semibold m-0">Manual transfer</h3>
        {metaLoading ? (
          <p className="text-sm text-zinc-500 m-0">Loading players and teams…</p>
        ) : null}
        <fieldset disabled={metaLoading || Boolean(metaError)} className="space-y-4 border-0 p-0 m-0 min-w-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-zinc-400">Player</span>
              <SearchableSelect
                required
                value={form.playerId}
                onChange={(value) => setForm((f) => ({ ...f, playerId: value }))}
                options={playerOptions}
                placeholder="Search players…"
              />
            </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Movement type</span>
            <select
              className="cms-select w-full mt-1"
              value={form.movementType}
              onChange={(e) => setForm((f) => ({ ...f, movementType: e.target.value }))}
            >
              {MOVEMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {movementTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Scope</span>
            <select
              className="cms-select w-full mt-1"
              value={form.transferType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  transferType: e.target.value as "club" | "international",
                }))
              }
            >
              <option value="club">Club</option>
              <option value="international">International</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Season</span>
            <select
              className="cms-select w-full mt-1"
              value={form.seasonId}
              onChange={(e) => setForm((f) => ({ ...f, seasonId: e.target.value }))}
            >
              <option value="">None</option>
              {orderedSeasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayLabel ?? s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">From team</span>
            <GroupedTeamSelect
              value={form.fromTeamId}
              onChange={(value) => setForm((f) => ({ ...f, fromTeamId: value }))}
              groups={teamGroups}
              placeholder="Auto from player profile"
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">To team</span>
            <GroupedTeamSelect
              value={form.toTeamId}
              onChange={(value) => setForm((f) => ({ ...f, toTeamId: value }))}
              groups={teamGroups}
            />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-400">Transfer date</span>
            <input
              type="date"
              className="cms-input w-full mt-1"
              value={form.effectiveDate}
              onChange={(e) => setForm((f) => ({ ...f, effectiveDate: e.target.value }))}
            />
          </label>
        </div>
        <label className="block">
          <span className="text-sm text-zinc-400">Notes</span>
          <input
            className="cms-input w-full mt-1"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </label>
        <button type="submit" disabled={saving || metaLoading || Boolean(metaError)} className="cms-btn cms-btn--primary">
          {saving ? "Saving…" : "Save transfer"}
        </button>
        </fieldset>
      </form>

      <div className="cms-card mb-4">
        <h3 className="font-semibold m-0 mb-3">Club audit</h3>
        <p className="text-sm text-zinc-500 mt-0 mb-3">
          Compare current squad, transfers in/out, missing sources and club conflicts for the selected
          club and season filters below.
        </p>
        <TransferClubAuditPanel report={clubAudit} loading={clubAuditLoading} error={clubAuditError} />
      </div>

      <div className="cms-card mb-4">
        <h3 className="font-semibold m-0 mb-3">Filters</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="cms-input"
            placeholder="Search player or club…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
          <select
            className="cms-select"
            value={filters.seasonId}
            onChange={(e) => setFilters((f) => ({ ...f, seasonId: e.target.value }))}
          >
            {orderedSeasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayLabel ?? s.label}
              </option>
            ))}
            <option value="">All seasons</option>
          </select>
          <select
            className="cms-select"
            value={filters.movementType}
            onChange={(e) => setFilters((f) => ({ ...f, movementType: e.target.value }))}
          >
            <option value="">All movement types</option>
            {MOVEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {movementTypeLabel(type)}
              </option>
            ))}
          </select>
          <GroupedTeamSelect
            value={filters.teamId}
            onChange={(value) => setFilters((f) => ({ ...f, teamId: value }))}
            groups={teamGroups}
            placeholder="All teams"
            className="cms-select"
          />
          <select
            className="cms-select"
            value={filters.teamDirection}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                teamDirection: e.target.value as typeof filters.teamDirection,
              }))
            }
          >
            <option value="">Club filter: any</option>
            <option value="in">Transfers in</option>
            <option value="out">Transfers out</option>
            <option value="current">Current club</option>
          </select>
          <select
            className="cms-select"
            value={filters.sourceKey}
            onChange={(e) => setFilters((f) => ({ ...f, sourceKey: e.target.value }))}
          >
            <option value="">All sources</option>
            {TRANSFER_SOURCE_OPTIONS.map((source) => (
              <option key={source.key} value={source.key}>
                {source.label}
              </option>
            ))}
          </select>
          <select
            className="cms-select"
            value={filters.sourceConfidence}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                sourceConfidence: e.target.value as typeof filters.sourceConfidence,
              }))
            }
          >
            <option value="">All confidence</option>
            <option value="high">High confidence</option>
            <option value="medium">Medium confidence</option>
            <option value="low">Low confidence</option>
          </select>
          <select
            className="cms-select"
            value={filters.auditStatus}
            onChange={(e) => setFilters((f) => ({ ...f, auditStatus: e.target.value }))}
          >
            <option value="">All statuses</option>
            {TRANSFER_AUDIT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {transferAuditStatusLabel(status)}
              </option>
            ))}
          </select>
          <select
            className="cms-select"
            value={filters.sortBy}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                sortBy: e.target.value as typeof filters.sortBy,
              }))
            }
          >
            <option value="effectiveDate">Sort: date</option>
            <option value="playerName">Sort: player</option>
            <option value="createdAt">Sort: created</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <button
            type="button"
            onClick={() => {
              setPagination((p) => ({ ...p, page: 1 }));
              load().catch(() => undefined);
              loadClubAudit().catch(() => undefined);
            }}
            className="cms-btn cms-btn--secondary text-xs"
          >
            Apply filters
          </button>
          {selectedIds.size > 0 ? (
            <button type="button" onClick={bulkDelete} className="cms-btn cms-btn--secondary text-xs text-red-400">
              Delete selected ({selectedIds.size})
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : transfers.length === 0 ? (
        <div className="cms-card">
          <p className="text-zinc-400 m-0">No transfers recorded yet.</p>
        </div>
      ) : (
        <div className="cms-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="py-2 pr-2" />
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Player</th>
                <th className="py-2 pr-3">Movement</th>
                <th className="py-2 pr-3">Season</th>
                <th className="py-2 pr-3">From</th>
                <th className="py-2 pr-3">To</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Source</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id} className="border-b border-zinc-800/60">
                  <td className="py-2 pr-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleSelected(t.id)}
                    />
                  </td>
                  <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">
                    {formatDate(t.effectiveDate)}
                  </td>
                  <td className="py-2 pr-3">
                    <Link href={`/admin/players/${t.playerId}/edit`} className="text-emerald-400">
                      {t.playerName}
                    </Link>
                  </td>
                  <td className="py-2 pr-3 text-zinc-400">{movementTypeLabel(t.movementType)}</td>
                  <td className="py-2 pr-3 text-zinc-500">{t.seasonLabel ?? "—"}</td>
                  <td className="py-2 pr-3 text-zinc-400">
                    {t.fromClub ?? t.fromTeamName ?? "—"}
                  </td>
                  <td className="py-2 pr-3 text-zinc-300">{t.toClub ?? t.toTeamName ?? "—"}</td>
                  <td className="py-2 pr-3">
                    <TransferAuditBadges statuses={t.auditStatuses} />
                  </td>
                  <td className="py-2 pr-3">
                    <TransferSourceCell
                      label={t.sourceLabel}
                      url={t.sourceUrl}
                      confidence={t.sourceConfidence}
                    />
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={deletingId === t.id}
                      onClick={() => remove(t.id)}
                      className="cms-btn cms-btn--secondary text-xs text-red-400"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-zinc-600 mt-3 mb-0">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} transfers
          </p>
        </div>
      )}
    </>
  );
}
