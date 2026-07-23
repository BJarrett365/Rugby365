"use client";

import { useCallback, useEffect, useState } from "react";
import { MatchCmsInfoHeader } from "@/components/admin/MatchCmsInfoHeader";
import {
  TEAM_STAT_METRIC_KEYS,
  TEAM_STAT_SCOPES,
  type TeamStatPairRow,
} from "@/lib/match-cms-data-shared";

type StatsPayload = {
  fixture: {
    id: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
    homeTeamName: string | null;
    awayTeamName: string | null;
    kickoffAt: string | null;
    status: string;
  };
  pairRows: TeamStatPairRow[];
};

function metricLabel(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MatchTeamStatsEditor({ fixtureId }: { fixtureId: string }) {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [type, setType] = useState<string>("tries");
  const [scope, setScope] = useState<string>("Total");
  const [home, setHome] = useState("0");
  const [away, setAway] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/matches/${fixtureId}/stats`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed to load stats");
    setData(json as StatsPayload);
  }, [fixtureId]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      try {
        await reload();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  function loadRowIntoForm(row: TeamStatPairRow) {
    setType(row.type);
    setScope(String(row.scope));
    setHome(String(row.home));
    setAway(String(row.away));
    setMessage("");
  }

  async function submit() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/matches/${fixtureId}/stats`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "team_pair",
          type,
          scope,
          home: Number(home || 0),
          away: Number(away || 0),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setData((prev) =>
        prev
          ? {
              ...prev,
              pairRows: (json.rows as TeamStatPairRow[]) ?? prev.pairRows,
            }
          : prev,
      );
      setMessage(`Saved ${metricLabel(type)} (${scope}): ${home}–${away}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="match-cms-muted text-sm m-0">Loading match stats…</p>;
  if (error && !data) return <p className="match-cms-error m-0">{error}</p>;
  if (!data) return null;

  return (
    <div className="match-cms-editor space-y-4">
      <MatchCmsInfoHeader
        matchId={data.fixture.id}
        homeTeam={{ id: data.fixture.homeTeamId, name: data.fixture.homeTeamName }}
        awayTeam={{ id: data.fixture.awayTeamId, name: data.fixture.awayTeamName }}
        kickoffAt={data.fixture.kickoffAt}
        status={data.fixture.status}
      />

      <div className="cms-card--nested p-3 space-y-3">
        <h4 className="cms-section-title text-sm m-0">Match statistics</h4>
        <div className="match-cms-editor-form match-cms-editor-form--stats">
          <label className="match-sources__field">
            Type
            <select className="cms-select" value={type} onChange={(e) => setType(e.target.value)}>
              {TEAM_STAT_METRIC_KEYS.map((key) => (
                <option key={key} value={key}>
                  {metricLabel(key)}
                </option>
              ))}
            </select>
          </label>
          <label className="match-sources__field">
            Scope
            <select className="cms-select" value={scope} onChange={(e) => setScope(e.target.value)}>
              {TEAM_STAT_SCOPES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="match-sources__field">
            Home
            <input
              className="cms-input"
              inputMode="numeric"
              value={home}
              onChange={(e) => setHome(e.target.value.replace(/[^\d]/g, ""))}
            />
          </label>
          <label className="match-sources__field">
            Away
            <input
              className="cms-input"
              inputMode="numeric"
              value={away}
              onChange={(e) => setAway(e.target.value.replace(/[^\d]/g, ""))}
            />
          </label>
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={saving}
            onClick={() => {
              void submit();
            }}
          >
            {saving ? "Saving…" : "Submit"}
          </button>
        </div>
      </div>

      <div className="cms-table-scroll">
        <table className="cms-table w-full text-sm match-cms-dense-table">
          <thead>
            <tr>
              <th>Stat</th>
              <th>Scope</th>
              <th className="text-center">Home</th>
              <th className="text-center">Away</th>
              <th> </th>
            </tr>
          </thead>
          <tbody>
            {data.pairRows.map((row) => (
              <tr key={`${row.type}-${row.scope}`}>
                <td>{row.label}</td>
                <td>{row.scope}</td>
                <td className="text-center font-mono">{row.home}</td>
                <td className="text-center font-mono">{row.away}</td>
                <td>
                  <button
                    type="button"
                    className="cms-btn cms-btn--secondary text-xs"
                    onClick={() => loadRowIntoForm(row)}
                  >
                    Load
                  </button>
                </td>
              </tr>
            ))}
            {data.pairRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="match-cms-muted">
                  No team stats yet — submit a type above to create values.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {error ? <p className="match-cms-error">{error}</p> : null}
      {message ? <p className="match-sources__ok">{message}</p> : null}
    </div>
  );
}
