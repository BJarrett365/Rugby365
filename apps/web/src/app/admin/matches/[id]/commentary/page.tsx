"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { MatchCmsFeatureShell } from "@/components/admin/MatchCmsFeatureShell";

type CommentaryLine = {
  id?: string;
  minute: number;
  second?: number;
  body: string;
  outputType?: string;
  source?: string;
  facts?: { segment?: string } | null;
};

type AudioScript = {
  id: string;
  commentaryId: string | null;
  minute: number;
  second: number;
  combinationType: string;
  priority: number;
  leadScript: string;
  analystScript: string;
  status: string;
  sourceBody: string | null;
};

function formatCommentaryClock(minute: number, second?: number | null): string {
  const m = Math.max(0, Math.floor(minute));
  const s = Math.max(0, Math.min(59, Math.floor(second ?? 0)));
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function MatchCommentaryBridgePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [slug, setSlug] = useState<string | null>(null);
  const [lines, setLines] = useState<CommentaryLine[]>([]);
  const [audioScripts, setAudioScripts] = useState<AudioScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [audioExpanded, setAudioExpanded] = useState(false);
  const [showInlineAudio, setShowInlineAudio] = useState(false);

  const scriptsByCommentaryId = useMemo(() => {
    const map = new Map<string, AudioScript>();
    for (const script of audioScripts) {
      if (script.commentaryId) map.set(script.commentaryId, script);
    }
    return map;
  }, [audioScripts]);

  const scriptsByClock = useMemo(() => {
    const map = new Map<string, AudioScript>();
    for (const script of audioScripts) {
      const key = `${script.minute}:${script.second}`;
      if (!map.has(key)) map.set(key, script);
    }
    return map;
  }, [audioScripts]);

  function scriptForLine(line: CommentaryLine): AudioScript | undefined {
    if (line.id && scriptsByCommentaryId.has(line.id)) {
      return scriptsByCommentaryId.get(line.id);
    }
    return scriptsByClock.get(`${line.minute}:${line.second ?? 0}`);
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fixtureRes, commentaryRes] = await Promise.all([
        fetch(`/api/admin/matches/${id}`),
        fetch(`/api/admin/matches/${id}/commentary/generate`),
      ]);
      const fixtureData = (await fixtureRes.json()) as { fixture?: { slug?: string } };
      const commentaryData = (await commentaryRes.json()) as {
        lines?: CommentaryLine[];
        audioScripts?: AudioScript[];
        error?: string;
      };
      if (fixtureRes.ok && fixtureData.fixture?.slug) {
        setSlug(String(fixtureData.fixture.slug));
      }
      if (!commentaryRes.ok) {
        throw new Error(commentaryData.error || "Failed to load commentary");
      }
      setLines(commentaryData.lines ?? []);
      setAudioScripts(commentaryData.audioScripts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load commentary");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setGenerating(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/admin/matches/${id}/commentary/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ replace: true, generateAudioScripts: true }),
      });
      const data = (await res.json()) as {
        created?: number;
        audioScriptsCreated?: number;
        lines?: CommentaryLine[];
        audioScripts?: AudioScript[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setLines(data.lines ?? []);
      setAudioScripts(data.audioScripts ?? []);
      setStatus(
        `Generated ${data.created ?? 0} written lines and ${data.audioScriptsCreated ?? 0} Lead/Analyst audio scripts.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <MatchCmsFeatureShell
      matchId={id}
      title="Live Commentary"
      description="Commentary Intelligence Engine on screen; Live Audio Commentary as a separate Lead + Analyst broadcast rewrite (never TTS of prose)."
      actions={
        <button
          type="button"
          className="cms-btn cms-btn--primary"
          disabled={generating}
          onClick={() => void generate()}
        >
          {generating ? "Generating…" : "Generate from match data"}
        </button>
      }
    >
      <div className="cms-card text-sm text-zinc-300 space-y-4">
        <p className="m-0 text-zinc-400">
          Pre-match: welcome, weather, table race, Betting Intelligence, head to heads, lineups. In-play:
          live events plus multi-layer journalist insights. Audio drafts rewrite each line for dual
          SA-English Currie Cup commentators. See{" "}
          <Link href="/admin/knowledge/commentary-rules" className="text-[var(--pr-gold)] hover:underline">
            Commentary Rules
          </Link>{" "}
          and{" "}
          <Link
            href="/admin/knowledge/audio-commentary-rules"
            className="text-[var(--pr-gold)] hover:underline"
          >
            Audio Commentary Rules
          </Link>
          .
        </p>

        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/matches/${id}/audio`} className="cms-btn cms-btn--secondary">
            Audio control room
          </Link>
          <Link href="/admin/keys#elevenlabs" className="cms-btn cms-btn--secondary">
            ElevenLabs keys
          </Link>
          <Link href="/admin/operator" className="cms-btn cms-btn--secondary">
            Operator console
          </Link>
          <Link href={`/admin/matches/${id}/events`} className="cms-btn cms-btn--secondary">
            Match events
          </Link>
          {slug ? (
            <Link
              href={`/matches/${slug}/commentary`}
              className="cms-btn cms-btn--secondary"
              target="_blank"
              rel="noreferrer"
            >
              Public commentary
            </Link>
          ) : null}
        </div>

        {!loading ? (
          <div className="rounded-md border border-[var(--pr-gold)]/40 bg-zinc-950/80 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="m-0 text-xs font-semibold uppercase tracking-wide text-[var(--pr-gold)]">
                  Live Audio drafts
                </p>
                <p className="mt-1 mb-0 text-zinc-200">
                  {audioScripts.length > 0
                    ? `${audioScripts.length} audio scripts ready`
                    : lines.length > 0
                      ? "No audio scripts yet — regenerate to produce Lead/Analyst drafts"
                      : "Generate commentary to create Lead/Analyst audio scripts"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {audioScripts.length > 0 ? (
                  <button
                    type="button"
                    className="cms-btn cms-btn--secondary"
                    onClick={() => setAudioExpanded((v) => !v)}
                  >
                    {audioExpanded ? "Hide scripts" : "Expand scripts"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="cms-btn cms-btn--secondary"
                  onClick={() => setShowInlineAudio((v) => !v)}
                >
                  {showInlineAudio ? "Hide under lines" : "Show under lines"}
                </button>
              </div>
            </div>

            {audioExpanded && audioScripts.length > 0 ? (
              <ol className="mt-3 mb-0 list-none space-y-2 p-0 max-h-[28rem] overflow-y-auto">
                {audioScripts.map((audio) => (
                  <li
                    key={audio.id}
                    className="rounded border border-zinc-800 bg-zinc-900/70 px-2.5 py-2"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-500">
                      <span className="font-medium text-amber-400/90">
                        {formatCommentaryClock(audio.minute, audio.second)}
                      </span>
                      <span>{audio.combinationType.replace(/_/g, " ")}</span>
                      <span>priority {audio.priority}</span>
                      <span>{audio.status}</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded border border-emerald-900/50 bg-emerald-950/20 px-2.5 py-2">
                        <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-400/90">
                          Lead
                        </p>
                        <p className="m-0 leading-relaxed text-zinc-200">{audio.leadScript}</p>
                      </div>
                      <div className="rounded border border-sky-900/50 bg-sky-950/20 px-2.5 py-2">
                        <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wide text-sky-400/90">
                          Analyst
                        </p>
                        <p className="m-0 leading-relaxed text-zinc-200">{audio.analystScript}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}

        {status ? <p className="m-0 text-emerald-400">{status}</p> : null}
        {error ? <p className="m-0 text-red-400">{error}</p> : null}
        {loading ? <p className="m-0 text-zinc-500">Loading commentary…</p> : null}

        {!loading && lines.length === 0 ? (
          <p className="m-0 text-zinc-500">
            No commentary yet. Click <strong>Generate from match data</strong> to build the script.
          </p>
        ) : null}

        {lines.length > 0 ? (
          <ol className="m-0 list-none space-y-3 p-0">
            {lines.map((line, index) => {
              const audio = scriptForLine(line);
              return (
                <li
                  key={line.id ?? `${line.minute}-${index}`}
                  className="rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span className="font-medium text-amber-400/90">
                      {formatCommentaryClock(line.minute, line.second)}
                    </span>
                    {line.facts?.segment ? (
                      <span className="uppercase tracking-wide">
                        {line.facts.segment.replace(/_/g, " ")}
                      </span>
                    ) : null}
                    {line.source ? <span>{line.source}</span> : null}
                    {audio ? (
                      <span className="rounded bg-emerald-950/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
                        Audio
                      </span>
                    ) : null}
                  </div>
                  <p className="m-0 leading-relaxed text-zinc-200">{line.body}</p>

                  {showInlineAudio && audio ? (
                    <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-500">
                        <span className="text-[var(--pr-gold)]">Audio draft</span>
                        <span>{audio.combinationType.replace(/_/g, " ")}</span>
                        <span>priority {audio.priority}</span>
                        <span>{audio.status}</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded border border-emerald-900/50 bg-emerald-950/20 px-2.5 py-2">
                          <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-400/90">
                            Lead
                          </p>
                          <p className="m-0 leading-relaxed text-zinc-200">{audio.leadScript}</p>
                        </div>
                        <div className="rounded border border-sky-900/50 bg-sky-950/20 px-2.5 py-2">
                          <p className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-wide text-sky-400/90">
                            Analyst
                          </p>
                          <p className="m-0 leading-relaxed text-zinc-200">{audio.analystScript}</p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}
      </div>
    </MatchCmsFeatureShell>
  );
}
