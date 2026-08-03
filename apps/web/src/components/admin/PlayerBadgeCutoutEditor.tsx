"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PlayerBadge } from "@/components/players/PlayerBadge";

const FRAME_W = 360;
const FRAME_H = 420;

type Props = {
  playerId: string;
  sourceImageId: string;
  playerName: string;
  rating?: number | null;
  positionName?: string | null;
  onClose: () => void;
  onSaved: (badgeImageUrl: string) => void;
};

/**
 * CMS editor: load source → remove background → pan/zoom → export PNG for Player Badge.
 */
export function PlayerBadgeCutoutEditor({
  playerId,
  sourceImageId,
  playerName,
  rating,
  positionName,
  onClose,
  onSaved,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [workingUrl, setWorkingUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(40);
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/players/${playerId}/images?sourceImageId=${encodeURIComponent(sourceImageId)}`,
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load source image");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        revoked = url;
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setSourceUrl(url);
        setWorkingUrl(url);
        setCutoutUrl(null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load image");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [playerId, sourceImageId]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const url = workingUrl;
    if (!canvas || !url) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, FRAME_W, FRAME_H);
      // Checkerboard so transparency is visible
      const size = 12;
      for (let y = 0; y < FRAME_H; y += size) {
        for (let x = 0; x < FRAME_W; x += size) {
          ctx.fillStyle = (x / size + y / size) % 2 === 0 ? "#2a2a2a" : "#1a1a1a";
          ctx.fillRect(x, y, size, size);
        }
      }
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const base = Math.min(FRAME_W / iw, FRAME_H / ih);
      const scale = base * zoom;
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = (FRAME_W - dw) / 2 + offsetX;
      const dy = (FRAME_H - dh) / 2 + offsetY;
      ctx.drawImage(img, dx, dy, dw, dh);
    };
    img.src = url;
  }, [workingUrl, zoom, offsetX, offsetY]);

  useEffect(() => {
    draw();
  }, [draw]);

  async function removeBackground() {
    if (!sourceUrl) return;
    setRemoving(true);
    setError(null);
    setStatus("Loading background removal model…");
    try {
      const { removeBackground: rembg } = await import("@imgly/background-removal");
      setStatus("Cutting background…");
      const blob = await rembg(sourceUrl, {
        progress: (_key, current, total) => {
          if (total > 0) {
            setStatus(`Cutting background… ${Math.round((current / total) * 100)}%`);
          }
        },
      });
      const url = URL.createObjectURL(blob);
      if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
      setCutoutUrl(url);
      setWorkingUrl(url);
      setStatus("Background removed. Adjust position, then save.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Background removal failed. You can still crop and save, or upload a cutout PNG.",
      );
      setStatus(null);
    } finally {
      setRemoving(false);
    }
  }

  function onPointerDown(e: ReactPointerEvent) {
    setDragging(true);
    dragOrigin.current = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!dragging) return;
    setOffsetX(dragOrigin.current.ox + (e.clientX - dragOrigin.current.x));
    setOffsetY(dragOrigin.current.oy + (e.clientY - dragOrigin.current.y));
  }

  function onPointerUp() {
    setDragging(false);
  }

  async function buildExportDataUrl(): Promise<string> {
    if (!workingUrl) throw new Error("No image loaded");
    const img = await loadImage(workingUrl);
    const out = document.createElement("canvas");
    out.width = FRAME_W;
    out.height = FRAME_H;
    const ctx = out.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const base = Math.min(FRAME_W / iw, FRAME_H / ih);
    const scale = base * zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (FRAME_W - dw) / 2 + offsetX;
    const dy = (FRAME_H - dh) / 2 + offsetY;
    ctx.clearRect(0, 0, FRAME_W, FRAME_H);
    ctx.drawImage(img, dx, dy, dw, dh);
    return out.toDataURL("image/png");
  }

  async function save() {
    setSaving(true);
    setError(null);
    setStatus("Saving badge cutout…");
    try {
      const dataUrl = await buildExportDataUrl();
      const res = await fetch(`/api/admin/players/${playerId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_badge_cutout",
          sourceImageId,
          dataUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      const url = data.badgeImageUrl as string;
      onSaved(url);
      setStatus("Badge cutout saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
      setStatus(null);
    } finally {
      setSaving(false);
    }
  }

  async function onUploadCutout(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG preferred).");
      return;
    }
    const url = URL.createObjectURL(file);
    if (cutoutUrl) URL.revokeObjectURL(cutoutUrl);
    setCutoutUrl(url);
    setWorkingUrl(url);
    setStatus("Uploaded cutout loaded. Adjust position, then save.");
  }

  const previewUrl = workingUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Edit player badge cutout"
    >
      <div className="cms-card max-h-[95vh] w-full max-w-5xl overflow-auto p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="m-0 font-semibold">Player badge cutout</h3>
            <p className="mt-1 mb-0 text-sm text-zinc-500">
              Remove the background, then drag / zoom so the player sits on the badge like a FUT
              card. Primary gallery photo stays unchanged.
            </p>
          </div>
          <button type="button" className="cms-btn cms-btn--secondary" onClick={onClose}>
            Close
          </button>
        </div>

        {loading ? <p className="text-sm text-zinc-400">Loading source image…</p> : null}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {status ? <p className="text-sm text-emerald-400/90">{status}</p> : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div>
            <canvas
              ref={canvasRef}
              width={FRAME_W}
              height={FRAME_H}
              className="mx-auto max-w-full cursor-grab touch-none rounded border border-white/10 active:cursor-grabbing"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                Zoom
                <input
                  type="range"
                  min={0.6}
                  max={2.4}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
                <span className="tabular-nums text-zinc-500">{zoom.toFixed(2)}×</span>
              </label>
              <button
                type="button"
                className="cms-btn cms-btn--secondary text-xs"
                onClick={() => {
                  setZoom(1);
                  setOffsetX(0);
                  setOffsetY(40);
                }}
              >
                Reset position
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="cms-btn cms-btn--primary"
                disabled={!sourceUrl || removing || saving}
                onClick={() => void removeBackground()}
              >
                {removing ? "Cutting…" : "Cut background out"}
              </button>
              <button
                type="button"
                className="cms-btn cms-btn--secondary"
                disabled={!cutoutUrl || saving}
                onClick={() => {
                  if (sourceUrl) setWorkingUrl(sourceUrl);
                  setStatus("Showing original (with background).");
                }}
              >
                Use original
              </button>
              <label className="cms-btn cms-btn--secondary cursor-pointer">
                Upload cutout PNG
                <input
                  type="file"
                  accept="image/png,image/webp,image/*"
                  className="hidden"
                  onChange={(e) => void onUploadCutout(e.target.files?.[0] ?? null)}
                />
              </label>
              <button
                type="button"
                className="cms-btn cms-btn--primary"
                disabled={!workingUrl || saving || removing}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save badge cutout"}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p className="m-0 text-xs uppercase tracking-wide text-zinc-500">Live badge preview</p>
            <PlayerBadge
              name={playerName}
              imageUrl={previewUrl}
              rating={rating}
              positionName={positionName}
              cutout
              size="md"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = src;
  });
}
