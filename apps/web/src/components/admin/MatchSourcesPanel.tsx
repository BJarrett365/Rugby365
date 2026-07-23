"use client";

import { useCallback, useEffect, useState } from "react";
import { IconLink } from "@/components/admin/MatchCmsIcons";
import { SourceProviderPill } from "@/components/admin/SourceProviderPill";
import {
  MATCH_CMS_PROVIDERS,
  matchProviderBlurb,
  matchProviderLabel,
  type MatchCmsProvider,
} from "@/lib/match-cms-list-utils";

type SourcesState = {
  fixtureId: string;
  primarySource: MatchCmsProvider;
  inferredSource: MatchCmsProvider;
  sport365Url: string | null;
  planetRugbyUrl: string | null;
  externalMatchId: string | null;
  rugbyDataExternalId: string | null;
  rugbyDataMappingStatus: string | null;
  connections: Record<MatchCmsProvider, boolean>;
};

const SELECTABLE: MatchCmsProvider[] = [...MATCH_CMS_PROVIDERS];

export function MatchSourcesPanel({
  fixtureId,
  onSaved,
}: {
  fixtureId: string;
  onSaved?: () => void | Promise<void>;
}) {
  const [state, setState] = useState<SourcesState | null>(null);
  const [selected, setSelected] = useState<MatchCmsProvider>("planet_rugby");
  const [planetRugbyUrl, setPlanetRugbyUrl] = useState("");
  const [sport365Url, setSport365Url] = useState("");
  const [externalMatchId, setExternalMatchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<"sport365" | "planet_rugby" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const applyState = useCallback((next: SourcesState) => {
    setState(next);
    setSelected(next.primarySource);
    setPlanetRugbyUrl(next.planetRugbyUrl ?? "");
    setSport365Url(next.sport365Url ?? "");
    setExternalMatchId(next.externalMatchId ?? "");
  }, []);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/matches/${fixtureId}/sources`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Failed to load sources");
    applyState(data as SourcesState);
  }, [applyState, fixtureId]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError("");
      try {
        await reload();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load sources");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function save(primary?: MatchCmsProvider): Promise<boolean> {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/admin/matches/${fixtureId}/sources`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primarySource: primary ?? selected,
          planetRugbyUrl: planetRugbyUrl.trim() || null,
          sport365Url: sport365Url.trim() || null,
          externalMatchId: externalMatchId.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      applyState(data as SourcesState);
      setMessage("Primary source saved. This provider powers match data for CMS sync.");
      await onSaved?.();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function selectSource(provider: MatchCmsProvider) {
    const previous = selected;
    setSelected(provider);
    setMessage("");
    setError("");
    const ok = await save(provider);
    if (!ok) setSelected(previous);
  }

  async function syncSport365() {
    setSyncing("sport365");
    setError("");
    setMessage("");
    try {
      if (sport365Url.trim() !== (state?.sport365Url ?? "")) {
        await save();
      }
      const res = await fetch(`/api/admin/matches/${fixtureId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importEvents: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sport365 sync failed");
      setMessage("Synced scores and events from Sport365.");
      await reload();
      await onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sport365 sync failed");
    } finally {
      setSyncing(null);
    }
  }

  async function enrichPlanetRugby() {
    setSyncing("planet_rugby");
    setError("");
    setMessage("");
    try {
      if (planetRugbyUrl.trim() !== (state?.planetRugbyUrl ?? "")) {
        await save();
      }
      const res = await fetch(`/api/admin/matches/${fixtureId}/enrich-planet-rugby`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replaceEvents: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Planet Rugby enrich failed");
      setMessage("Enriched match from Planet Rugby.");
      await reload();
      await onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Planet Rugby enrich failed");
    } finally {
      setSyncing(null);
    }
  }

  if (loading && !state) {
    return <p className="match-cms-muted text-sm m-0">Loading sources…</p>;
  }

  if (error && !state) {
    return <p className="match-cms-error m-0">{error}</p>;
  }

  if (!state) return null;

  return (
    <div className="match-sources">
      <div className="match-sources__header">
        <div>
          <h3 className="cms-section-title match-sources__title">Data sources</h3>
          <p className="match-sources__lead">
            Choose which provider powers this match. Linked sources stay available for sync;
            the primary source is what CMS treats as the active feed.
          </p>
        </div>
        <div className="match-sources__active">
          <span className="match-sources__active-label">Powering data</span>
          <SourceProviderPill provider={state.primarySource} />
        </div>
      </div>

      <div className="match-sources__grid" role="listbox" aria-label="Match data sources">
        {SELECTABLE.map((provider) => {
          const connected = state.connections[provider];
          const isPrimary = selected === provider;
          return (
            <button
              key={provider}
              type="button"
              role="option"
              aria-selected={isPrimary}
              className={`match-sources__card${isPrimary ? " match-sources__card--active" : ""}`}
              onClick={() => {
                void selectSource(provider);
              }}
              disabled={saving}
            >
              <span className="match-sources__card-icon" aria-hidden>
                <IconLink className="w-4 h-4" />
              </span>
              <span className="match-sources__card-body">
                <span className="match-sources__card-name">{matchProviderLabel(provider)}</span>
                <span className={`match-sources__card-status${connected ? " is-linked" : ""}`}>
                  {connected ? "Linked" : "Not linked"}
                </span>
              </span>
              {isPrimary ? <span className="match-sources__card-badge">Primary</span> : null}
            </button>
          );
        })}
      </div>

      <div className="match-sources__detail cms-card--nested">
        <h4 className="match-sources__detail-title">{matchProviderLabel(selected)}</h4>
        <p className="match-sources__detail-blurb">{matchProviderBlurb(selected)}</p>

        {selected === "planet_rugby" ? (
          <label className="match-sources__field">
            Planet Rugby match URL
            <input
              type="url"
              className="cms-input"
              value={planetRugbyUrl}
              onChange={(e) => setPlanetRugbyUrl(e.target.value)}
              placeholder="https://www.planetrugby.com/matches/…"
            />
          </label>
        ) : null}

        {selected === "sport365" ? (
          <label className="match-sources__field">
            Sport365 match URL
            <input
              type="url"
              className="cms-input"
              value={sport365Url}
              onChange={(e) => setSport365Url(e.target.value)}
              placeholder="https://www.sport365.com/rugby-union/…/1-4307586"
            />
          </label>
        ) : null}

        {selected === "rugby_data" ? (
          <div className="match-sources__meta">
            <p className="m-0">
              Mapping ID:{" "}
              <code>{state.rugbyDataExternalId ?? "— none confirmed —"}</code>
            </p>
            <p className="match-cms-muted m-0 text-xs">
              Status: {state.rugbyDataMappingStatus ?? "unmapped"}. Confirm mappings in Data
              Integration when available.
            </p>
          </div>
        ) : null}

        {selected === "livesport" || selected === "wikipedia" || selected === "manual" ? (
          <label className="match-sources__field">
            External match id
            <input
              className="cms-input"
              value={externalMatchId}
              onChange={(e) => setExternalMatchId(e.target.value)}
              placeholder={
                selected === "livesport"
                  ? "livesport:…"
                  : selected === "wikipedia"
                    ? "wikipedia:…"
                    : "Optional external id"
              }
            />
          </label>
        ) : null}

        {(selected === "planet_rugby" || selected === "sport365") && (
          <label className="match-sources__field">
            External match id (optional)
            <input
              className="cms-input"
              value={externalMatchId}
              onChange={(e) => setExternalMatchId(e.target.value)}
              placeholder="Usually derived from the URL"
            />
          </label>
        )}

        <div className="match-sources__actions">
          <button
            type="button"
            className="cms-btn cms-btn--primary touch-target"
            disabled={saving}
            onClick={() => {
              void save();
            }}
          >
            {saving ? "Saving…" : "Save connection"}
          </button>

          {selected === "sport365" ? (
            <button
              type="button"
              className="cms-btn cms-btn--secondary touch-target"
              disabled={Boolean(syncing) || !sport365Url.trim()}
              onClick={() => {
                void syncSport365();
              }}
            >
              {syncing === "sport365" ? "Syncing…" : "Sync from Sport365"}
            </button>
          ) : null}

          {selected === "planet_rugby" ? (
            <button
              type="button"
              className="cms-btn cms-btn--secondary touch-target"
              disabled={Boolean(syncing) || !planetRugbyUrl.trim()}
              onClick={() => {
                void enrichPlanetRugby();
              }}
            >
              {syncing === "planet_rugby" ? "Enriching…" : "Enrich from Planet Rugby"}
            </button>
          ) : null}
        </div>

        {state.inferredSource !== state.primarySource ? (
          <p className="match-sources__hint">
            Auto-detected from links: <strong>{matchProviderLabel(state.inferredSource)}</strong>.
            Your primary choice overrides that for CMS.
          </p>
        ) : null}

        {error ? <p className="match-cms-error">{error}</p> : null}
        {message ? <p className="match-sources__ok">{message}</p> : null}
      </div>
    </div>
  );
}
