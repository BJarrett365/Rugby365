"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ComparePlayersResult } from "@/components/players/ComparePlayersResult";
import { NATIONS_CHAMPIONSHIP_COMPETITION_SLUG } from "@/lib/nations-championship-hemisphere";
import { compareByPlayingPosition } from "@/lib/player-radar-positions";

type CompetitionOption = {
  id: string;
  slug: string;
  name: string;
};

type TeamOption = {
  id: string;
  name: string;
  slug: string;
  shortName: string | null;
};

type PlayerOption = {
  id: string;
  slug: string;
  name: string;
  position: string | null;
  teamId: string;
  teamName: string;
};

type SearchHit = {
  slug: string;
  name: string;
  position: string | null;
  clubName: string | null;
  teamId?: string | null;
};

type Side = "a" | "b";

type SideState = {
  competitionSlug: string;
  teamId: string;
  playerSlug: string;
  teams: TeamOption[];
  players: PlayerOption[];
  rosterLoading: boolean;
  rosterError: string | null;
  picked: SearchHit | null;
};

type Props = {
  /** Pre-select this competition on both sides (competition hub compare page). */
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

function emptySide(competitionSlug = ""): SideState {
  return {
    competitionSlug,
    teamId: "",
    playerSlug: "",
    teams: [],
    players: [],
    rosterLoading: false,
    rosterError: null,
    picked: null,
  };
}

function playerLabel(p: {
  name: string;
  position?: string | null;
  clubName?: string | null;
  teamName?: string | null;
}): string {
  const club = p.clubName?.trim() || p.teamName?.trim();
  const bits = [p.name];
  if (p.position?.trim()) bits.push(p.position.trim());
  if (club) bits.push(club);
  return bits.join(" · ");
}

function PlayerSearchField({
  competitionPlayers,
  otherSlug,
  onPick,
}: {
  competitionPlayers: PlayerOption[];
  otherSlug: string;
  onPick: (hit: SearchHit) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }

    const localHits: SearchHit[] = competitionPlayers
      .filter((p) => p.slug !== otherSlug && p.name.toLowerCase().includes(q))
      .slice(0, 12)
      .map((p) => ({
        slug: p.slug,
        name: p.name,
        position: p.position,
        clubName: p.teamName,
        teamId: p.teamId,
      }));

    if (localHits.length >= 6) {
      setHits(localHits);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/players/search?q=${encodeURIComponent(query.trim())}&pageSize=16`,
            { cache: "no-store" },
          );
          const json = (await res.json().catch(() => ({}))) as {
            rows?: Array<{
              slug: string;
              name: string;
              positionName: string | null;
              clubName: string | null;
            }>;
          };
          if (cancelled) return;
          const apiHits: SearchHit[] = (json.rows ?? [])
            .filter((r) => r.slug && r.slug !== otherSlug)
            .map((r) => ({
              slug: r.slug,
              name: r.name,
              position: r.positionName,
              clubName: r.clubName,
              teamId: null,
            }));

          const seen = new Set(localHits.map((h) => h.slug));
          const merged = [...localHits];
          for (const hit of apiHits) {
            if (seen.has(hit.slug)) continue;
            seen.add(hit.slug);
            merged.push(hit);
            if (merged.length >= 12) break;
          }
          setHits(merged);
        } catch {
          if (!cancelled) setHits(localHits);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, competitionPlayers, otherSlug]);

  return (
    <div ref={wrapRef} className="relative space-y-1.5">
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-[var(--pr-mc-muted)]">Or search by name</span>
        <input
          type="search"
          value={query}
          placeholder="Type at least 2 letters…"
          className="w-full rounded-lg border border-[var(--pr-mc-border)] bg-[var(--pr-mc-bg)] px-3 py-2 text-sm text-[var(--pr-mc-text)] placeholder:text-[var(--pr-mc-grey)]"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
      </label>
      {open && query.trim().length >= 2 ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-[var(--pr-mc-border)] bg-[var(--pr-mc-bg)] shadow-lg">
          {loading ? (
            <p className="m-0 px-3 py-2 text-sm text-[var(--pr-mc-muted)]">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="m-0 px-3 py-2 text-sm text-[var(--pr-mc-muted)]">No players found.</p>
          ) : (
            <ul className="m-0 list-none p-1">
              {hits.map((hit) => (
                <li key={hit.slug}>
                  <button
                    type="button"
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-[var(--pr-mc-text)] hover:bg-[var(--pr-mc-panel)]"
                    onClick={() => {
                      onPick(hit);
                      setQuery("");
                      setHits([]);
                      setOpen(false);
                    }}
                  >
                    {playerLabel(hit)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function useSideRoster(
  competitionSlug: string,
  setSide: (updater: (prev: SideState) => SideState) => void,
) {
  useEffect(() => {
    const slug = competitionSlug.trim();
    if (!slug) {
      setSide((prev) => ({
        ...prev,
        teams: [],
        players: [],
        teamId: "",
        playerSlug: "",
        picked: null,
        rosterLoading: false,
        rosterError: null,
      }));
      return;
    }

    let cancelled = false;
    setSide((prev) => ({
      ...prev,
      rosterLoading: true,
      rosterError: null,
      // Keep an already-hydrated pick (anchored compare / URL prefill) across roster reloads.
      teams: [],
      players: [],
    }));

    void (async () => {
      try {
        const res = await fetch(
          `/api/competitions/by-slug/${encodeURIComponent(slug)}/compare-roster`,
          { cache: "no-store" },
        );
        const json = (await res.json().catch(() => ({}))) as {
          teams?: TeamOption[];
          players?: PlayerOption[];
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "Failed to load teams");
        if (cancelled) return;
        setSide((prev) => ({
          ...prev,
          teams: json.teams ?? [],
          players: json.players ?? [],
          rosterLoading: false,
          rosterError: null,
        }));
      } catch (e) {
        if (cancelled) return;
        setSide((prev) => ({
          ...prev,
          teams: [],
          players: [],
          rosterLoading: false,
          rosterError: e instanceof Error ? e.message : "Failed to load teams",
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [competitionSlug, setSide]);
}

export function ComparePlayersPicker({
  competitionSlug,
  competitionName,
  initialPlayerA,
  initialPlayerB,
  anchoredMode = false,
  anchoredDisplayName = null,
}: Props) {
  const hubSlug = competitionSlug?.trim() ?? "";
  // Competition hub pages default to that competition; global menu defaults to Nations Championship.
  const defaultCompetitionSlug = hubSlug || NATIONS_CHAMPIONSHIP_COMPETITION_SLUG;

  const [competitions, setCompetitions] = useState<CompetitionOption[]>([]);
  const [competitionsLoading, setCompetitionsLoading] = useState(true);
  const [competitionsError, setCompetitionsError] = useState<string | null>(null);

  const [sideA, setSideA] = useState<SideState>(() => emptySide(defaultCompetitionSlug));
  const [sideB, setSideB] = useState<SideState>(() => emptySide(defaultCompetitionSlug));
  const [initialHydrated, setInitialHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setCompetitionsLoading(true);
    setCompetitionsError(null);
    void (async () => {
      try {
        const res = await fetch("/api/competitions/list", { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as {
          competitions?: CompetitionOption[];
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "Failed to load competitions");
        if (cancelled) return;
        const list = json.competitions ?? [];
        setCompetitions(list);

        const nations =
          list.find((c) => c.slug === NATIONS_CHAMPIONSHIP_COMPETITION_SLUG) ??
          list.find((c) => c.name.trim().toLowerCase() === "nations championship") ??
          list.find((c) => c.slug.includes("nations-championship"));

        const hubMatch =
          (hubSlug ? list.find((c) => c.slug === hubSlug) : undefined) ??
          (competitionName
            ? list.find((c) => c.name.trim().toLowerCase() === competitionName.trim().toLowerCase())
            : undefined) ??
          (hubSlug ? list.find((c) => c.slug.includes(hubSlug) || hubSlug.includes(c.slug)) : undefined);

        const resolvedDefault =
          (hubSlug ? hubMatch?.slug ?? hubSlug : null) ??
          nations?.slug ??
          NATIONS_CHAMPIONSHIP_COMPETITION_SLUG;

        // Resolve aliases / empty selection to the page default (hub competition or Nations Championship).
        // Do not override if the user already picked a different valid competition.
        const ensureDefault = (prev: SideState): SideState => {
          const current = prev.competitionSlug.trim();
          if (!current) return { ...prev, competitionSlug: resolvedDefault };
          if (current === hubSlug && hubMatch && hubMatch.slug !== current) {
            return { ...prev, competitionSlug: hubMatch.slug };
          }
          if (
            !hubSlug &&
            current === NATIONS_CHAMPIONSHIP_COMPETITION_SLUG &&
            nations &&
            nations.slug !== current
          ) {
            return { ...prev, competitionSlug: nations.slug };
          }
          if (list.some((c) => c.slug === current)) return prev;
          return { ...prev, competitionSlug: resolvedDefault };
        };
        setSideA(ensureDefault);
        setSideB(ensureDefault);
      } catch (e) {
        if (!cancelled) {
          setCompetitions([]);
          setCompetitionsError(e instanceof Error ? e.message : "Failed to load competitions");
        }
      } finally {
        if (!cancelled) setCompetitionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hubSlug, competitionName]);

  useSideRoster(sideA.competitionSlug, setSideA);
  useSideRoster(sideB.competitionSlug, setSideB);

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
        const json = (await res.json().catch(() => ({}))) as {
          rows?: Array<{
            slug: string;
            name: string;
            positionName: string | null;
            clubName: string | null;
          }>;
        };
        const hit = (json.rows ?? []).find((r) => r.slug === slug);
        if (!hit) {
          return {
            slug,
            name: slug
              .split("-")
              .filter((p) => !/^[a-z0-9]{6,}$/i.test(p))
              .join(" ")
              .replace(/\b\w/g, (c) => c.toUpperCase()) || slug,
            position: null,
            clubName: null,
          };
        }
        return {
          slug: hit.slug,
          name: hit.name,
          position: hit.positionName,
          clubName: hit.clubName,
        };
      }

      try {
        const [hitA, hitB] = await Promise.all([
          a ? resolveSlug(a) : Promise.resolve(null),
          b ? resolveSlug(b) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (hitA) {
          setSideA((prev) => ({
            ...prev,
            playerSlug: hitA.slug,
            picked: hitA,
          }));
        }
        if (hitB) {
          setSideB((prev) => ({
            ...prev,
            playerSlug: hitB.slug,
            picked: hitB,
          }));
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

  const setCompetition = (side: Side, slug: string) => {
    const apply = (prev: SideState): SideState => ({
      ...prev,
      competitionSlug: slug,
      teamId: "",
      playerSlug: "",
      picked: null,
      teams: [],
      players: [],
      rosterError: null,
    });
    if (side === "a") setSideA(apply);
    else setSideB(apply);
  };

  const setTeam = (side: Side, teamId: string) => {
    const apply = (prev: SideState): SideState => ({
      ...prev,
      teamId,
      playerSlug: "",
      picked: null,
    });
    if (side === "a") setSideA(apply);
    else setSideB(apply);
  };

  const pickFromSearch = (side: Side, hit: SearchHit) => {
    const state = side === "a" ? sideA : sideB;
    const local = state.players.find((p) => p.slug === hit.slug);
    const teamId = local?.teamId ?? hit.teamId ?? "";
    const picked: SearchHit = {
      slug: hit.slug,
      name: local?.name ?? hit.name,
      position: local?.position ?? hit.position,
      clubName: local?.teamName ?? hit.clubName,
      teamId: teamId || null,
    };
    const apply = (prev: SideState): SideState => ({
      ...prev,
      teamId,
      playerSlug: hit.slug,
      picked,
    });
    if (side === "a") setSideA(apply);
    else setSideB(apply);
  };

  const setPlayerSelect = (side: Side, slug: string) => {
    const state = side === "a" ? sideA : sideB;
    const local = state.players.find((p) => p.slug === slug);
    const apply = (prev: SideState): SideState => ({
      ...prev,
      playerSlug: slug,
      picked: local
        ? {
            slug: local.slug,
            name: local.name,
            position: local.position,
            clubName: local.teamName,
            teamId: local.teamId,
          }
        : null,
    });
    if (side === "a") setSideA(apply);
    else setSideB(apply);
  };

  const competitionOptions = useMemo(() => {
    const list = [...competitions];
    for (const slug of [sideA.competitionSlug, sideB.competitionSlug, hubSlug]) {
      if (!slug) continue;
      if (list.some((c) => c.slug === slug)) continue;
      list.push({
        id: slug,
        slug,
        name: competitionName && slug === hubSlug ? competitionName : slug,
      });
    }
    return list.sort((a, b) => {
      const rank = (c: CompetitionOption) => {
        if (hubSlug && (c.slug === hubSlug || c.name === competitionName)) return 0;
        if (
          c.slug === NATIONS_CHAMPIONSHIP_COMPETITION_SLUG ||
          c.name.trim().toLowerCase() === "nations championship"
        ) {
          return hubSlug ? 1 : 0;
        }
        return 2;
      };
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [competitions, sideA.competitionSlug, sideB.competitionSlug, hubSlug, competitionName]);

  const renderSide = (side: Side) => {
    const state = side === "a" ? sideA : sideB;
    const other = side === "a" ? sideB : sideA;
    const competitionReady = Boolean(state.competitionSlug.trim());
    const sidePlayers = state.teamId
      ? state.players
          .filter((p) => p.teamId === state.teamId)
          .slice()
          .sort(compareByPlayingPosition)
      : [];
    const selectedInList = sidePlayers.some((p) => p.slug === state.playerSlug);
    const showPickedOutsideList = Boolean(
      state.playerSlug && state.picked && !selectedInList,
    );

    const teamOptions = [...state.teams];
    if (
      state.teamId &&
      !teamOptions.some((t) => t.id === state.teamId) &&
      state.picked?.clubName
    ) {
      teamOptions.push({
        id: state.teamId,
        name: state.picked.clubName,
        slug: state.teamId,
        shortName: null,
      });
    }

    return (
      <div className="rounded-xl border border-[var(--pr-mc-border)] bg-[var(--pr-mc-panel)] p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pr-mc-grey)] m-0">
          {anchoredMode && side === "b" ? "Opponent" : `Player ${side.toUpperCase()}`}
        </p>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--pr-mc-muted)]">1. Competition</span>
          <select
            className="w-full rounded-lg border border-[var(--pr-mc-border)] bg-[var(--pr-mc-bg)] px-3 py-2 text-sm text-[var(--pr-mc-text)] disabled:opacity-50"
            value={state.competitionSlug}
            disabled={competitionsLoading || competitionOptions.length === 0}
            onChange={(e) => setCompetition(side, e.target.value)}
          >
            <option value="">
              {competitionsLoading
                ? "Loading competitions…"
                : competitionsError
                  ? "Failed to load competitions"
                  : "Select a competition"}
            </option>
            {competitionOptions.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {state.rosterLoading ? (
          <p className="m-0 text-xs text-[var(--pr-mc-muted)]">Loading teams & players…</p>
        ) : null}
        {state.rosterError ? (
          <p className="m-0 text-xs text-red-300">{state.rosterError}</p>
        ) : null}
        {competitionReady &&
        !state.rosterLoading &&
        !state.rosterError &&
        state.teams.length === 0 ? (
          <p className="m-0 text-xs text-[var(--pr-mc-muted)]">
            No teams found — try search or another competition.
          </p>
        ) : null}

        <PlayerSearchField
          competitionPlayers={state.players}
          otherSlug={other.playerSlug}
          onPick={(hit) => pickFromSearch(side, hit)}
        />

        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--pr-mc-grey)]">
          <span className="h-px flex-1 bg-[var(--pr-mc-border)]" />
          <span>or browse</span>
          <span className="h-px flex-1 bg-[var(--pr-mc-border)]" />
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--pr-mc-muted)]">2. Team</span>
          <select
            className="w-full rounded-lg border border-[var(--pr-mc-border)] bg-[var(--pr-mc-bg)] px-3 py-2 text-sm text-[var(--pr-mc-text)] disabled:opacity-50"
            value={state.teamId}
            disabled={!competitionReady || state.rosterLoading || teamOptions.length === 0}
            onChange={(e) => setTeam(side, e.target.value)}
          >
            <option value="">
              {!competitionReady
                ? "Select a competition first"
                : state.rosterLoading
                  ? "Loading teams…"
                  : teamOptions.length === 0
                    ? "No teams available"
                    : "Select a team"}
            </option>
            {teamOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-[var(--pr-mc-muted)]">3. Player</span>
          <select
            className="w-full rounded-lg border border-[var(--pr-mc-border)] bg-[var(--pr-mc-bg)] px-3 py-2 text-sm text-[var(--pr-mc-text)] disabled:opacity-50"
            value={
              selectedInList
                ? state.playerSlug
                : showPickedOutsideList && state.picked
                  ? state.picked.slug
                  : ""
            }
            disabled={
              !state.teamId || (sidePlayers.length === 0 && !showPickedOutsideList)
            }
            onChange={(e) => setPlayerSelect(side, e.target.value)}
          >
            <option value="">
              {!state.teamId
                ? "Select a team first"
                : sidePlayers.length === 0
                  ? "No players for this team"
                  : "Select a player"}
            </option>
            {showPickedOutsideList && state.picked ? (
              <option value={state.picked.slug}>{playerLabel(state.picked)}</option>
            ) : null}
            {sidePlayers.map((p) => (
              <option key={p.id} value={p.slug} disabled={p.slug === other.playerSlug}>
                {p.name}
                {p.position ? ` · ${p.position}` : ""}
              </option>
            ))}
          </select>
        </label>

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
      {competitionsError ? (
        <p className="m-0 text-sm text-red-300">{competitionsError}</p>
      ) : null}

      {anchoredMode ? (
        <p className="m-0 text-sm text-[var(--pr-mc-muted)]">
          Comparing against{" "}
          <strong className="text-[var(--pr-mc-text)]">
            {anchoredDisplayName || sideA.picked?.name || initialPlayerA}
          </strong>
          . Choose an opponent below.
        </p>
      ) : (
        <p className="m-0 text-sm text-[var(--pr-mc-muted)]">
          {hubSlug
            ? `Both sides start on ${competitionName || "this competition"} — you can switch either side to another competition.`
            : "Defaults to Nations Championship — pick players from the same league or different ones."}
        </p>
      )}

      {anchoredMode ? (
        <div className="grid gap-4 max-w-xl">
          {renderSide("b")}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {renderSide("a")}
          {renderSide("b")}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {canCompare ? (
          <Link
            href={`/players/${encodeURIComponent(sideA.playerSlug)}/compare/${encodeURIComponent(sideB.playerSlug)}`}
            className="cms-btn cms-btn--primary touch-target"
          >
            Open full compare
          </Link>
        ) : (
          <button type="button" className="cms-btn cms-btn--primary touch-target" disabled>
            {anchoredMode ? "Select an opponent" : "Select two players to compare"}
          </button>
        )}
        {sideA.playerSlug &&
        sideB.playerSlug &&
        sideA.playerSlug === sideB.playerSlug ? (
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
