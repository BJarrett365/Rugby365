"use client";

import { useEffect, useState } from "react";
import { extractYoutubeVideoId, youtubeEmbedSrc, youtubeWatchUrl } from "@/lib/youtube-embed";

type Props = {
  fixtureId: string;
  initialWatchalongUrl: string | null;
  initialHighlightsUrl: string | null;
  onSaved?: () => void;
};

type MediaKind = "watchalong" | "highlights";

/** Two independent CMS fields — Watchalong and Match Highlights never overwrite each other. */
export function MatchYoutubeMediaPanel({
  fixtureId,
  initialWatchalongUrl,
  initialHighlightsUrl,
  onSaved,
}: Props) {
  return (
    <div className="space-y-5 text-sm">
      <p className="m-0 text-zinc-400">
        Add <strong>Watchalong</strong> and <strong>Match Highlights</strong> separately. Paste a
        YouTube watch URL, embed URL, video id, or full iframe HTML. Each tab only appears on the
        public match page when that field is filled.
      </p>

      <YoutubeMediaEditor
        fixtureId={fixtureId}
        kind="watchalong"
        label="Watchalong"
        hint="Live or full-match watchalong stream (public Watchalong tab)"
        initialUrl={initialWatchalongUrl}
        onSaved={onSaved}
      />

      <YoutubeMediaEditor
        fixtureId={fixtureId}
        kind="highlights"
        label="Match Highlights"
        hint="Post-match highlights package (public Highlights tab)"
        initialUrl={initialHighlightsUrl}
        onSaved={onSaved}
      />
    </div>
  );
}

function YoutubeMediaEditor({
  fixtureId,
  kind,
  label,
  hint,
  initialUrl,
  onSaved,
}: {
  fixtureId: string;
  kind: MediaKind;
  label: string;
  hint: string;
  initialUrl: string | null;
  onSaved?: () => void;
}) {
  const [value, setValue] = useState(initialUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setValue(initialUrl ?? "");
  }, [initialUrl]);

  const videoId = extractYoutubeVideoId(value);
  const preview = youtubeEmbedSrc(value);
  const watchHref = youtubeWatchUrl(value);
  const fieldKey = kind === "watchalong" ? "watchalongYoutubeUrl" : "highlightsYoutubeUrl";

  async function persist(next: string | null, mode: "save" | "clear") {
    if (mode === "save") setSaving(true);
    else setClearing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/matches/${fixtureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only patch this field — the other YouTube URL is left untouched.
          [fieldKey]: next,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setMessage(body.error ?? `Could not ${mode} ${label.toLowerCase()}.`);
        return;
      }
      if (next == null) setValue("");
      else if (videoId) setValue(`https://www.youtube.com/watch?v=${videoId}`);
      setMessage(mode === "clear" ? `${label} cleared.` : `${label} saved.`);
      onSaved?.();
    } finally {
      setSaving(false);
      setClearing(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-zinc-700/80 bg-zinc-900/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={`yt-${kind}`} className="block font-medium text-zinc-200">
          {label}
        </label>
        {videoId ? (
          <span className="rounded bg-emerald-900/50 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-emerald-300">
            Ready
          </span>
        ) : (
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-zinc-500">
            Empty
          </span>
        )}
      </div>
      <p className="m-0 text-xs text-zinc-500">{hint}</p>
      <textarea
        id={`yt-${kind}`}
        rows={3}
        className="cms-input w-full font-mono text-xs"
        placeholder='https://www.youtube.com/watch?v=… or <iframe src="https://www.youtube.com/embed/…"…'
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {value.trim() && !videoId ? (
        <p className="m-0 text-xs text-amber-300">
          Could not parse a YouTube video id from this input.
        </p>
      ) : null}
      {preview ? (
        <div className="overflow-hidden rounded border border-zinc-700 bg-black/40">
          <iframe
            title={`${label} preview`}
            src={preview}
            className="aspect-video w-full max-w-xl border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="cms-btn cms-btn--primary"
          disabled={saving || clearing || !videoId}
          onClick={() => void persist(watchHref ?? (value.trim() || null), "save")}
        >
          {saving ? "Saving…" : `Save ${label}`}
        </button>
        <button
          type="button"
          className="cms-btn"
          disabled={saving || clearing || (!value.trim() && !initialUrl)}
          onClick={() => void persist(null, "clear")}
        >
          {clearing ? "Clearing…" : "Clear"}
        </button>
        {message ? (
          <span className="text-zinc-400" role="status">
            {message}
          </span>
        ) : null}
      </div>
    </div>
  );
}
