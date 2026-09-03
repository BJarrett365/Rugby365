"use client";

import { useState } from "react";

type CoachProfileAssetImageProps = {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  fallbackClassName?: string;
};

/** Small client wrapper so server coach profile rows can hide broken crest/photo URLs. */
export function CoachProfileAssetImage({
  src,
  alt = "",
  className,
  width,
  height,
  fallbackClassName,
}: CoachProfileAssetImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src?.trim()) {
    return fallbackClassName ? <span className={fallbackClassName} aria-hidden /> : null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
