"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ComparePlayersResult } from "@/components/players/ComparePlayersResult";
import {
  COMPARE_PICKER_INTERNATIONAL_KEY,
  COMPARE_PICKER_UNASSIGNED,
  filterComparePickerGroups,
  groupComparePickerPlayers,
  mergeComparePickerPlayers,
  squadOptionsForNationGroup,
  type ComparePickerPlayer,
} from "@/lib/compare-player-picker-groups";

type SearchHit = ComparePickerPlayer;

type Side = "a" | "b";

type SideState = {
  playerSlug: string;
  picked: SearchHit | null;
};

type Props = {
  /** Used for the “back to stats” link on competition compare pages. */
  competitionSlug?: string;
  competitionName?: string;
  /** Prefill from /players/compare?player1=&player2= (or legacy player/opponent). */
  initialPlayerA?: string | null;
  initialPlayerB?: string | null;
  /**
   * When true (profile → compare?player=slug), Player A is fixed — only show an opponent picker.
   */
  anchoredMode?: boolean;
  anchoredDisplayName?: string | null;
};

type SearchApiRow = {
  slug: string;
  name: string;
  positionName: string | null;
  clubName: string | null;
  nationName?: string | null;
};

function emptySide(): SideState {
  return { playerSlug: "", picked: null };
}

function playerLabel(p: { name: string }): string {
  return p.name;
}

function mapSearchRows(rows: SearchApiRow[] | undefined, otherSlug: string): ComparePickerPlayer[] {
  return (rows ?? [])
    .filter((r) => r.slug && r.slug !== otherSlug)
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      position: r.positionName,
      clubName: r.clubName,
      countryName: r.nationName ?? null,
    }));
}

