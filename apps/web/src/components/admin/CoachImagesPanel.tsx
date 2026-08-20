"use client";

import { useCallback, useEffect, useState } from "react";

type CoachImageRow = {
  id: string;
  imageUrl: string;
  role: string;
  status: string;
  sourceProvider: string;
  caption: string | null;
};

export function CoachImagesPanel({
  coachId,
  coachName,
  currentImageUrl,
  onPrimaryChanged,
}: {
  coachId: string;
  coachName?: string;
  currentImageUrl?: string | null;
  onPrimaryChanged?: (imageUrl: string | null) => void;
}) {
  const [images, setImages] = useState<CoachImageRow[]>([]);
  const [primaryUrl, setPrimaryUrl] = useState(currentImageUrl ?? "");
  const [urlInput, setUrlInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/coaches/${coachId}/images`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load images");
      setImages(data.images ?? []);
      const next = data.coach?.imageUrl ?? "";
      setPrimaryUrl(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load images");
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPrimaryUrl(currentImageUrl ?? "");
  }, [currentImageUrl]);

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/admin/coaches/${coachId}/images`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      const next = data.coach?.imageUrl ?? data.image?.imageUrl ?? null;
      setPrimaryUrl(next ?? "");
      setImages(data.images ?? []);
      onPrimaryChanged?.(next);
      setMessage("Primary photo updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function setFromUrl() {
    const imageUrl = urlInput.trim();
    if (!imageUrl) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/coaches/${coachId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_from_url", imageUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to set image");
      const next = data.coach?.imageUrl ?? imageUrl;
      setPrimaryUrl(next);
      setImages(data.images ?? []);
      onPrimaryChanged?.(next);
      setUrlInput("");
      setMessage("Primary photo updated from URL.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set image");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="cms-card mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold m-0">Coach photo</h3>
        {loading ? <span className="text-xs text-zinc-500">Loading…</span> : null}
      </div>
      <p className="text-sm text-zinc-500 mt-0 mb-3">
        Upload a portrait for {coachName || "this coach"}, or paste an image URL. Wikipedia / RugbyPass
        imports can also fill a missing photo.
      </p>

      <div className="flex flex-wrap gap-4 items-start mb-4">
        <div className="w-28 h-36 rounded-md overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center">
          {primaryUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={primaryUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-zinc-600 px-2 text-center">No photo</span>
          )}
        </div>
        <div className="flex-1 min-w-[16rem] space-y-3">
          <label className="block">
            <span className="text-sm text-zinc-400">Upload image</span>
            <input
              className="cms-input w-full mt-1"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadFile(file);
                e.target.value = "";
              }}
            />
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className="cms-input flex-1"
              type="url"
              placeholder="https://… or /crest-references/…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={uploading}
            />
            <button
              type="button"
              className="cms-btn cms-btn--secondary shrink-0"
              disabled={uploading || !urlInput.trim()}
              onClick={() => void setFromUrl()}
            >
              Use URL
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="text-red-400 text-sm m-0 mb-2">{error}</p> : null}
      {message ? <p className="text-emerald-400 text-sm m-0 mb-2">{message}</p> : null}

      {images.length > 0 ? (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {images.slice(0, 12).map((img) => (
            <button
              key={img.id}
              type="button"
              className={`rounded border overflow-hidden ${
                img.role === "primary" ? "border-emerald-500" : "border-zinc-800"
              }`}
              title={`${img.sourceProvider} · ${img.role}`}
              onClick={() => {
                setUrlInput(img.imageUrl);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.imageUrl} alt="" className="w-full aspect-square object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
