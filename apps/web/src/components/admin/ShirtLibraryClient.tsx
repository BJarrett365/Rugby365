"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "@/styles/shirt-library.css";

type Comp = { id: string; name: string; slug: string };
type Season = { id: string; label: string; year: number; isActive: boolean; slug?: string };
type Team = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  countryName: string | null;
};

type StatusRow = {
  team: Team;
  home: string;
  away: string;
  third: string;
  overall: string;
};

type Summary = {
  teamCount: number;
  fullyApproved: number;
  partlyApproved: number;
  notStarted: number;
  homeApproved: number;
  awayApproved: number;
  awaitingReview: number;
  readinessPct: number;
};

function StatusPill({ status }: { status: string }) {
  const key = status.replace(/\s+/g, "_").toUpperCase();
  return <span className={`shirt-lib__status-pill shirt-lib__status-pill--${key}`}>{status}</span>;
}

const SEED_PACKS = [
  { action: "seed-nations", label: "Nations Championship" },
  { action: "seed-autumn-nations", label: "Autumn Nations" },
  { action: "seed-premiership", label: "Premiership" },
  { action: "seed-champions-cup", label: "Champions Cup" },
  { action: "seed-currie-cup", label: "Currie Cup 2026 (drafts)" },
  { action: "update-currie-cup", label: "Update + approve Currie Cup (current season)" },
  { action: "seed-npc", label: "NZ NPC (Hilux NPC)" },
  { action: "seed-urc", label: "United Rugby Championship (SA)" },
  { action: "seed-sa-provincial", label: "SA Provincial (legacy guide)" },
  { action: "seed-super-rugby", label: "Super Rugby Pacific" },
  { action: "seed-top14", label: "Top 14" },
  { action: "seed-mlr", label: "Major League Rugby" },
  { action: "seed-serie-a-elite", label: "Serie A Elite" },
  { action: "seed-scottish-premiership", label: "Scottish Premiership" },
  { action: "seed-super-rygbi-cymru", label: "Super Rygbi Cymru" },
  { action: "seed-all-ireland-league", label: "All-Ireland League" },
] as const;

type SeedAction = (typeof SEED_PACKS)[number]["action"];

