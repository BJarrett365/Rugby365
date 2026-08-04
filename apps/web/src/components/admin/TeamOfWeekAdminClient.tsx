"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { TeamOfWeekView } from "@/components/competitions/TeamOfWeekView";
import type { TotwPublicView } from "@/lib/team-of-week-public";
import "@/styles/team-of-week.css";

type Comp = {
  id: string;
  name: string;
  slug: string;
  seasons: Array<{ id: string; label: string; year: number | null; isActive: boolean }>;
};

type RoundRow = {
  roundKey: string;
  roundName: string;
  roundNumber: number | null;
  fixtureCount: number;
  completedCount: number;
  ratedPlayerCount: number;
  squadPlayerCount: number;
  status: string;
  dateFrom: string | null;
  dateTo: string | null;
  editionId: string | null;
  editionStatus: string | null;
};

export function TeamOfWeekAdminClient({ competitions }: { competitions: Comp[] }) {
  const [competitionId, setCompetitionId] = useState(competitions[0]?.id ?? "");
  const competition = competitions.find((c) => c.id === competitionId) ?? competitions[0];
  const [seasonId, setSeasonId] = useState(competition?.seasons[0]?.id ?? "");
  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [roundKey, setRoundKey] = useState("");
  const [preview, setPreview] = useState<TotwPublicView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [publicPath, setPublicPath] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const next = competitions.find((c) => c.id === competitionId);
    const preferred =
      next?.seasons.find((s) => s.isActive)?.id ?? next?.seasons[0]?.id ?? "";
    setSeasonId(preferred);
  }, [competitionId, competitions]);

  useEffect(() => {
    if (!competitionId || !seasonId) return;
    let cancelled = false;
    (async () => {
      setError(null);
      setPreview(null);
      setPublicPath(null);
      const res = await fetch(
        `/api/admin/team-of-the-week?competitionId=${competitionId}&seasonId=${seasonId}`,
      );
      const json = await res.json();
      if (cancelled) return;
      if (!res.ok) {
        setError(json.error ?? "Failed to load rounds");
        return;
      }
      const list = (json.rounds ?? []) as RoundRow[];
      setRounds(list);
      setRoundKey(list[list.length - 1]?.roundKey ?? "");
    })().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
    return () => {
      cancelled = true;
    };
  }, [competitionId, seasonId]);

  // Load existing edition when round changes (so Publish works without regenerating).
  useEffect(() => {
    const editionId = rounds.find((r) => r.roundKey === roundKey)?.editionId;
    if (!editionId) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/team-of-the-week?editionId=${editionId}`);
      const json = await res.json();
      if (cancelled) return;
      if (res.ok && json.data) setPreview(json.data);
    })().catch(() => {
      /* keep previous preview */
    });
    return () => {
      cancelled = true;
    };
  }, [roundKey, rounds]);

  async function refreshRounds() {
    const r = await fetch(
      `/api/admin/team-of-the-week?competitionId=${competitionId}&seasonId=${seasonId}`,
    );
    const rj = await r.json();
    setRounds(rj.rounds ?? []);
  }

  function run(action: "generate" | "publish" | "unpublish") {
    startTransition(async () => {
      setError(null);
      setMessage(null);
      setPublicPath(null);
      try {
        if (action === "generate") {
          const res = await fetch("/api/admin/team-of-the-week", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              competitionId,
              seasonId,
              roundKey,
              forceProvisional: false,
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Generate failed");
          setPreview(json.data ?? null);
          setMessage(
            json.provisional
              ? `Generated provisional draft (${json.startingCount} starters). You can still publish if you are happy with it.`
              : `Generated draft with ${json.startingCount} starters. Review below, then publish.`,
          );
          await refreshRounds();
          return;
        }

        const editionId =
          preview?.edition.id ?? rounds.find((r) => r.roundKey === roundKey)?.editionId;
        if (!editionId) throw new Error("No edition to update — generate a draft first");

        if (action === "publish") {
          const provisional = preview?.edition.isProvisional ?? false;
          if (provisional) {
            const ok = window.confirm(
              "This round is still marked provisional (not all fixtures complete). Publish to the public site anyway?",
            );
            if (!ok) return;
          }
        }

        const res = await fetch("/api/admin/team-of-the-week", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            editionId,
            allowProvisional: true,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Action failed");

        if (action === "publish") {
          const path =
            typeof json.publicPath === "string"
              ? json.publicPath
              : competition?.slug
                ? `/competitions/${competition.slug}/team-of-the-week`
                : null;
          setPublicPath(path);
          setMessage(
            json.wasProvisional
              ? "Published to public (was provisional — now live and locked)."
              : "Published to public and locked.",
          );
        } else {
          setMessage("Unpublished — back under review. No longer visible on the public page.");
        }

        const bundle = await fetch(`/api/admin/team-of-the-week?editionId=${editionId}`);
        const bj = await bundle.json();
        if (bj.data) setPreview(bj.data);
        await refreshRounds();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed");
      }
    });
  }

  const selectedRound = rounds.find((r) => r.roundKey === roundKey);
  const hasEdition = Boolean(preview?.edition.id || selectedRound?.editionId);
  const isPublished = preview?.edition.status === "published";

  return (
    <div className="space-y-4">
      <section className="cms-card">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            Competition
            <select
              className="cms-input mt-1 w-full"
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
          <label className="block text-sm">
            Season
            <select
              className="cms-input mt-1 w-full"
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
            >
              {(competition?.seasons ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                  {s.isActive ? " (active)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Round
            <select
              className="cms-input mt-1 w-full"
              value={roundKey}
              onChange={(e) => setRoundKey(e.target.value)}
            >
              {rounds.map((r) => (
                <option key={r.roundKey} value={r.roundKey}>
                  {r.roundName} — {r.completedCount}/{r.fixtureCount} done ·{" "}
                  {r.ratedPlayerCount} ratings · {r.status}
                  {r.editionStatus ? ` · ${r.editionStatus}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedRound ? (
          <p className="text-sm text-[var(--pr-grey)] mt-3 mb-0">
            {selectedRound.fixtureCount} fixtures · {selectedRound.completedCount} complete ·{" "}
            {selectedRound.squadPlayerCount} squad players · {selectedRound.ratedPlayerCount}{" "}
            match ratings
            {selectedRound.editionStatus ? ` · edition: ${selectedRound.editionStatus}` : ""}
            {selectedRound.status === "awaiting_data" ? (
              <span className="block mt-1 text-amber-400">
                Fixtures are finished, but Planet Rugby has not provided line-ups/ratings for this
                round yet — Team of the Week cannot generate until ratings exist.
              </span>
            ) : null}
            {preview?.edition.isProvisional && !isPublished ? (
              <span className="block mt-1 text-amber-400">
                Provisional draft — round not fully complete. You can still publish if you are happy
                with the XV.
              </span>
            ) : null}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={pending || !roundKey || isPublished}
            onClick={() => run("generate")}
            title={isPublished ? "Unpublish before regenerating" : undefined}
          >
            {pending ? "Working…" : "Generate / regenerate draft"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={pending || !hasEdition || isPublished}
            onClick={() => run("publish")}
          >
            {isPublished ? "Published" : "Publish to public"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            disabled={pending || !hasEdition || !isPublished}
            onClick={() => run("unpublish")}
          >
            Unpublish
          </button>
          {competition?.slug ? (
            <Link
              href={`/competitions/${competition.slug}/team-of-the-week`}
              className="cms-btn cms-btn--secondary"
              target="_blank"
            >
              Open public page
            </Link>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-400 mt-3 mb-0">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--pr-gold)] mt-3 mb-0">{message}</p> : null}
        {publicPath ? (
          <p className="text-sm mt-2 mb-0">
            Live at{" "}
            <Link href={publicPath} className="text-[var(--pr-gold)] underline" target="_blank">
              {publicPath}
            </Link>
          </p>
        ) : null}
      </section>

      {preview ? <TeamOfWeekView data={preview} /> : null}
    </div>
  );
}
