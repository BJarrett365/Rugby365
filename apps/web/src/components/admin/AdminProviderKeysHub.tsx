"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SecretKeyField } from "@/components/admin/SecretKeyField";

type KeySource = "environment" | "admin" | "none";

type AiKeyConfig = {
  hasApiKey: boolean;
  apiKeyMasked?: string;
  configured: boolean;
  keySource: KeySource;
  envOverride?: boolean;
  model?: string;
  modelId?: string;
  envModelOverride?: boolean;
};

type SupabaseConfig = {
  projectUrl: string;
  projectUrlHost?: string;
  hasAnonKey: boolean;
  anonKeyMasked?: string;
  hasServiceRoleKey: boolean;
  serviceRoleKeyMasked?: string;
  configured: boolean;
  anonConfigured?: boolean;
  projectUrlSource: KeySource;
  anonKeySource: KeySource;
  serviceRoleKeySource: KeySource;
  envProjectUrlOverride?: boolean;
  envAnonKeyOverride?: boolean;
  envServiceRoleOverride?: boolean;
  docsUrl?: string;
};

type MediaWikiConfig = {
  enabled: boolean;
  userAgent: string;
  apiBaseUrl: string;
  hasAccessToken: boolean;
  accessTokenMasked?: string;
  configured: boolean;
  userAgentSource: "environment" | "admin" | "default";
  apiBaseUrlSource: "environment" | "admin" | "default";
  accessTokenSource: KeySource;
  docsUrl?: string;
  userAgentPolicyUrl?: string;
  envUserAgentOverride?: boolean;
  envApiBaseUrlOverride?: boolean;
  envAccessTokenOverride?: boolean;
  note?: string;
};

const DEFAULT_WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const DEFAULT_WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const DEFAULT_WIKI_UA = "Rugby365CMS/1.0 (https://rugby365.com; contact=admin@local)";
const WIKI_UA_POLICY =
  "https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy";

const DEFAULT_CAPTION_PROMPT =
  "Write one punchy social caption for a last-minute rugby try in under 20 words.";

function KeyBadge({ configured }: { configured: boolean }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold ${
        configured
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-zinc-700 bg-zinc-900/40 text-zinc-500"
      }`}
    >
      {configured ? "Key on file" : "Not set"}
    </span>
  );
}

function StatusBadge({ configured, label }: { configured: boolean; label?: string }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold ${
        configured
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
          : "border-zinc-700 bg-zinc-900/40 text-zinc-500"
      }`}
    >
      {label ?? (configured ? "Ready" : "Not set")}
    </span>
  );
}