export function ShirtLibraryClient({
  competitions,
  initialCompetitionId,
  initialSeasonId,
}: {
  competitions: Comp[];
  initialCompetitionId?: string;
  initialSeasonId?: string;
}) {
  const router = useRouter();
  const [competitionId, setCompetitionId] = useState(
    initialCompetitionId ?? competitions[0]?.id ?? "",
  );
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState(initialSeasonId ?? "");
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState("");
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pageStatus, setPageStatus] = useState<string>("DRAFT");
  const [seedAction, setSeedAction] = useState<SeedAction>("seed-nations");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!competitionId) return;
    let cancelled = false;
    (async () => {
      setError(null);
      const res = await fetch(`/api/admin/shirt-library/competitions/${competitionId}/seasons`);
      const json = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error ?? "Failed to load seasons");
        return;
      }
      const list = (json.seasons ?? []) as Season[];
      setSeasons(list);
      const preferred =
        initialSeasonId && list.some((s) => s.id === initialSeasonId)
          ? initialSeasonId
          : (list.find((s) => s.isActive)?.id ?? list[0]?.id ?? "");
      setSeasonId(preferred);
    })().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
    return () => {
      cancelled = true;
    };
  }, [competitionId, initialSeasonId]);

  useEffect(() => {
    if (!competitionId || !seasonId) return;
    let cancelled = false;
    (async () => {
      setError(null);
      const [teamsRes, statusRes, pageRes] = await Promise.all([
        fetch(
          `/api/admin/shirt-library/competitions/${competitionId}/seasons/${seasonId}/teams`,
        ),
        fetch(
          `/api/admin/shirt-library/competition-status?competitionId=${competitionId}&seasonId=${seasonId}`,
        ),
        fetch(
          `/api/admin/shirt-library/pages?competitionId=${competitionId}&seasonId=${seasonId}`,
        ),
      ]);
      const teamsJson = await teamsRes.json();
      const statusJson = await statusRes.json();
      const pageJson = await pageRes.json();
      if (cancelled) return;
      if (!teamsRes.ok) {
        setError(teamsJson.error ?? "Failed to load teams");
        return;
      }
      setTeams(teamsJson.teams ?? []);
      if (statusRes.ok) {
        setRows(statusJson.teams ?? []);
        setSummary(statusJson.summary ?? null);
      }
      if (pageRes.ok && pageJson.page?.status) {
        setPageStatus(pageJson.page.status);
      }
    })().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
    return () => {
      cancelled = true;
    };
  }, [competitionId, seasonId]);

  const competition = competitions.find((c) => c.id === competitionId);
  const season = seasons.find((s) => s.id === seasonId);
  const publicSeasonSlug = season?.slug || season?.label || "";
  const publicHref =
    competition && publicSeasonSlug
      ? `/shirt-library/${competition.slug}/${publicSeasonSlug}`
      : null;

  function pageAction(action: "sync" | "set-status", status?: string) {
    if (!competitionId || !seasonId) return;
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const res = await fetch("/api/admin/shirt-library/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          competitionId,
          seasonId,
          status,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setError(json.error ?? "Page action failed");
        return;
      }
      if (json.page?.status) setPageStatus(json.page.status);
      setMessage(
        action === "set-status"
          ? `Public page status: ${json.page?.status}`
          : `Synced ${json.synced ?? 0} teams to the public page snapshot.`,
      );
    });
  }

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "all") return true;
      if (filter === "fully") return r.overall === "Fully Approved";
      if (filter === "awaiting")
        return r.home === "AWAITING_REVIEW" || r.away === "AWAITING_REVIEW";
      if (filter === "changes") return r.overall === "Needs Changes";
      if (filter === "missing")
        return r.home === "NOT_CREATED" || r.away === "NOT_CREATED";
      return true;
    });
  }, [rows, filter]);

  function viewTeam(id?: string) {
    const tid = id ?? teamId;
    if (!competitionId || !seasonId || !tid) return;
    router.push(`/admin/shirt-library/${competitionId}/${seasonId}/${tid}`);
  }

  function seedGuide(action: SeedAction, label: string) {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const res = await fetch("/api/admin/shirt-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setError(json.error ?? "Seed failed");
        return;
      }
      setMessage(
        `Created ${json.created ?? 0} draft shirt(s)${
          json.updated ? `, updated ${json.updated}` : ""
        } for ${label}.${
          json.matched?.length ? ` Teams: ${json.matched.join(", ")}.` : ""
        }${json.missing?.length ? ` Missing: ${json.missing.join(", ")}.` : ""}`,
      );
      if (json.competitionId) setCompetitionId(json.competitionId);
      if (json.seasonId) setSeasonId(json.seasonId);
      if (json.competitionId && json.seasonId) {
        const statusRes = await fetch(
          `/api/admin/shirt-library/competition-status?competitionId=${json.competitionId}&seasonId=${json.seasonId}`,
        );
        const statusJson = await statusRes.json();
        if (statusRes.ok) {
          setRows(statusJson.teams ?? []);
          setSummary(statusJson.summary ?? null);
        }
      }
    });
  }

  const selectedSeed = SEED_PACKS.find((p) => p.action === seedAction) ?? SEED_PACKS[0]!;
  const showDashboard = Boolean(competition && season);

  return (
    <div className="shirt-lib space-y-4">
      <p className="text-sm text-[var(--pr-grey)] mb-0">
        Kits are linked to CMS teams. Manage official / replica crests in the{" "}
        <Link href="/admin/crest-library">Crest Library</Link>.
      </p>
      <section className="cms-card">
        <h2 className="text-base font-semibold mt-0 mb-1">Shirt Finder</h2>
        <p className="text-sm text-[var(--pr-grey)] mt-0 mb-3">
          Choose a competition and season to review kit readiness, or open one team’s shirts.
        </p>
        <div className="shirt-lib__finder">
          <label className="block text-sm">
            Competition
            <select
              className="cms-input mt-1 w-full"
              value={competitionId}
              onChange={(e) => {
                setCompetitionId(e.target.value);
                setTeamId("");
              }}
            >
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Season
            <select
              className="cms-input mt-1 w-full"
              value={seasonId}
              onChange={(e) => {
                setSeasonId(e.target.value);
                setTeamId("");
              }}
              disabled={!seasons.length}
            >
              {!seasons.length ? <option value="">No seasons</option> : null}
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.isActive ? " (active)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Team
            <select
              className="cms-input mt-1 w-full"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              disabled={!teams.length}
            >
              <option value="">All teams (dashboard)</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <div className="shirt-lib__finder-actions">
            <button
              type="button"
              className="cms-btn cms-btn--primary touch-target"
              disabled={!competitionId || !seasonId}
              onClick={() => {
                if (teamId) viewTeam();
                else if (competitionId && seasonId) {
                  router.push(`/admin/shirt-library/${competitionId}/${seasonId}`);
                }
              }}
            >
              {teamId ? "Open team" : "View dashboard"}
            </button>
          </div>
        </div>
        {error ? <p className="text-sm text-red-400 mt-3 mb-0">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--pr-gold)] mt-3 mb-0">{message}</p> : null}
      </section>

      <details className="cms-card">
        <summary className="text-sm font-semibold cursor-pointer select-none">
          Seed draft shirts
          <span className="font-normal text-[var(--pr-grey)] ml-2">
            one-time packs for competitions without kits yet
          </span>
        </summary>
        <p className="text-sm text-[var(--pr-grey)] mt-3 mb-3">
          Creates draft home/away shirts for the selected pack, then jumps the finder to that
          competition.
        </p>
        <div className="shirt-lib__seed">
          <label className="block text-sm">
            Competition pack
            <select
              className="cms-input mt-1 w-full"
              value={seedAction}
              onChange={(e) => setSeedAction(e.target.value as SeedAction)}
              disabled={pending}
            >
              {SEED_PACKS.map((pack) => (
                <option key={pack.action} value={pack.action}>
                  {pack.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="cms-btn cms-btn--secondary touch-target"
            disabled={pending}
            onClick={() => seedGuide(selectedSeed.action, selectedSeed.label)}
          >
            {pending ? "Seeding…" : `Seed ${selectedSeed.label}`}
          </button>
        </div>
      </details>

      {showDashboard && summary ? (
        <section className="cms-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold mt-0 mb-1">
                {competition!.name} · {season!.label}
              </h2>
              <p className="text-sm text-[var(--pr-grey)] mb-0">
                Competition Shirt Readiness: {summary.readinessPct}% — only approved shirts can
                appear on public pitch overlays.
              </p>
            </div>
            {summary.awaitingReview > 0 ? (
              <Link
                href={`/admin/shirt-library/${competitionId}/${seasonId}?review=1`}
                className="cms-btn cms-btn--secondary"
              >
                Review next ({summary.awaitingReview})
              </Link>
            ) : null}
          </div>

          <div className="shirt-lib__progress">
            <div className="shirt-lib__progress-item">
              <strong>
                {summary.fullyApproved}/{summary.teamCount}
              </strong>
              Teams fully approved
            </div>
            <div className="shirt-lib__progress-item">
              <strong>
                {summary.homeApproved}/{summary.teamCount}
              </strong>
              Home shirts approved
            </div>
            <div className="shirt-lib__progress-item">
              <strong>
                {summary.awayApproved}/{summary.teamCount}
              </strong>
              Away shirts approved
            </div>
            <div className="shirt-lib__progress-item">
              <strong>{summary.awaitingReview}</strong>
              Awaiting review
            </div>
          </div>

          <div className="mt-4 mb-4 rounded-lg border border-[var(--pr-border)] bg-black/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold mt-0 mb-1">Public competition page</h3>
                <p className="text-sm text-[var(--pr-grey)] mb-0">
                  Status: <strong className="text-white">{pageStatus}</strong>
                  {publicHref ? (
                    <>
                      {" "}
                      ·{" "}
                      <code className="text-xs text-[var(--pr-gold)]">{publicHref}</code>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            {summary.teamCount - summary.awayApproved > 0 ? (
              <p className="text-sm text-amber-300 mb-3">
                {summary.teamCount - summary.awayApproved} team
                {summary.teamCount - summary.awayApproved === 1 ? "" : "s"} do not yet have
                approved away shirts. You can still publish with a warning.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {publicHref ? (
                <a
                  href={`${publicHref}?preview=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="cms-btn cms-btn--secondary"
                >
                  Preview Public Page
                </a>
              ) : null}
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={pending}
                onClick={() => pageAction("sync")}
              >
                Refresh Competition Data
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={pending}
                onClick={() => pageAction("set-status", "READY_FOR_REVIEW")}
              >
                Ready for Review
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--primary"
                disabled={pending}
                onClick={() => pageAction("set-status", "PUBLISHED")}
              >
                Publish Season Page
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={pending || pageStatus === "DRAFT"}
                onClick={() => pageAction("set-status", "DRAFT")}
              >
                Unpublish Season Page
              </button>
              {summary.awaitingReview > 0 ||
              summary.teamCount - summary.homeApproved > 0 ||
              summary.teamCount - summary.awayApproved > 0 ? (
                <Link
                  href={`/admin/shirt-library/${competitionId}/${seasonId}?review=1`}
                  className="cms-btn cms-btn--secondary"
                >
                  Review Missing Shirts
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            {[
              ["all", "All Teams"],
              ["fully", "Fully Approved"],
              ["awaiting", "Awaiting Review"],
              ["changes", "Needs Changes"],
              ["missing", "Missing Shirts"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`cms-btn ${filter === id ? "cms-btn--primary" : "cms-btn--secondary"}`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="shirt-lib__team-grid">
            <div
              className="shirt-lib__team-row"
              style={{ opacity: 0.7, pointerEvents: "none", fontSize: "0.75rem" }}
            >
              <span>Team</span>
              <span>Home</span>
              <span>Away</span>
              <span>Third</span>
              <span>Overall</span>
            </div>
            {filtered.map((r) => (
              <Link
                key={r.team.id}
                href={`/admin/shirt-library/${competitionId}/${seasonId}/${r.team.id}`}
                className="shirt-lib__team-row"
              >
                <span className="font-medium">{r.team.name}</span>
                <StatusPill status={r.home === "NOT_CREATED" ? "Not Created" : r.home} />
                <StatusPill status={r.away === "NOT_CREATED" ? "Not Created" : r.away} />
                <StatusPill status={r.third === "NOT_CREATED" ? "Not Created" : r.third} />
                <StatusPill status={r.overall} />
              </Link>
            ))}
            {!filtered.length ? (
              <p className="shirt-lib__empty mb-0">
                No teams match this filter. Try another filter, pick a season with squads, or seed
                draft shirts for this competition.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {showDashboard && !summary ? (
        <section className="cms-card">
          <h2 className="text-base font-semibold mt-0 mb-1">
            {competition!.name}
            {season ? ` · ${season.label}` : ""}
          </h2>
          <p className="shirt-lib__empty mb-0">
            {teams.length
              ? "Loading shirt readiness…"
              : "No teams found for this competition/season yet. Seed draft shirts below, or choose a season that already has fixtures or standings."}
          </p>
        </section>
      ) : null}
    </div>
  );
}
