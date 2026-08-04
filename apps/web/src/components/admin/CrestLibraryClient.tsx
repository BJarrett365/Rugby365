"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "@/styles/crest-library.css";

type Comp = { id: string; name: string; slug: string };
type Season = { id: string; label: string; year: number; isActive: boolean };
type Team = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
};

type StatusRow = {
  team: Team;
  crestId: string | null;
  status: string;
  displayImageUrl: string | null;
  colours: Array<{ name: string; hex: string }>;
  description: string | null;
  shirtsLinked: number;
};

type Summary = {
  teamCount: number;
  approved: number;
  awaitingReview: number;
  draft: number;
  notStarted: number;
  readinessPct: number;
};

function StatusPill({ status }: { status: string }) {
  const key = status.replace(/\s+/g, "_").toUpperCase();
  return <span className={`crest-lib__status-pill crest-lib__status-pill--${key}`}>{status}</span>;
}

export function CrestLibraryClient({
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
    initialCompetitionId ??
      competitions.find((c) => c.slug.includes("currie-cup"))?.id ??
      competitions[0]?.id ??
      "",
  );
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState(initialSeasonId ?? "");
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!competitionId) return;
    let cancelled = false;
    (async () => {
      setError(null);
      const res = await fetch(`/api/admin/crest-library/competitions/${competitionId}/seasons`);
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
      const res = await fetch(
        `/api/admin/crest-library/competition-status?competitionId=${competitionId}&seasonId=${seasonId}`,
      );
      const json = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error ?? "Failed to load crest status");
        return;
      }
      setRows(json.teams ?? []);
      setSummary(json.summary ?? null);
    })().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
    return () => {
      cancelled = true;
    };
  }, [competitionId, seasonId]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "missing") return rows.filter((r) => r.status === "NOT_STARTED");
    if (filter === "linked") return rows.filter((r) => r.shirtsLinked > 0);
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  function seedPack(
    action: "seed-currie-cup" | "seed-npc" | "seed-premiership",
    label: string,
  ) {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const res = await fetch("/api/admin/crest-library", {
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
        `Seeded ${label} — created ${json.created}, updated ${json.updated}, shirts linked ${json.shirtsLinked}.`,
      );
      if (json.competitionId) setCompetitionId(json.competitionId);
      if (json.seasonId) setSeasonId(json.seasonId);
      router.refresh();
      const cid = json.competitionId ?? competitionId;
      const sid = json.seasonId ?? seasonId;
      if (cid && sid) {
        const statusRes = await fetch(
          `/api/admin/crest-library/competition-status?competitionId=${cid}&seasonId=${sid}`,
        );
        const statusJson = await statusRes.json();
        if (statusRes.ok) {
          setRows(statusJson.teams ?? []);
          setSummary(statusJson.summary ?? null);
        }
      }
    });
  }

  return (
    <div className="crest-lib">
      <div className="crest-lib__finder">
        <label>
          Competition
          <select
            className="cms-select"
            value={competitionId}
            onChange={(e) => setCompetitionId(e.target.value)}
          >
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Season
          <select
            className="cms-select"
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
          >
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
                {s.isActive ? " (active)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="crest-lib__finder-actions">
          <button
            type="button"
            className="cms-btn"
            disabled={pending}
            onClick={() => seedPack("seed-currie-cup", "Currie Cup 2026")}
          >
            Seed Currie Cup 2026
          </button>
          <button
            type="button"
            className="cms-btn"
            disabled={pending}
            onClick={() => seedPack("seed-npc", "NZ NPC")}
          >
            Seed NZ NPC
          </button>
          <button
            type="button"
            className="cms-btn"
            disabled={pending}
            onClick={() => seedPack("seed-premiership", "Premiership")}
          >
            Seed Premiership
          </button>
        </div>
      </div>

      {error ? <p className="cms-error">{error}</p> : null}
      {message ? <p className="cms-success">{message}</p> : null}

      {summary ? (
        <p className="crest-lib__meta" style={{ marginTop: "1rem" }}>
          {summary.teamCount} teams · {summary.approved} approved · {summary.awaitingReview} in
          review · {summary.draft} draft · {summary.notStarted} not started · {summary.readinessPct}%
          ready
        </p>
      ) : null}

      <div className="crest-lib__finder-actions" style={{ marginTop: "0.75rem" }}>
        {(
          [
            ["all", "All"],
            ["APPROVED", "Approved"],
            ["DRAFT", "Draft"],
            ["AWAITING_REVIEW", "In review"],
            ["missing", "Not started"],
            ["linked", "Shirts linked"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`cms-btn ${filter === key ? "cms-btn--primary" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {!rows.length && !pending ? (
        <p className="crest-lib__empty">
          Pick a competition/season, or seed Currie Cup 2026 to create crest drafts with colours,
          descriptions, and shirt links.
        </p>
      ) : (
        <div className="crest-lib__grid">
          {filtered.map((row) => {
            const href = row.crestId
              ? `/admin/crest-library/${competitionId}/${seasonId}/${row.team.id}?crestId=${row.crestId}`
              : `/admin/crest-library/${competitionId}/${seasonId}/${row.team.id}`;
            return (
              <Link key={row.team.id} href={href} className="crest-lib__card">
                <div className="crest-lib__card-top">
                  <span className="crest-lib__badge">
                    {row.displayImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.displayImageUrl} alt="" />
                    ) : (
                      row.team.name.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <div>
                    <strong>{row.team.name}</strong>
                    <div style={{ marginTop: "0.35rem" }}>
                      <StatusPill status={row.status} />
                    </div>
                  </div>
                </div>
                {row.colours.length ? (
                  <div className="crest-lib__swatches">
                    {row.colours.map((c) => (
                      <span
                        key={`${c.name}-${c.hex}`}
                        className="crest-lib__swatch"
                        title={`${c.name} ${c.hex}`}
                        style={{ background: c.hex }}
                      />
                    ))}
                  </div>
                ) : null}
                {row.description ? (
                  <p className="crest-lib__meta">{row.description}</p>
                ) : (
                  <p className="crest-lib__meta">No crest description yet</p>
                )}
                <p className="crest-lib__meta">
                  {row.shirtsLinked > 0
                    ? `${row.shirtsLinked} shirt${row.shirtsLinked === 1 ? "" : "s"} linked`
                    : "No shirts linked"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