export function AdminProviderKeysHub() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [supabase, setSupabase] = useState<SupabaseConfig | null>(null);
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseUrlDirty, setSupabaseUrlDirty] = useState(false);
  const [supabaseServiceRoleKey, setSupabaseServiceRoleKey] = useState("");
  const [supabaseKeyDirty, setSupabaseKeyDirty] = useState(false);
  const [clearSupabase, setClearSupabase] = useState(false);
  const [supabaseSaving, setSupabaseSaving] = useState(false);
  const [supabaseTesting, setSupabaseTesting] = useState(false);
  const [supabaseCheckMessage, setSupabaseCheckMessage] = useState("");

  const [elevenlabs, setElevenlabs] = useState<AiKeyConfig | null>(null);
  const [elevenlabsApiKey, setElevenlabsApiKey] = useState("");
  const [elevenlabsKeyDirty, setElevenlabsKeyDirty] = useState(false);
  const [clearElevenlabsKey, setClearElevenlabsKey] = useState(false);
  const [elevenlabsSaving, setElevenlabsSaving] = useState(false);
  const [elevenlabsTesting, setElevenlabsTesting] = useState(false);
  const [elevenlabsCheckMessage, setElevenlabsCheckMessage] = useState("");
  const [elevenlabsLastCheckAt, setElevenlabsLastCheckAt] = useState<string | null>(null);
  const [elevenlabsLastCheckOk, setElevenlabsLastCheckOk] = useState<boolean | null>(null);

  const [openai, setOpenai] = useState<AiKeyConfig | null>(null);
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiKeyDirty, setOpenaiKeyDirty] = useState(false);
  const [clearOpenaiKey, setClearOpenaiKey] = useState(false);
  const [openaiSaving, setOpenaiSaving] = useState(false);
  const [openaiTesting, setOpenaiTesting] = useState(false);
  const [openaiCheckMessage, setOpenaiCheckMessage] = useState("");
  const [captionPrompt, setCaptionPrompt] = useState(DEFAULT_CAPTION_PROMPT);
  const [captionCheckBusy, setCaptionCheckBusy] = useState(false);
  const [captionResult, setCaptionResult] = useState("");

  const [wikipedia, setWikipedia] = useState<MediaWikiConfig | null>(null);
  const [wikipediaEnabled, setWikipediaEnabled] = useState(true);
  const [wikipediaUserAgent, setWikipediaUserAgent] = useState(DEFAULT_WIKI_UA);
  const [wikipediaApiBaseUrl, setWikipediaApiBaseUrl] = useState(DEFAULT_WIKIPEDIA_API);
  const [wikipediaAccessToken, setWikipediaAccessToken] = useState("");
  const [wikipediaTokenDirty, setWikipediaTokenDirty] = useState(false);
  const [clearWikipediaToken, setClearWikipediaToken] = useState(false);
  const [wikipediaSaving, setWikipediaSaving] = useState(false);
  const [wikipediaTesting, setWikipediaTesting] = useState(false);
  const [wikipediaCheckMessage, setWikipediaCheckMessage] = useState("");

  const [wikidata, setWikidata] = useState<MediaWikiConfig | null>(null);
  const [wikidataEnabled, setWikidataEnabled] = useState(true);
  const [wikidataUserAgent, setWikidataUserAgent] = useState(DEFAULT_WIKI_UA);
  const [wikidataApiBaseUrl, setWikidataApiBaseUrl] = useState(DEFAULT_WIKIDATA_API);
  const [wikidataAccessToken, setWikidataAccessToken] = useState("");
  const [wikidataTokenDirty, setWikidataTokenDirty] = useState(false);
  const [clearWikidataToken, setClearWikidataToken] = useState(false);
  const [wikidataSaving, setWikidataSaving] = useState(false);
  const [wikidataTesting, setWikidataTesting] = useState(false);
  const [wikidataCheckMessage, setWikidataCheckMessage] = useState("");

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [sbRes, elRes, oaRes, wpRes, wdRes] = await Promise.all([
        fetch("/api/admin/integrations/supabase"),
        fetch("/api/admin/integrations/elevenlabs"),
        fetch("/api/admin/integrations/openai"),
        fetch("/api/admin/integrations/wikipedia"),
        fetch("/api/admin/integrations/wikidata"),
      ]);
      const [sb, el, oa, wp, wd] = await Promise.all([
        sbRes.json(),
        elRes.json(),
        oaRes.json(),
        wpRes.json(),
        wdRes.json(),
      ]);
      if (!sbRes.ok) throw new Error(sb.error ?? "Failed to load Supabase settings");
      if (!elRes.ok) throw new Error(el.error ?? "Failed to load ElevenLabs settings");
      if (!oaRes.ok) throw new Error(oa.error ?? "Failed to load OpenAI settings");
      if (!wpRes.ok) throw new Error(wp.error ?? "Failed to load Wikipedia settings");
      if (!wdRes.ok) throw new Error(wd.error ?? "Failed to load Wikidata settings");

      setSupabase(sb);
      setSupabaseUrl(sb.projectUrl ?? "");
      setSupabaseUrlDirty(false);
      setSupabaseServiceRoleKey("");
      setSupabaseKeyDirty(false);
      setClearSupabase(false);

      setElevenlabs(el);
      setElevenlabsApiKey("");
      setElevenlabsKeyDirty(false);
      setClearElevenlabsKey(false);

      setOpenai(oa);
      setOpenaiApiKey("");
      setOpenaiKeyDirty(false);
      setClearOpenaiKey(false);

      setWikipedia(wp);
      setWikipediaEnabled(wp.enabled !== false);
      setWikipediaUserAgent(wp.userAgent ?? DEFAULT_WIKI_UA);
      setWikipediaApiBaseUrl(wp.apiBaseUrl ?? DEFAULT_WIKIPEDIA_API);
      setWikipediaAccessToken("");
      setWikipediaTokenDirty(false);
      setClearWikipediaToken(false);

      setWikidata(wd);
      setWikidataEnabled(wd.enabled !== false);
      setWikidataUserAgent(wd.userAgent ?? DEFAULT_WIKI_UA);
      setWikidataApiBaseUrl(wd.apiBaseUrl ?? DEFAULT_WIKIDATA_API);
      setWikidataAccessToken("");
      setWikidataTokenDirty(false);
      setClearWikidataToken(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load provider keys");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading]);

  async function saveSupabaseSettings() {
    setSupabaseSaving(true);
    setError("");
    setMessage("");
    setSupabaseCheckMessage("");
    try {
      if (clearSupabase) {
        const res = await fetch("/api/admin/integrations/supabase", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "clear",
            clearProjectUrl: true,
            clearServiceRoleKey: true,
            clearAnonKey: false,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? data.message ?? "Clear failed");
        setSupabase(data);
        setSupabaseUrl(data.projectUrl ?? "");
        setSupabaseUrlDirty(false);
        setSupabaseServiceRoleKey("");
        setSupabaseKeyDirty(false);
        setClearSupabase(false);
        setMessage("Stored Supabase URL and service role key cleared.");
        return;
      }

      const res = await fetch("/api/admin/integrations/supabase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectUrl: supabaseUrlDirty ? supabaseUrl.trim() || undefined : undefined,
          serviceRoleKey:
            supabaseKeyDirty && supabaseServiceRoleKey.trim()
              ? supabaseServiceRoleKey.trim()
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Save failed");
      if (
        (supabaseUrlDirty || supabaseKeyDirty) &&
        (supabaseUrl.trim() || supabaseServiceRoleKey.trim()) &&
        !data.configured
      ) {
        throw new Error(
          "Supabase save could not be verified — set both project URL and service role key.",
        );
      }
      setSupabase(data);
      setSupabaseUrl(data.projectUrl ?? "");
      setSupabaseUrlDirty(false);
      setSupabaseServiceRoleKey("");
      setSupabaseKeyDirty(false);
      setMessage("Saved Supabase settings. Keys are now stored and active.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Supabase save failed");
    } finally {
      setSupabaseSaving(false);
    }
  }

  async function testSupabase() {
    setSupabaseTesting(true);
    setError("");
    setMessage("");
    setSupabaseCheckMessage("");
    try {
      const res = await fetch("/api/admin/integrations/supabase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          projectUrl: supabaseUrl.trim() || undefined,
          serviceRoleKey: supabaseServiceRoleKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message ?? data.error ?? "Connection failed");
      setSupabaseCheckMessage(data.message ?? "Connected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Supabase connection failed");
    } finally {
      setSupabaseTesting(false);
    }
  }

  async function saveElevenlabs() {
    setElevenlabsSaving(true);
    setError("");
    setMessage("");
    setElevenlabsCheckMessage("");
    try {
      if (clearElevenlabsKey) {
        const res = await fetch("/api/admin/integrations/elevenlabs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clear" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? data.message ?? "Clear failed");
        setElevenlabs(data);
        setElevenlabsApiKey("");
        setElevenlabsKeyDirty(false);
        setClearElevenlabsKey(false);
        setMessage("Stored ElevenLabs key cleared.");
        return;
      }
      const res = await fetch("/api/admin/integrations/elevenlabs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey:
            elevenlabsKeyDirty && elevenlabsApiKey.trim()
              ? elevenlabsApiKey.trim()
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Save failed");
      if (elevenlabsKeyDirty && elevenlabsApiKey.trim() && !data.configured) {
        throw new Error("ElevenLabs key save could not be verified.");
      }
      setElevenlabs(data);
      setElevenlabsApiKey("");
      setElevenlabsKeyDirty(false);
      setMessage("Saved ElevenLabs settings. Keys are now stored and active.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ElevenLabs save failed");
    } finally {
      setElevenlabsSaving(false);
    }
  }

  async function testElevenlabs() {
    setElevenlabsTesting(true);
    setError("");
    setMessage("");
    setElevenlabsCheckMessage("");
    const at = new Date().toISOString();
    try {
      const res = await fetch("/api/admin/integrations/elevenlabs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          apiKey:
            elevenlabsKeyDirty && elevenlabsApiKey.trim()
              ? elevenlabsApiKey.trim()
              : undefined,
        }),
      });
      const data = await res.json();
      setElevenlabsLastCheckAt(at);
      if (!res.ok || !data.ok) {
        setElevenlabsLastCheckOk(false);
        throw new Error(data.message ?? data.error ?? "ElevenLabs check failed");
      }
      setElevenlabsLastCheckOk(true);
      setElevenlabsCheckMessage(data.message ?? "Connected.");
    } catch (e) {
      setElevenlabsLastCheckOk(false);
      setError(e instanceof Error ? e.message : "ElevenLabs check failed");
    } finally {
      setElevenlabsTesting(false);
    }
  }

  async function saveOpenai() {
    setOpenaiSaving(true);
    setError("");
    setMessage("");
    setOpenaiCheckMessage("");
    try {
      if (clearOpenaiKey) {
        const res = await fetch("/api/admin/integrations/openai", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clear" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? data.message ?? "Clear failed");
        setOpenai(data);
        setOpenaiApiKey("");
        setOpenaiKeyDirty(false);
        setClearOpenaiKey(false);
        setMessage("Stored OpenAI key cleared.");
        return;
      }
      const res = await fetch("/api/admin/integrations/openai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: openaiKeyDirty && openaiApiKey.trim() ? openaiApiKey.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Save failed");
      if (openaiKeyDirty && openaiApiKey.trim() && !data.configured) {
        throw new Error("OpenAI key save could not be verified.");
      }
      setOpenai(data);
      setOpenaiApiKey("");
      setOpenaiKeyDirty(false);
      setMessage("Saved OpenAI settings. Keys are now stored and active.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "OpenAI save failed");
    } finally {
      setOpenaiSaving(false);
    }
  }

  async function testOpenai() {
    setOpenaiTesting(true);
    setError("");
    setMessage("");
    setOpenaiCheckMessage("");
    try {
      const res = await fetch("/api/admin/integrations/openai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          apiKey: openaiKeyDirty && openaiApiKey.trim() ? openaiApiKey.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message ?? data.error ?? "OpenAI connection failed");
      setOpenaiCheckMessage(data.message ?? "Connected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "OpenAI connection failed");
    } finally {
      setOpenaiTesting(false);
    }
  }

  async function testCaptionGeneration() {
    setCaptionCheckBusy(true);
    setCaptionResult("");
    setError("");
    setOpenaiCheckMessage("");
    try {
      const res = await fetch("/api/admin/integrations/openai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test-caption",
          apiKey: openaiKeyDirty && openaiApiKey.trim() ? openaiApiKey.trim() : undefined,
          prompt: captionPrompt.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message ?? data.error ?? "Caption generation failed");
      setCaptionResult(data.caption ?? "");
      setOpenaiCheckMessage(data.message ?? `OpenAI caption generation passed (${data.model ?? "model"}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Caption generation failed");
    } finally {
      setCaptionCheckBusy(false);
    }
  }

  async function saveWikipedia() {
    setWikipediaSaving(true);
    setError("");
    setMessage("");
    setWikipediaCheckMessage("");
    try {
      const res = await fetch("/api/admin/integrations/wikipedia", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: wikipediaEnabled,
          userAgent: wikipediaUserAgent.trim() || undefined,
          apiBaseUrl: wikipediaApiBaseUrl.trim() || undefined,
          accessToken:
            wikipediaTokenDirty && wikipediaAccessToken.trim()
              ? wikipediaAccessToken.trim()
              : undefined,
          clearAccessToken: clearWikipediaToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Save failed");
      setWikipedia(data);
      setWikipediaEnabled(data.enabled !== false);
      setWikipediaUserAgent(data.userAgent ?? DEFAULT_WIKI_UA);
      setWikipediaApiBaseUrl(data.apiBaseUrl ?? DEFAULT_WIKIPEDIA_API);
      setWikipediaAccessToken("");
      setWikipediaTokenDirty(false);
      setClearWikipediaToken(false);
      setMessage("Saved Wikipedia settings.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wikipedia save failed");
    } finally {
      setWikipediaSaving(false);
    }
  }

  async function testWikipedia() {
    setWikipediaTesting(true);
    setError("");
    setMessage("");
    setWikipediaCheckMessage("");
    try {
      const res = await fetch("/api/admin/integrations/wikipedia", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          userAgent: wikipediaUserAgent.trim() || undefined,
          apiBaseUrl: wikipediaApiBaseUrl.trim() || undefined,
          accessToken:
            wikipediaTokenDirty && wikipediaAccessToken.trim()
              ? wikipediaAccessToken.trim()
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message ?? data.error ?? "Wikipedia connection failed");
      setWikipediaCheckMessage(data.message ?? "Connected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wikipedia connection failed");
    } finally {
      setWikipediaTesting(false);
    }
  }

  async function saveWikidata() {
    setWikidataSaving(true);
    setError("");
    setMessage("");
    setWikidataCheckMessage("");
    try {
      const res = await fetch("/api/admin/integrations/wikidata", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: wikidataEnabled,
          userAgent: wikidataUserAgent.trim() || undefined,
          apiBaseUrl: wikidataApiBaseUrl.trim() || undefined,
          accessToken:
            wikidataTokenDirty && wikidataAccessToken.trim()
              ? wikidataAccessToken.trim()
              : undefined,
          clearAccessToken: clearWikidataToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Save failed");
      setWikidata(data);
      setWikidataEnabled(data.enabled !== false);
      setWikidataUserAgent(data.userAgent ?? DEFAULT_WIKI_UA);
      setWikidataApiBaseUrl(data.apiBaseUrl ?? DEFAULT_WIKIDATA_API);
      setWikidataAccessToken("");
      setWikidataTokenDirty(false);
      setClearWikidataToken(false);
      setMessage("Saved Wikidata settings.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wikidata save failed");
    } finally {
      setWikidataSaving(false);
    }
  }

  async function testWikidata() {
    setWikidataTesting(true);
    setError("");
    setMessage("");
    setWikidataCheckMessage("");
    try {
      const res = await fetch("/api/admin/integrations/wikidata", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          userAgent: wikidataUserAgent.trim() || undefined,
          apiBaseUrl: wikidataApiBaseUrl.trim() || undefined,
          accessToken:
            wikidataTokenDirty && wikidataAccessToken.trim()
              ? wikidataAccessToken.trim()
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.message ?? data.error ?? "Wikidata connection failed");
      setWikidataCheckMessage(data.message ?? "Connected.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wikidata connection failed");
    } finally {
      setWikidataTesting(false);
    }
  }

  const supabaseHost =
    supabase?.projectUrlHost ||
    (() => {
      const raw = (supabaseUrl || supabase?.projectUrl || "").trim();
      if (!raw) return "";
      try {
        return new URL(raw).hostname;
      } catch {
        return raw.replace(/^https?:\/\//, "").split("/")[0] ?? "";
      }
    })();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {loading ? <p className="m-0 text-sm text-zinc-500">Loading provider keys…</p> : null}

      {/* —— Supabase —— */}
      <section id="supabase" className="cms-card space-y-3 scroll-mt-24">
        <h2 className="m-0 text-sm font-bold uppercase tracking-wide text-zinc-100">
          Supabase (Live storage)
        </h2>
        <p className="m-0 text-sm text-zinc-400">
          Paste your Supabase <strong className="text-zinc-200">Project URL</strong> and the{" "}
          <strong className="text-zinc-200">service_role</strong> secret (the long JWT labelled
          &quot;service_role&quot; in API settings — <strong className="text-zinc-200">not</strong>{" "}
          the <code className="text-zinc-300">anon</code> key). The service role bypasses Row Level
          Security for server routes — keep it server-side only; it is never sent to browsers.
          Free-tier projects work.
        </p>
        <p className="m-0 text-sm text-zinc-400">
          Rugby365 uses these credentials at runtime for live fixture mirroring, private Live Audio
          Commentary storage, media buckets, and admin sync jobs. If the project is connected to
          GitHub for migrations, that link only syncs schema — this panel still needs the URL and
          service role so server routes can talk to the database.
        </p>
        <p className="m-0 rounded-lg border border-amber-800/25 bg-amber-100 p-3 text-xs leading-5 text-slate-900 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-50">
          <strong className="font-bold text-slate-950 dark:text-amber-100">First-time setup:</strong>{" "}
          after saving URL + service_role, open{" "}
          <Link href="/admin/keys/supabase" className="font-bold underline">
            Advanced Supabase tools
          </Link>{" "}
          and run <strong className="font-bold">Bootstrap buckets</strong> to create{" "}
          <code className="rounded bg-white/90 px-1.5 py-0.5 font-mono text-slate-800 ring-1 ring-amber-300/80 dark:bg-black/30 dark:text-amber-100 dark:ring-amber-600/50">
            rugby365-media
          </code>{" "}
          and{" "}
          <code className="rounded bg-white/90 px-1.5 py-0.5 font-mono text-slate-800 ring-1 ring-amber-300/80 dark:bg-black/30 dark:text-amber-100 dark:ring-amber-600/50">
            rugby365-live
          </code>
          . Optionally map CMS tables with <strong className="font-bold">Map all data</strong>.
          Environment <code className="rounded bg-white/90 px-1.5 py-0.5 font-mono text-slate-800 ring-1 ring-amber-300/80 dark:bg-black/30 dark:text-amber-100 dark:ring-amber-600/50">
            SUPABASE_*
          </code>{" "}
          vars still override CMS values when set.
        </p>

        {supabase?.configured || supabaseHost ? (
          <p className="m-0 text-xs text-zinc-500">
            Stored project host:{" "}
            <span className="font-mono text-zinc-300">{supabaseHost || "(unknown)"}</span>
            {supabase?.serviceRoleKeyMasked ? (
              <>
                {" "}
                · Service role:{" "}
                <span className="font-mono text-zinc-400">{supabase.serviceRoleKeyMasked}</span>
              </>
            ) : null}
          </p>
        ) : null}

        {supabase?.envProjectUrlOverride || supabase?.envServiceRoleOverride ? (
          <p className="m-0 text-sm text-amber-400 cms-status cms-status--warning">
            Environment override active
            {supabase.envProjectUrlOverride ? " (project URL)" : ""}
            {supabase.envServiceRoleOverride ? " (service role)" : ""}.
          </p>
        ) : null}

        <div className="space-y-4">
          <label className="block text-xs font-semibold uppercase text-zinc-500">
            Project URL
            <input
              type="url"
              className="cms-input mt-1 w-full font-mono text-sm"
              value={supabaseUrl}
              onChange={(e) => {
                setSupabaseUrlDirty(true);
                setSupabaseUrl(e.target.value);
                setClearSupabase(false);
              }}
              placeholder="https://your-project-ref.supabase.co (no /rest/v1/)"
              autoComplete="off"
              disabled={Boolean(supabase?.envProjectUrlOverride) || clearSupabase}
            />
          </label>
          <SecretKeyField
            label="Service role secret"
            value={supabaseServiceRoleKey}
            masked={supabase?.serviceRoleKeyMasked}
            dirty={supabaseKeyDirty}
            clear={clearSupabase}
            onChange={(v) => {
              setSupabaseKeyDirty(true);
              setSupabaseServiceRoleKey(v);
              setClearSupabase(false);
            }}
            onRevealFill={(v) => {
              setSupabaseServiceRoleKey(v);
              setSupabaseKeyDirty(false);
            }}
            placeholder="Paste service_role key (not anon)"
            disabled={Boolean(supabase?.envServiceRoleOverride) || clearSupabase}
            revealUrl="/api/admin/integrations/supabase"
            revealBody={{ field: "serviceRoleKey" }}
            canReveal={
              Boolean(supabase?.hasServiceRoleKey) &&
              supabase?.serviceRoleKeySource === "admin" &&
              !supabase?.envServiceRoleOverride
            }
            envOverride={Boolean(supabase?.envServiceRoleOverride)}
            envKeyName="SUPABASE_SERVICE_ROLE_KEY"
            onStatus={(msg, kind) => {
              if (kind === "error") setError(msg);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="cms-btn cms-btn--secondary"
              onClick={() => void testSupabase()}
              disabled={supabaseTesting || loading}
            >
              {supabaseTesting ? "Testing Supabase…" : "Test Supabase connection"}
            </button>
            <button
              type="button"
              className="cms-btn cms-btn--primary"
              onClick={() => void saveSupabaseSettings()}
              disabled={supabaseSaving || loading}
            >
              {supabaseSaving ? "Saving…" : "Save Supabase"}
            </button>
          </div>
          {supabaseCheckMessage ? (
            <p className="m-0 text-xs text-emerald-400">{supabaseCheckMessage}</p>
          ) : null}
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={clearSupabase}
              onChange={(e) => setClearSupabase(e.target.checked)}
              disabled={Boolean(
                supabase?.envProjectUrlOverride && supabase?.envServiceRoleOverride,
              )}
            />
            Remove stored Supabase URL and service role key
          </label>
          <p className="m-0 text-[11px] text-zinc-500">
            Need anon key, bootstrap, or full CMS sync?{" "}
            <Link href="/admin/keys/supabase" className="font-semibold text-emerald-400 hover:underline">
              Open advanced Supabase tools →
            </Link>
          </p>
        </div>
      </section>

      {/* —— AI providers —— */}
      <section id="ai-providers" className="cms-card space-y-4 scroll-mt-24">
        <h2 className="m-0 text-sm font-bold uppercase tracking-wide text-zinc-100">
          AI provider API keys
        </h2>

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
          <p className="m-0 text-sm font-semibold text-zinc-100">Secrets are masked by default</p>
          <p className="mt-1 mb-0 text-xs leading-5 text-zinc-400">
            Use the eye icon to reveal a CMS-stored key for sharing (admin only). Leave a field
            unchanged to keep the existing value, paste a new key to replace it, or tick remove to
            clear. Environment overrides cannot be revealed here — read them from the host env.
          </p>
        </div>

        {/* ElevenLabs */}
        <div id="elevenlabs" className="scroll-mt-24 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-sm font-bold text-zinc-100">ElevenLabs</p>
              <p className="mt-1 mb-0 text-xs text-zinc-500">
                Voice generation and Live Audio Commentary narration (Lead / Analyst).
              </p>
              <p className="mt-1 mb-0 text-[11px] text-zinc-500">
                Live uses <code className="text-zinc-400">ELEVENLABS_API_KEY</code> first when set.
                If unset, Live Audio TTS falls back to OpenAI.
              </p>
            </div>
            <KeyBadge configured={Boolean(elevenlabs?.configured)} />
          </div>

          {elevenlabs?.envOverride ? (
            <p className="mb-3 mt-0 text-sm text-amber-400 cms-status cms-status--warning">
              Environment override active — using ELEVENLABS_API_KEY from .env
              {elevenlabs.apiKeyMasked ? ` (${elevenlabs.apiKeyMasked})` : ""}.
            </p>
          ) : null}

          <SecretKeyField
            label="ELEVENLABS_API_KEY"
            value={elevenlabsApiKey}
            masked={elevenlabs?.apiKeyMasked}
            dirty={elevenlabsKeyDirty}
            clear={clearElevenlabsKey}
            onChange={(v) => {
              setElevenlabsKeyDirty(true);
              setElevenlabsApiKey(v);
              setClearElevenlabsKey(false);
            }}
            onRevealFill={(v) => {
              setElevenlabsApiKey(v);
              setElevenlabsKeyDirty(false);
            }}
            placeholder={
              elevenlabs?.configured
                ? "Leave blank to keep existing, or enter new key"
                : "sk_…"
            }
            disabled={Boolean(elevenlabs?.envOverride) || clearElevenlabsKey}
            revealUrl="/api/admin/integrations/elevenlabs"
            canReveal={
              Boolean(elevenlabs?.hasApiKey) &&
              elevenlabs?.keySource === "admin" &&
              !elevenlabs?.envOverride
            }
            envOverride={Boolean(elevenlabs?.envOverride)}
            envKeyName="ELEVENLABS_API_KEY"
            onStatus={(msg, kind) => {
              if (kind === "error") setError(msg);
            }}
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={clearElevenlabsKey}
              onChange={(e) => {
                setClearElevenlabsKey(e.target.checked);
                if (e.target.checked) {
                  setElevenlabsApiKey("");
                  setElevenlabsKeyDirty(false);
                }
              }}
              disabled={Boolean(elevenlabs?.envOverride)}
            />
            Remove stored ElevenLabs key
          </label>

          <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="m-0 text-[11px] text-zinc-400">
              Manage keys and usage in ElevenLabs. Use the eye icon here to reveal a CMS-stored key
              when you need to share it (admin only).
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                className="inline-flex text-[11px] font-semibold text-emerald-400 hover:underline"
                href="https://elevenlabs.io/app/settings/api-keys"
                target="_blank"
                rel="noreferrer noopener"
              >
                Open ElevenLabs API keys →
              </a>
              <a
                className="inline-flex text-[11px] font-semibold text-emerald-400 hover:underline"
                href="https://elevenlabs.io/app/billing"
                target="_blank"
                rel="noreferrer noopener"
              >
                Open ElevenLabs usage / billing →
              </a>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={
                  elevenlabsTesting ||
                  (!elevenlabs?.configured && !elevenlabsApiKey.trim())
                }
                onClick={() => void testElevenlabs()}
              >
                {elevenlabsTesting ? "Testing ElevenLabs…" : "Test ElevenLabs key"}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--primary"
                disabled={elevenlabsSaving || loading}
                onClick={() => void saveElevenlabs()}
              >
                {elevenlabsSaving ? "Saving…" : "Save ElevenLabs"}
              </button>
            </div>
            {elevenlabsCheckMessage ? (
              <p className="m-0 text-xs text-emerald-400">{elevenlabsCheckMessage}</p>
            ) : null}
            {elevenlabsLastCheckAt ? (
              <p
                className={`m-0 text-[11px] ${
                  elevenlabsLastCheckOk ? "text-emerald-400" : "text-amber-300"
                }`}
              >
                Last ElevenLabs check: {elevenlabsLastCheckOk ? "PASS" : "FAIL"} at{" "}
                {new Date(elevenlabsLastCheckAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        </div>

        {/* OpenAI */}
        <div id="openai" className="scroll-mt-24 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-sm font-bold text-zinc-100">OpenAI</p>
              <p className="mt-1 mb-0 text-xs text-zinc-500">
                AI generation, rewrite, bios, enrichment, commentary drafts and Live Audio TTS
                fallback.
              </p>
            </div>
            <KeyBadge configured={Boolean(openai?.configured)} />
          </div>

          {openai?.envOverride ? (
            <p className="mb-3 mt-0 text-sm text-amber-400 cms-status cms-status--warning">
              Environment override active — using OPENAI_API_KEY from .env
              {openai.apiKeyMasked ? ` (${openai.apiKeyMasked})` : ""}.
            </p>
          ) : null}

          <SecretKeyField
            label="OPENAI_API_KEY"
            value={openaiApiKey}
            masked={openai?.apiKeyMasked}
            dirty={openaiKeyDirty}
            clear={clearOpenaiKey}
            onChange={(v) => {
              setOpenaiKeyDirty(true);
              setOpenaiApiKey(v);
              setClearOpenaiKey(false);
            }}
            onRevealFill={(v) => {
              setOpenaiApiKey(v);
              setOpenaiKeyDirty(false);
            }}
            placeholder={
              openai?.configured ? "Leave blank to keep existing, or enter new key" : "sk-…"
            }
            disabled={Boolean(openai?.envOverride) || clearOpenaiKey}
            revealUrl="/api/admin/integrations/openai"
            canReveal={
              Boolean(openai?.hasApiKey) && openai?.keySource === "admin" && !openai?.envOverride
            }
            envOverride={Boolean(openai?.envOverride)}
            envKeyName="OPENAI_API_KEY"
            onStatus={(msg, kind) => {
              if (kind === "error") setError(msg);
            }}
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={clearOpenaiKey}
              onChange={(e) => {
                setClearOpenaiKey(e.target.checked);
                if (e.target.checked) {
                  setOpenaiApiKey("");
                  setOpenaiKeyDirty(false);
                }
              }}
              disabled={Boolean(openai?.envOverride)}
            />
            Remove stored OpenAI key
          </label>

          <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <p className="m-0 text-[11px] text-zinc-400">
              Manage keys in OpenAI platform, then test connection here before saving.
            </p>
            <a
              className="inline-flex text-[11px] font-semibold text-emerald-400 hover:underline"
              href="https://platform.openai.com/settings/organization/api-keys"
              target="_blank"
              rel="noreferrer noopener"
            >
              Open OpenAI API keys →
            </a>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={openaiTesting || (!openai?.configured && !openaiApiKey.trim())}
                onClick={() => void testOpenai()}
              >
                {openaiTesting ? "Testing OpenAI…" : "Test OpenAI connection"}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--primary"
                disabled={openaiSaving || loading}
                onClick={() => void saveOpenai()}
              >
                {openaiSaving ? "Saving…" : "Save OpenAI"}
              </button>
            </div>
            <div className="space-y-2 pt-1">
              <label className="block text-[11px] font-semibold text-zinc-500">
                Caption test prompt
                <textarea
                  className="cms-input cms-textarea mt-1 w-full text-sm"
                  rows={3}
                  value={captionPrompt}
                  onChange={(e) => setCaptionPrompt(e.target.value)}
                  placeholder={DEFAULT_CAPTION_PROMPT}
                />
              </label>
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={captionCheckBusy || (!openai?.configured && !openaiApiKey.trim())}
                onClick={() => void testCaptionGeneration()}
              >
                {captionCheckBusy ? "Generating caption…" : "Test caption generation"}
              </button>
              {captionResult ? (
                <div className="rounded-md border border-zinc-800 bg-zinc-950/80 p-2">
                  <p className="m-0 text-[11px] text-zinc-400">Generated caption preview:</p>
                  <p className="mt-1 mb-0 text-sm text-zinc-100">{captionResult}</p>
                </div>
              ) : null}
            </div>
            {openaiCheckMessage ? (
              <p className="m-0 text-xs text-emerald-400">{openaiCheckMessage}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="cms-btn cms-btn--secondary"
            disabled={loading}
            onClick={() => void loadAll()}
          >
            Reload
          </button>
        </div>
      </section>

      {/* —— Reference data APIs —— */}
      <section id="reference-data" className="cms-card space-y-4 scroll-mt-24">
        <h2 className="m-0 text-sm font-bold uppercase tracking-wide text-zinc-100">
          Reference data APIs
        </h2>
        <p className="m-0 text-sm text-zinc-400">
          Wikipedia and Wikidata MediaWiki APIs do <strong className="text-zinc-200">not</strong>{" "}
          require a paid API key. Wikimedia requires a descriptive{" "}
          <strong className="text-zinc-200">User-Agent</strong> that identifies this app and a
          contact. Optional bearer tokens are only for higher rate limits (rare for read-only).
        </p>
        <p className="m-0 text-xs text-zinc-500">
          Policy:{" "}
          <a
            className="font-semibold text-emerald-400 hover:underline"
            href={WIKI_UA_POLICY}
            target="_blank"
            rel="noreferrer noopener"
          >
            Wikimedia Foundation User-Agent Policy →
          </a>
        </p>

        {/* Wikipedia */}
        <div id="wikipedia" className="scroll-mt-24 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-sm font-bold text-zinc-100">Wikipedia</p>
              <p className="mt-1 mb-0 text-xs text-zinc-500">
                Public MediaWiki Action API for player/venue search, season import and archive
                enrichment. Enterprise credentials stay on{" "}
                <Link href="/admin/integrations/wikimedia" className="text-emerald-400 hover:underline">
                  Wikimedia Enterprise
                </Link>
                .
              </p>
            </div>
            <StatusBadge
              configured={Boolean(wikipedia?.configured && wikipediaEnabled)}
              label={
                !wikipediaEnabled
                  ? "Disabled"
                  : wikipedia?.configured
                    ? "Ready"
                    : "Not set"
              }
            />
          </div>

          {wikipedia?.envUserAgentOverride || wikipedia?.envApiBaseUrlOverride ? (
            <p className="mb-3 mt-0 text-sm text-amber-400 cms-status cms-status--warning">
              Environment override active
              {wikipedia.envUserAgentOverride ? " (User-Agent)" : ""}
              {wikipedia.envApiBaseUrlOverride ? " (API base URL)" : ""}.
            </p>
          ) : null}

          <label className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={wikipediaEnabled}
              onChange={(e) => setWikipediaEnabled(e.target.checked)}
            />
            Enabled
          </label>

          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase text-zinc-500">
              User-Agent
              <input
                type="text"
                className="cms-input mt-1 w-full font-mono text-sm"
                value={wikipediaUserAgent}
                onChange={(e) => setWikipediaUserAgent(e.target.value)}
                placeholder={DEFAULT_WIKI_UA}
                autoComplete="off"
                disabled={Boolean(wikipedia?.envUserAgentOverride)}
              />
            </label>
            <label className="block text-xs font-semibold uppercase text-zinc-500">
              API base URL
              <input
                type="url"
                className="cms-input mt-1 w-full font-mono text-sm"
                value={wikipediaApiBaseUrl}
                onChange={(e) => setWikipediaApiBaseUrl(e.target.value)}
                placeholder={DEFAULT_WIKIPEDIA_API}
                autoComplete="off"
                disabled={Boolean(wikipedia?.envApiBaseUrlOverride)}
              />
            </label>
            <SecretKeyField
              label="Optional access token"
              value={wikipediaAccessToken}
              masked={wikipedia?.accessTokenMasked}
              dirty={wikipediaTokenDirty}
              clear={clearWikipediaToken}
              onChange={(v) => {
                setWikipediaTokenDirty(true);
                setWikipediaAccessToken(v);
                setClearWikipediaToken(false);
              }}
              onRevealFill={(v) => {
                setWikipediaAccessToken(v);
                setWikipediaTokenDirty(false);
              }}
              placeholder="Leave blank — only needed for higher rate limits"
              disabled={Boolean(wikipedia?.envAccessTokenOverride) || clearWikipediaToken}
              revealUrl="/api/admin/integrations/wikipedia"
              canReveal={
                Boolean(wikipedia?.hasAccessToken) &&
                wikipedia?.accessTokenSource === "admin" &&
                !wikipedia?.envAccessTokenOverride
              }
              envOverride={Boolean(wikipedia?.envAccessTokenOverride)}
              envKeyName="WIKIPEDIA_ACCESS_TOKEN"
              onStatus={(msg, kind) => {
                if (kind === "error") setError(msg);
              }}
            />
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <input
                type="checkbox"
                checked={clearWikipediaToken}
                onChange={(e) => {
                  setClearWikipediaToken(e.target.checked);
                  if (e.target.checked) {
                    setWikipediaAccessToken("");
                    setWikipediaTokenDirty(false);
                  }
                }}
                disabled={Boolean(wikipedia?.envAccessTokenOverride)}
              />
              Remove stored access token
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={wikipediaTesting || loading || !wikipediaUserAgent.trim()}
                onClick={() => void testWikipedia()}
              >
                {wikipediaTesting ? "Testing Wikipedia…" : "Test Wikipedia connection"}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--primary"
                disabled={wikipediaSaving || loading || !wikipediaUserAgent.trim()}
                onClick={() => void saveWikipedia()}
              >
                {wikipediaSaving ? "Saving…" : "Save Wikipedia"}
              </button>
            </div>
            {wikipediaCheckMessage ? (
              <p className="m-0 text-xs text-emerald-400">{wikipediaCheckMessage}</p>
            ) : null}
            <a
              className="inline-flex text-[11px] font-semibold text-emerald-400 hover:underline"
              href={wikipedia?.docsUrl ?? "https://www.mediawiki.org/wiki/API:Main_page"}
              target="_blank"
              rel="noreferrer noopener"
            >
              MediaWiki Action API docs →
            </a>
          </div>
        </div>

        {/* Wikidata */}
        <div id="wikidata" className="scroll-mt-24 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="m-0 text-sm font-bold text-zinc-100">Wikidata</p>
              <p className="mt-1 mb-0 text-xs text-zinc-500">
                Public Wikidata Action API for entity lookups (birth date, socials, place of birth)
                used when Wikipedia infobox fields are empty.
              </p>
            </div>
            <StatusBadge
              configured={Boolean(wikidata?.configured && wikidataEnabled)}
              label={
                !wikidataEnabled ? "Disabled" : wikidata?.configured ? "Ready" : "Not set"
              }
            />
          </div>

          {wikidata?.envUserAgentOverride || wikidata?.envApiBaseUrlOverride ? (
            <p className="mb-3 mt-0 text-sm text-amber-400 cms-status cms-status--warning">
              Environment override active
              {wikidata.envUserAgentOverride ? " (User-Agent)" : ""}
              {wikidata.envApiBaseUrlOverride ? " (API base URL)" : ""}.
            </p>
          ) : null}

          <label className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={wikidataEnabled}
              onChange={(e) => setWikidataEnabled(e.target.checked)}
            />
            Enabled
          </label>

          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase text-zinc-500">
              User-Agent
              <input
                type="text"
                className="cms-input mt-1 w-full font-mono text-sm"
                value={wikidataUserAgent}
                onChange={(e) => setWikidataUserAgent(e.target.value)}
                placeholder={DEFAULT_WIKI_UA}
                autoComplete="off"
                disabled={Boolean(wikidata?.envUserAgentOverride)}
              />
            </label>
            <label className="block text-xs font-semibold uppercase text-zinc-500">
              API base URL
              <input
                type="url"
                className="cms-input mt-1 w-full font-mono text-sm"
                value={wikidataApiBaseUrl}
                onChange={(e) => setWikidataApiBaseUrl(e.target.value)}
                placeholder={DEFAULT_WIKIDATA_API}
                autoComplete="off"
                disabled={Boolean(wikidata?.envApiBaseUrlOverride)}
              />
            </label>
            <SecretKeyField
              label="Optional access token"
              value={wikidataAccessToken}
              masked={wikidata?.accessTokenMasked}
              dirty={wikidataTokenDirty}
              clear={clearWikidataToken}
              onChange={(v) => {
                setWikidataTokenDirty(true);
                setWikidataAccessToken(v);
                setClearWikidataToken(false);
              }}
              onRevealFill={(v) => {
                setWikidataAccessToken(v);
                setWikidataTokenDirty(false);
              }}
              placeholder="Leave blank — only needed for higher rate limits"
              disabled={Boolean(wikidata?.envAccessTokenOverride) || clearWikidataToken}
              revealUrl="/api/admin/integrations/wikidata"
              canReveal={
                Boolean(wikidata?.hasAccessToken) &&
                wikidata?.accessTokenSource === "admin" &&
                !wikidata?.envAccessTokenOverride
              }
              envOverride={Boolean(wikidata?.envAccessTokenOverride)}
              envKeyName="WIKIDATA_ACCESS_TOKEN"
              onStatus={(msg, kind) => {
                if (kind === "error") setError(msg);
              }}
            />
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <input
                type="checkbox"
                checked={clearWikidataToken}
                onChange={(e) => {
                  setClearWikidataToken(e.target.checked);
                  if (e.target.checked) {
                    setWikidataAccessToken("");
                    setWikidataTokenDirty(false);
                  }
                }}
                disabled={Boolean(wikidata?.envAccessTokenOverride)}
              />
              Remove stored access token
            </label>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={wikidataTesting || loading || !wikidataUserAgent.trim()}
                onClick={() => void testWikidata()}
              >
                {wikidataTesting ? "Testing Wikidata…" : "Test Wikidata connection"}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--primary"
                disabled={wikidataSaving || loading || !wikidataUserAgent.trim()}
                onClick={() => void saveWikidata()}
              >
                {wikidataSaving ? "Saving…" : "Save Wikidata"}
              </button>
            </div>
            {wikidataCheckMessage ? (
              <p className="m-0 text-xs text-emerald-400">{wikidataCheckMessage}</p>
            ) : null}
            <a
              className="inline-flex text-[11px] font-semibold text-emerald-400 hover:underline"
              href={wikidata?.docsUrl ?? "https://www.wikidata.org/wiki/Wikidata:Data_access"}
              target="_blank"
              rel="noreferrer noopener"
            >
              Wikidata data access docs →
            </a>
          </div>
        </div>
      </section>

      {message ? <p className="m-0 text-sm text-emerald-400">{message}</p> : null}
      {error ? <p className="m-0 text-sm text-red-400">{error}</p> : null}

      <div className="cms-card text-sm text-zinc-400">
        <h2 className="mt-0 text-base text-zinc-200">Used by</h2>
        <ul className="m-0 list-disc space-y-1 pl-4">
          <li>
            <strong className="text-zinc-300">Supabase</strong> — live fixtures, private audio
            bucket, media mirroring, full CMS sync
          </li>
          <li>
            <strong className="text-zinc-300">ElevenLabs</strong> — Live Audio Commentary Lead /
            Analyst TTS
          </li>
          <li>
            <strong className="text-zinc-300">OpenAI</strong> — bios, enrichment, commentary drafts,
            caption tests, TTS fallback when ElevenLabs is unset
          </li>
          <li>
            <strong className="text-zinc-300">Wikipedia</strong> — player/venue search, season import,
            archive enrichment (User-Agent + API base from these settings)
          </li>
          <li>
            <strong className="text-zinc-300">Wikidata</strong> — profile gap-fill (socials, birth
            data) when Wikipedia fields are empty
          </li>
        </ul>
      </div>
    </div>
  );
}
