"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import {
  MEDIA_ASPECT,
  canOptimizeMediaUrl,
  objectPositionFromFocal,
  type MediaAspect,
} from "@/lib/media-tokens";
import { SilhouetteAvatar } from "@/components/media/SilhouetteAvatar";

export type MediaImageProps = {
  src: string | null | undefined;
  alt: string;
  width: number;
  height: number;
  className?: string;
  /** When true, loads eagerly (above-the-fold heroes only). */
  priority?: boolean;
  sizes?: string;
  aspect?: MediaAspect;
  focalX?: number | null;
  focalY?: number | null;
  /** Decorative image — empty alt, aria-hidden. */
  decorative?: boolean;
  objectFit?: "cover" | "contain";
  fallback?: ReactNode;
  onClick?: () => void;
};

/**
 * Shared public/CMS image primitive.
 * Uses next/image when the host is allow-listed; otherwise a sized img.
 * Broken or missing images fall back to silhouette (or custom fallback).
 */
export function MediaImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  sizes,
  aspect,
  focalX,
  focalY,
  decorative = false,
  objectFit = "cover",
  fallback = null,
  onClick,
}: MediaImageProps) {
  const [failed, setFailed] = useState(false);
  const resolvedAlt = decorative ? "" : alt;
  const objectPosition = objectPositionFromFocal(focalX, focalY);
  const style: CSSProperties = {
    ...(aspect ? { aspectRatio: MEDIA_ASPECT[aspect] } : {}),
    ...(objectPosition ? { objectPosition } : {}),
    objectFit,
    width: "100%",
    height: "100%",
  };

  const silhouetteAspect = aspect === "square" ? "square" : "portrait";
  const defaultFallback = fallback ?? (
    <SilhouetteAvatar
      name={alt}
      aspect={silhouetteAspect}
      decorative={decorative}
      className="pr-media-fallback-silhouette"
    />
  );

  if (!src?.trim() || failed) {
    return (
      <span className={className} style={style} aria-hidden={decorative || undefined}>
        {defaultFallback}
      </span>
    );
  }

  const url = src.trim();
  const common = {
    className,
    style,
    onClick,
    onError: () => setFailed(true),
  };

  if (canOptimizeMediaUrl(url)) {
    return (
      <Image
        src={url}
        alt={resolvedAlt}
        width={width}
        height={height}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        sizes={sizes ?? `${width}px`}
        aria-hidden={decorative || undefined}
        {...common}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={resolvedAlt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      aria-hidden={decorative || undefined}
      {...common}
    />
  );
}