async function fetchPlayerSearch(input: {
  query: string;
  page: number;
  otherSlug: string;
}): Promise<{ rows: ComparePickerPlayer[]; total: number }> {
  const params = new URLSearchParams({ pageSize: "100", page: String(input.page) });
  if (input.query.trim().length >= 2) params.set("q", input.query.trim());
  else params.set("browse", "1");
  const res = await fetch(`/api/players/search?${params}`, { cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as {
    rows?: SearchApiRow[];
    total?: number;
  };
  return {
    rows: mapSearchRows(json.rows, input.otherSlug),
    total: typeof json.total === "number" ? json.total : 0,
  };
}

function PlayerSearchField({
  otherSlug,
  selectedSlug,
  onPick,
  label,
  rosterPlayers,
  rosterLoading,
  useRoster,
}: {
  otherSlug: string;
  selectedSlug: string;
  onPick: (hit: SearchHit) => void;
  label: string;
  rosterPlayers: ComparePickerPlayer[] | null;
  rosterLoading: boolean;
  useRoster: boolean;
}) {
  const [query, setQuery] = useState("");
  const [remoteHits, setRemoteHits] = useState<ComparePickerPlayer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(!useRoster);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nation, setNation] = useState("");
  const [squadKey, setSquadKey] = useState(COMPARE_PICKER_INTERNATIONAL_KEY);
  const selectClass =
    "w-full rounded-lg border border-[var(--pr-mc-border)] bg-[var(--pr-mc-bg)] px-3 py-2 text-sm text-[var(--pr-mc-text)] disabled:opacity-50";

  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    if (useRoster && q.length < 2) {
      setRemoteHits([]);
      setTotal(0);
      setPage(1);
      setLoading(false);
      return;
    }

    setLoading(true);
    setPage(1);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await fetchPlayerSearch({ query: q, page: 1, otherSlug });
          if (cancelled) return;
          setRemoteHits(result.rows);
          setTotal(result.total);
        } catch {
          if (!cancelled) {
            setRemoteHits([]);
            setTotal(0);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, q.length >= 2 ? 250 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, otherSlug, useRoster]);

  const loadMore = () => {
    const q = query.trim();
    const nextPage = page + 1;
    setLoadingMore(true);
    void (async () => {
      try {
        const result = await fetchPlayerSearch({ query: q, page: nextPage, otherSlug });
        setRemoteHits((prev) => mergeComparePickerPlayers(prev, result.rows));
        setTotal(result.total);
        setPage(nextPage);
      } finally {
        setLoadingMore(false);
      }
    })();
  };

  const groupedPlayers = useMemo(() => {
    const base = useRoster ? mergeComparePickerPlayers(rosterPlayers ?? [], remoteHits) : remoteHits;
    return groupComparePickerPlayers(base);
  }, [useRoster, rosterPlayers, remoteHits]);

  const groups = useMemo(
    () => filterComparePickerGroups(groupedPlayers, query, otherSlug),
    [groupedPlayers, query, otherSlug],
  );

  const selectedGroup = groups.find((group) => group.nation === nation) ?? groups[0] ?? null;
  const squadOptions = selectedGroup ? squadOptionsForNationGroup(selectedGroup) : [];
  const selectedSquad =
    squadOptions.find((option) => option.key === squadKey) ?? squadOptions[0] ?? null;
  const searching = query.trim().length >= 2;
  const listedPlayers = searching
    ? groups.flatMap((group) => {
        const international = group.clubs.find((club) => club.kind === "international");
        if (international) return international.players;
        return group.clubs.flatMap((club) => club.players);
      })
    : (selectedSquad?.players ?? []);
  const uniqueListed = useMemo(() => {
    const seen = new Set<string>();
    const rows: ComparePickerPlayer[] = [];
    for (const player of listedPlayers) {
      if (player.slug === otherSlug || seen.has(player.slug)) continue;
      seen.add(player.slug);
      rows.push(player);
    }
    return rows;
  }, [listedPlayers, otherSlug]);

  useEffect(() => {
    if (!selectedGroup) return;
    if (selectedGroup.nation !== nation) setNation(selectedGroup.nation);
  }, [selectedGroup, nation]);

  useEffect(() => {
    if (squadOptions.length === 0) return;
    if (!squadOptions.some((option) => option.key === squadKey)) {
      setSquadKey(squadOptions[0]!.key);
    }
  }, [squadOptions, squadKey]);

  const showLoading = useRoster ? rosterLoading : loading;
  const canLoadMore = !useRoster && !loading && remoteHits.length < total;

  return (
    <div className="space-y-1.5">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[var(--pr-mc-muted)]">{label}</span>
        <input
          type="search"
          value={query}
          placeholder="Search by name, club or country…"
          autoComplete="off"
          className={selectClass}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {!searching ? (
        <>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[var(--pr-mc-muted)]">1. Country</span>
        <select
          className={selectClass}
          value={selectedGroup?.nation ?? ""}
          disabled={showLoading || groups.length === 0}
          onChange={(e) => {
            setNation(e.target.value);
            setSquadKey(COMPARE_PICKER_INTERNATIONAL_KEY);
          }}
        >
          {groups.length === 0 ? <option value="">No countries</option> : null}
          {groups.map((group) => (
            <option key={group.nation} value={group.nation}>
              {group.nation}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[var(--pr-mc-muted)]">2. Squad</span>
        <select
          className={selectClass}
          value={selectedSquad?.key ?? ""}
          disabled={showLoading || squadOptions.length === 0}
          onChange={(e) => setSquadKey(e.target.value)}
        >
          {squadOptions.some((option) => option.kind === "international") ? (
            <optgroup label="Internationals">
              {squadOptions
                .filter((option) => option.kind === "international")
                .map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label} ({option.players.length})
                  </option>
                ))}
            </optgroup>
          ) : null}
          {squadOptions.some((option) => option.kind === "club") ? (
            <optgroup label="Clubs">
              {squadOptions
                .filter((option) => option.kind === "club")
                .map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label} ({option.players.length})
                  </option>
                ))}
            </optgroup>
          ) : null}
          {squadOptions.some((option) => option.kind === "unassigned") ? (
            <optgroup label={COMPARE_PICKER_UNASSIGNED}>
              {squadOptions
                .filter((option) => option.kind === "unassigned")
                .map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label} ({option.players.length})
                  </option>
                ))}
            </optgroup>
          ) : null}
        </select>
      </label>
        </>
      ) : null}

      <div className="pr-mc-compare-picker">
        {showLoading ? (
          <p className="m-0 px-3 py-2 text-sm text-[var(--pr-mc-muted)]">Loading players…</p>
        ) : uniqueListed.length === 0 ? (
          <p className="m-0 px-3 py-2 text-sm text-[var(--pr-mc-muted)]">No players found.</p>
        ) : (
          <ul className="pr-mc-compare-picker__list">
            {uniqueListed.map((hit) => {
              const selected = hit.slug === selectedSlug;
              return (
                <li key={hit.slug}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--pr-mc-panel)] ${
                      selected
                        ? "bg-[var(--pr-mc-panel)] text-[var(--pr-mc-text)] font-medium"
                        : "text-[var(--pr-mc-text)]"
                    }`}
                    onClick={() => onPick(hit)}
                  >
                    {playerLabel(hit)}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {canLoadMore ? (
          <div className="border-t border-[var(--pr-mc-border)] p-2">
            <button
              type="button"
              className="w-full rounded-md px-3 py-2 text-sm text-[var(--pr-mc-link,#54b989)] hover:underline disabled:opacity-50"
              disabled={loadingMore}
              onClick={loadMore}
            >
              {loadingMore ? "Loading…" : `Show more (${remoteHits.length} of ${total})`}
            </button>
          </div>
        ) : null}
      </div>
      {!showLoading && uniqueListed.length > 0 ? (
        <p className="m-0 text-[11px] text-[var(--pr-mc-grey)]">
          Choose a country, then International for the national squad, or a club. Players without a
          club are under Unassigned.
        </p>
      ) : null}
    </div>
  );
}

export function ComparePlayersPicker({
  competitionSlug,
  initialPlayerA,
  initialPlayerB,
  anchoredMode = false,
  anchoredDisplayName = null,
}: Props) {
  const hubSlug = competitionSlug?.trim() ?? "";

  const [sideA, setSideA] = useState<SideState>(() => emptySide());
  const [sideB, setSideB] = useState<SideState>(() => emptySide());
  const [initialHydrated, setInitialHydrated] = useState(false);
  const [rosterPlayers, setRosterPlayers] = useState<ComparePickerPlayer[] | null>(null);
  const [rosterLoading, setRosterLoading] = useState(Boolean(hubSlug));

  useEffect(() => {
    if (!hubSlug) {
      setRosterPlayers(null);
      setRosterLoading(false);
      return;
    }

    let cancelled = false;
    setRosterLoading(true);
    void (async () => {
      try {
        const res = await fetch(
          `/api/competitions/by-slug/${encodeURIComponent(hubSlug)}/compare-roster`,
          { cache: "no-store" },
        );
        const json = (await res.json().catch(() => ({}))) as {
          players?: Array<{
            slug: string;
            name: string;
            position: string | null;
            clubName?: string | null;
            countryName?: string | null;
            teamName?: string | null;
          }>;
        };
        if (cancelled) return;
        setRosterPlayers(
          (json.players ?? [])
            .filter((row) => row.slug?.trim())
            .map((row) => ({
              slug: row.slug,
              name: row.name,
              position: row.position,
              clubName: row.clubName ?? null,
              countryName: row.countryName ?? row.teamName ?? null,
            })),
        );
      } catch {
        if (!cancelled) setRosterPlayers([]);
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hubSlug]);

  useEffect(() => {
    if (initialHydrated) return;
    const a = initialPlayerA?.trim() || "";
    const b = initialPlayerB?.trim() || "";
    if (!a && !b) {
      setInitialHydrated(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      async function resolveSlug(slug: string): Promise<SearchHit | null> {
        const q = slug.replace(/-/g, " ").trim();
        const res = await fetch(
          `/api/players/search?q=${encodeURIComponent(q.length >= 2 ? q : slug)}&pageSize=48`,
          { cache: "no-store" },
        );
        const json = (await res.json().catch(() => ({}))) as { rows?: SearchApiRow[] };
        const hit = (json.rows ?? []).find((r) => r.slug === slug || r.slug.startsWith(`${slug}-`));
        if (!hit) {
          return {
            slug,
            name:
              slug
                .split("-")
                .filter((p) => !/^[a-z0-9]{6,}$/i.test(p))
                .join(" ")
                .replace(/\b\w/g, (c) => c.toUpperCase()) || slug,
            position: null,
            clubName: null,
            countryName: null,
          };
        }
        return {
          slug: hit.slug,
          name: hit.name,
          position: hit.positionName,
          clubName: hit.clubName,
          countryName: hit.nationName ?? null,
        };
      }

      try {
        const [hitA, hitB] = await Promise.all([
          a ? resolveSlug(a) : Promise.resolve(null),
          b ? resolveSlug(b) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (hitA) {
          setSideA({ playerSlug: hitA.slug, picked: hitA });
        }
        if (hitB) {
          setSideB({ playerSlug: hitB.slug, picked: hitB });
        }
      } finally {
        if (!cancelled) setInitialHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialPlayerA, initialPlayerB, initialHydrated]);

  const canCompare = Boolean(
    sideA.playerSlug && sideB.playerSlug && sideA.playerSlug !== sideB.playerSlug,
  );

  const pickFromSearch = (side: Side, hit: SearchHit) => {
    const next: SideState = { playerSlug: hit.slug, picked: hit };
    if (side === "a") setSideA(next);
    else setSideB(next);
  };

  const renderSide = (side: Side) => {
    const state = side === "a" ? sideA : sideB;
    const other = side === "a" ? sideB : sideA;
    const heading =
      anchoredMode && side === "b" ? "Player B" : `Player ${side.toUpperCase()}`;

    return (
      <div className="rounded-xl border border-[var(--pr-mc-border)] bg-[var(--pr-mc-panel)] p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pr-mc-grey)] m-0">
          {heading}
        </p>

        <PlayerSearchField
          otherSlug={other.playerSlug}
          selectedSlug={state.playerSlug}
          label="Search or pick a country, then a squad"
          onPick={(hit) => pickFromSearch(side, hit)}
          rosterPlayers={rosterPlayers}
          rosterLoading={rosterLoading}
          useRoster={Boolean(hubSlug)}
        />

        {state.playerSlug && state.picked ? (
          <p className="m-0 text-xs text-[var(--pr-mc-muted)]">
            Selected:{" "}
            <span className="text-[var(--pr-mc-text)]">{playerLabel(state.picked)}</span>
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {anchoredMode ? (
        <p className="m-0 text-sm text-[var(--pr-mc-muted)]">
          Comparing against{" "}
          <strong className="text-[var(--pr-mc-text)]">
            {anchoredDisplayName || sideA.picked?.name || initialPlayerA}
          </strong>
          . Search or pick Player B from the list.
        </p>
      ) : (
        <p className="m-0 text-sm text-[var(--pr-mc-muted)]">
          Pick Player A and Player B. Choose a country, then the international squad or a club.
        </p>
      )}

      {anchoredMode ? (
        <div className="grid gap-4 max-w-xl">{renderSide("b")}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {renderSide("a")}
          {renderSide("b")}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {canCompare ? (
          <Link
            href={`/players/compare?player=${encodeURIComponent(sideA.playerSlug)}&opponent=${encodeURIComponent(sideB.playerSlug)}`}
            className="cms-btn cms-btn--primary touch-target"
          >
            Open full compare
          </Link>
        ) : (
          <button type="button" className="cms-btn cms-btn--primary touch-target" disabled>
            {anchoredMode ? "Select an opponent" : "Select two players to compare"}
          </button>
        )}
        {sideA.playerSlug && sideB.playerSlug && sideA.playerSlug === sideB.playerSlug ? (
          <p className="m-0 text-sm text-amber-200">Pick two different players.</p>
        ) : null}
        {hubSlug ? (
          <Link
            href={`/competitions/${encodeURIComponent(hubSlug)}/stats`}
            className="text-sm text-[var(--pr-mc-link,#54b989)] hover:underline"
          >
            Back to player stats
          </Link>
        ) : anchoredMode && initialPlayerA ? (
          <Link
            href={`/players/${encodeURIComponent(initialPlayerA)}`}
            className="text-sm text-[var(--pr-mc-link,#54b989)] hover:underline"
          >
            Back to profile
          </Link>
        ) : (
          <Link href="/players" className="text-sm text-[var(--pr-mc-link,#54b989)] hover:underline">
            Browse all players
          </Link>
        )}
      </div>

      {canCompare ? (
        <ComparePlayersResult slugA={sideA.playerSlug} slugB={sideB.playerSlug} />
      ) : null}
    </div>
  );
}
