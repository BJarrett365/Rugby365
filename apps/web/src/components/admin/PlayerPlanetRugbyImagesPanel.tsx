"use client";

import { useCallback, useEffect, useState } from "react";
import { PlayerImageMetadataEditor } from "@/components/admin/PlayerImageMetadataEditor";

type PlayerImageRow = {
  id: string;
  imageUrl: string;
  canonicalUrl: string | null;
  sourcePageUrl: string | null;
  sourceArticleTitle: string | null;
  caption: string | null;
  altText: string | null;
  credit: string | null;
  photographer?: string | null;
  licence?: string | null;
  focalX?: number | null;
  focalY?: number | null;
  isAiGenerated?: boolean;
  imageType: string;
  role: string;
  confidence: string;
  confidenceScore: number;
  status: string;
  isPublic: boolean;
  matchContext?: { reasons?: string[] } | null;
};

type FindResult = {
  images: PlayerImageRow[];
  warnings?: string[];
  searchedPages?: string[];
  hasApprovedPrimary?: boolean;
  skippedPrimaryReplaceBecauseApproved?: boolean;
  candidates?: Array<{
    imageUrl: string;
    match: { level: string; score: number; reasons: string[] };
    sourcePageUrl: string | null;
    sourceArticleTitle: string | null;
    altText: string | null;
    caption: string | null;
  }>;
};

function confidenceClass(level: string) {
  if (level === "high") return "text-emerald-400";
  if (level === "medium") return "text-amber-300";
  return "text-zinc-400";
}

export function PlayerPlanetRugbyImagesPanel({
  playerId,
  currentImageUrl,
  onPrimaryChanged,
}: {
  playerId: string;
  currentImageUrl?: string | null;
  onPrimaryChanged?: (imageUrl: string | null) => void;
}) {
  const [images, setImages] = useState<PlayerImageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/players/${playerId}/images`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load images");
      setImages(data.images ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load images");
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runFind(action: "find" | "refresh") {
    setSearching(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/players/${playerId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: "manual_refresh" }),
      });
      const data = (await res.json()) as FindResult & { error?: string };
      if (!res.ok) throw new Error(data.error || "Search failed");
      setImages(data.images ?? []);
      setWarnings(data.warnings ?? []);
      const found = data.candidates?.length ?? 0;
      setMessage(
        data.skippedPrimaryReplaceBecauseApproved
          ? `Found ${found} candidate(s). Approved primary image was not replaced.`
          : `Found ${found} Planet Rugby candidate(s). Low confidence is never auto-approved.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function runAction(
    imageId: string,
    action: string,
    role?: string,
  ) {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/players/${playerId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, imageId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      setImages(data.images ?? []);
      if (action === "set_primary" && data.player?.imageUrl) {
        onPrimaryChanged?.(data.player.imageUrl);
        setMessage("Primary profile image updated.");
      } else if (action === "reject" || action === "incorrect_player") {
        const created = data.learning?.created ?? 0;
        setMessage(
          created > 0
            ? `Match rejected — ${created} learning proposal(s) queued for review.`
            : "Match rejected — kept in history.",
        );
      } else {
        setMessage("Image updated.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  const visible = images.filter((img) => img.status !== "removed");

  return (
    <div className="cms-card mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold m-0">Planet Rugby images</h3>
          <p className="text-sm text-zinc-500 mt-1 mb-0">
            Search Planet Rugby articles and CDN images. Rights: Planet Sport / Planet Rugby media
            only. Low confidence matches are never auto-approved.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="cms-btn cms-btn--primary"
            disabled={searching}
            onClick={() => void runFind("find")}
          >
            {searching ? "Searching…" : "Find Planet Rugby Images"}
          </button>
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            disabled={searching}
            onClick={() => void runFind("refresh")}
          >
            Refresh search
          </button>
        </div>
      </div>

      {currentImageUrl ? (
        <div className="flex items-center gap-3 mb-4 p-3 rounded border border-white/10 bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentImageUrl}
            alt="Current primary"
            className="w-16 h-16 object-cover rounded"
          />
          <div className="text-sm text-zinc-300">
            <div className="font-medium text-zinc-100">Current primary image</div>
            <div className="text-zinc-500 break-all">{currentImageUrl}</div>
          </div>
        </div>
      ) : null}

      {loading ? <p className="text-sm text-zinc-500">Loading image history…</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-400/90">{message}</p> : null}
      {warnings.length ? (
        <ul className="text-sm text-amber-300/90 list-disc pl-5 mb-3">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      {!loading && visible.length === 0 ? (
        <p className="text-sm text-zinc-500 m-0">
          No Planet Rugby image candidates yet. Run Find Planet Rugby Images.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((img) => (
          <article
            key={img.id}
            className="rounded border border-white/10 overflow-hidden bg-black/10 flex flex-col"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.imageUrl}
              alt={img.altText || img.caption || "Planet Rugby image"}
              className="w-full aspect-video object-cover bg-zinc-900"
            />
            <div className="p-3 flex flex-col gap-2 flex-1 text-sm">
              <div className="flex flex-wrap gap-2 items-center">
                <span className={`font-medium uppercase text-xs ${confidenceClass(img.confidence)}`}>
                  {img.confidence} ({img.confidenceScore})
                </span>
                <span className="text-xs text-zinc-500">{img.status}</span>
                <span className="text-xs text-zinc-500">{img.role}</span>
                <span className="text-xs text-zinc-500">{img.imageType}</span>
              </div>
              {(img.altText || img.caption) && (
                <p className="m-0 text-zinc-300 line-clamp-3">{img.altText || img.caption}</p>
              )}
              {img.credit ? <p className="m-0 text-xs text-zinc-500">Credit: {img.credit}</p> : null}
              {img.sourceArticleTitle ? (
                <p className="m-0 text-xs text-zinc-400 line-clamp-2">{img.sourceArticleTitle}</p>
              ) : null}
              {img.sourcePageUrl ? (
                <a
                  href={img.sourcePageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sky-400 hover:underline break-all"
                >
                  Source article
                </a>
              ) : null}
              {img.matchContext?.reasons?.length ? (
                <p className="m-0 text-xs text-zinc-500">{img.matchContext.reasons.join(" · ")}</p>
              ) : null}
              <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                <button
                  type="button"
                  className="cms-btn cms-btn--primary text-xs px-2 py-1"
                  onClick={() => void runAction(img.id, "set_primary")}
                >
                  Set as primary
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary text-xs px-2 py-1"
                  onClick={() => void runAction(img.id, "add_gallery")}
                >
                  Add to gallery
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary text-xs px-2 py-1"
                  onClick={() => void runAction(img.id, "set_role", "current_club")}
                >
                  Club image
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary text-xs px-2 py-1"
                  onClick={() => void runAction(img.id, "set_role", "current_international")}
                >
                  International
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary text-xs px-2 py-1"
                  onClick={() => void runAction(img.id, "set_role", "career")}
                >
                  Career
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary text-xs px-2 py-1"
                  onClick={() => void runAction(img.id, "set_role", "legend")}
                >
                  Legend
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary text-xs px-2 py-1"
                  onClick={() => void runAction(img.id, "remove_public")}
                >
                  Remove from public
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary text-xs px-2 py-1"
                  onClick={() => void runAction(img.id, "reject")}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary text-xs px-2 py-1"
                  onClick={() => void runAction(img.id, "incorrect_player")}
                >
                  Incorrect player
                </button>
              </div>
              <PlayerImageMetadataEditor
                playerId={playerId}
                imageId={img.id}
                initial={img}
                onSaved={(next) => setImages(next as PlayerImageRow[])}
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
