"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import type { KnowledgePageMeta } from "@/lib/knowledge-catalog";

export default function KnowledgeDocPage() {
  const params = useParams();
  const slug = String(params.slug ?? "");
  const [meta, setMeta] = useState<KnowledgePageMeta | null>(null);
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const res = await fetch(`/api/admin/knowledge/${encodeURIComponent(slug)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load");
      return;
    }
    setMeta(data.meta);
    setContent(data.content ?? "");
    setDraft(data.content ?? "");
  }, [slug]);

  useEffect(() => {
    load().catch(() => setError("Failed to load"));
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    const res = await fetch(`/api/admin/knowledge/${encodeURIComponent(slug)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error ?? "Save failed");
    else {
      setContent(draft);
      setEditing(false);
      setMessage("Saved");
    }
    setSaving(false);
  }

  return (
    <>
      <PageHeader
        eyebrow="Keys · Knowledge"
        title={meta?.title ?? "Knowledge"}
        description={meta?.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/knowledge" className="cms-btn cms-btn--secondary">
              All docs
            </Link>
            {!editing ? (
              <button type="button" className="cms-btn cms-btn--primary" onClick={() => setEditing(true)}>
                Edit
              </button>
            ) : (
              <>
                <button type="button" className="cms-btn cms-btn--ghost" onClick={() => { setEditing(false); setDraft(content); }}>
                  Cancel
                </button>
                <button type="button" className="cms-btn cms-btn--primary" disabled={saving} onClick={save}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            )}
          </div>
        }
      />
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {message ? <p className="text-sm text-[var(--pr-green)]">{message}</p> : null}
      <div className="cms-card">
        {editing ? (
          <textarea
            className="cms-textarea w-full min-h-[28rem] font-mono text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Markdown content"
          />
        ) : (
          <pre className="whitespace-pre-wrap text-sm m-0 text-[var(--pr-white)] leading-relaxed font-sans">
            {content || "Loading…"}
          </pre>
        )}
      </div>
    </>
  );
}
