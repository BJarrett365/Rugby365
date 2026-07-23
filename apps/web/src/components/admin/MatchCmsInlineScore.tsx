"use client";

import { useEffect, useState } from "react";
import { IconSave } from "@/components/admin/MatchCmsIcons";

const STATUS_OPTIONS = [
  { value: "scheduled", short: "NS" },
  { value: "live", short: "Live" },
  { value: "half_time", short: "HT" },
  { value: "full_time", short: "FT" },
  { value: "postponed", short: "PP" },
  { value: "cancelled", short: "Can" },
] as const;

const STATUS_ALIASES: Record<string, string> = {
  scheduled: "scheduled",
  ns: "scheduled",
  not_started: "scheduled",
  "not-started": "scheduled",
  live: "live",
  in_progress: "live",
  half_time: "half_time",
  ht: "half_time",
  "half-time": "half_time",
  full_time: "full_time",
  ft: "full_time",
  finished: "full_time",
  completed: "full_time",
  "full-time": "full_time",
  postponed: "postponed",
  pp: "postponed",
  cancelled: "cancelled",
  canceled: "cancelled",
  can: "cancelled",
};

export function normalizeMatchStatus(raw: string | null | undefined): string {
  const key = String(raw ?? "scheduled")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  return STATUS_ALIASES[key] ?? "scheduled";
}

type Props = {
  matchId: string;
  homeScore: number;
  awayScore: number;
  status: string;
  scoreLocked?: boolean;
  statusLocked?: boolean;
  providerLabel?: string;
  onSaved?: (next: { homeScore: number; awayScore: number; status: string }) => void;
};

/** Score + Status cells (fragment) — dense for list scanning. */
export function MatchCmsInlineScore({
  matchId,
  homeScore,
  awayScore,
  status,
  scoreLocked,
  statusLocked,
  providerLabel,
  onSaved,
}: Props) {
  const homeValue = Number.isFinite(Number(homeScore)) ? String(Math.floor(Number(homeScore))) : "0";
  const awayValue = Number.isFinite(Number(awayScore)) ? String(Math.floor(Number(awayScore))) : "0";
  const [home, setHome] = useState(homeValue);
  const [away, setAway] = useState(awayValue);
  const [st, setSt] = useState(normalizeMatchStatus(status));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setHome(homeValue);
    setAway(awayValue);
    setSt(normalizeMatchStatus(status));
  }, [homeValue, awayValue, status]);

  const normalizedStatus = normalizeMatchStatus(status);
  const homeNum = Number(homeValue);
  const awayNum = Number(awayValue);
  const scoreDirty = Number(home || 0) !== homeNum || Number(away || 0) !== awayNum;
  const statusDirty = st !== normalizedStatus;
  const dirty = scoreDirty || statusDirty;
  /** Operators can always save score-line edits; locks only block automatic sync. */
  const canSave = dirty && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError("");
    setJustSaved(false);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/score`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeScore: Number(home || 0),
          awayScore: Number(away || 0),
          status: st,
          lockAfterSave: true,
          reason: "Inline CMS score/status override",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? data.message ?? "Save failed");
        return;
      }
      const next = {
        homeScore: Number(data.fixture.homeScore),
        awayScore: Number(data.fixture.awayScore),
        status: String(data.fixture.status),
      };
      setHome(String(next.homeScore));
      setAway(String(next.awayScore));
      setSt(normalizeMatchStatus(next.status));
      setJustSaved(true);
      onSaved?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const tip = dirty
    ? `Save score line${providerLabel ? ` · overrides ${providerLabel}` : ""}: ${homeNum}–${awayNum}/${normalizedStatus} → ${home || 0}–${away || 0}/${st}`
    : scoreLocked || statusLocked
      ? "Saved · protected from automatic sync overwrite. Edit and save again to update."
      : "Edit score and status, then save to the database";

  const knownOption = STATUS_OPTIONS.some((s) => s.value === st);
  const statusOptions = knownOption
    ? STATUS_OPTIONS
    : [{ value: st, short: st }, ...STATUS_OPTIONS];

  return (
    <>
      <td title={tip}>
        <div className="match-cms-score-line">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="cms-input match-cms-score-input"
            value={home}
            disabled={saving}
            onChange={(e) => {
              setJustSaved(false);
              setHome(e.target.value.replace(/[^\d]/g, ""));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save();
              }
            }}
            aria-label="Home score"
          />
          <span className="match-cms-score-sep" aria-hidden>
            –
          </span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            className="cms-input match-cms-score-input"
            value={away}
            disabled={saving}
            onChange={(e) => {
              setJustSaved(false);
              setAway(e.target.value.replace(/[^\d]/g, ""));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save();
              }
            }}
            aria-label="Away score"
          />
          <button
            type="button"
            className={`match-cms-score-save${canSave ? " match-cms-score-save--ready" : ""}${justSaved ? " match-cms-score-save--saved" : ""}`}
            disabled={!canSave}
            onClick={() => {
              void save();
            }}
            title={canSave ? "Save score line to database" : tip}
            aria-label="Save score line to database"
          >
            <IconSave />
          </button>
          {dirty ? <span className="match-cms-dirty-dot" title="Unsaved changes" /> : null}
          {error ? (
            <span className="match-cms-error text-[10px] max-w-[6rem] truncate" title={error}>
              {error}
            </span>
          ) : null}
        </div>
      </td>
      <td>
        <select
          className="cms-select match-cms-status-select text-[11px] py-0.5 h-7 min-w-[3.75rem]"
          value={st}
          disabled={saving}
          onChange={(e) => {
            setJustSaved(false);
            setSt(e.target.value);
          }}
          aria-label="Match status"
          title={statusLocked ? `Status: ${st} (sync-protected)` : `Status: ${st}`}
        >
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.short}
            </option>
          ))}
        </select>
      </td>
    </>
  );
}
