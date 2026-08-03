"use client";

import { MediaImage } from "@/components/media/MediaImage";
import { SilhouetteAvatar } from "@/components/media/SilhouetteAvatar";
import { TeamCrest } from "@/components/matches/TeamCrest";
import { defaultAltText } from "@/lib/media-tokens";

export type PlayerPortraitProps = {
  name: string;
  imageUrl?: string | null;
  alt?: string | null;
  /** Portrait aspect (default) or square thumb. */
  variant?: "portrait" | "square" | "hero";
  priority?: boolean;
  clubName?: string | null;
  clubImageUrl?: string | null;
  nationName?: string | null;
  nationImageUrl?: string | null;
  squadNumber?: number | null;
  statusLabel?: string | null;
  isCaptain?: boolean;
  credit?: string | null;
  lastUpdated?: string | null;
  focalX?: number | null;
  focalY?: number | null;
  className?: string;
};

/**
 * Premium player image — large portrait, face-centred crop, optional overlays.
 */
export function PlayerPortrait({
  name,
  imageUrl,
  alt,
  variant = "portrait",
  priority = false,
  clubName,
  clubImageUrl,
  nationName,
  nationImageUrl,
  squadNumber,
  statusLabel,
  isCaptain = false,
  credit,
  lastUpdated,
  focalX,
  focalY,
  className,
}: PlayerPortraitProps) {
  const dims =
    variant === "hero"
      ? { width: 900, height: 1200 }
      : variant === "square"
        ? { width: 240, height: 240 }
        : { width: 480, height: 640 };

  const resolvedAlt = alt?.trim() || defaultAltText(name, "headshot");

  return (
    <figure className={`pr-player-portrait pr-player-portrait--${variant} ${className ?? ""}`.trim()}>
      <div className="pr-player-portrait__frame">
        <MediaImage
          src={imageUrl}
          alt={resolvedAlt}
          width={dims.width}
          height={dims.height}
          aspect={variant === "square" ? "square" : "portrait"}
          priority={priority}
          sizes={
            variant === "hero"
              ? "(max-width: 768px) 100vw, 420px"
              : variant === "square"
                ? "120px"
                : "(max-width: 768px) 40vw, 240px"
          }
          focalX={focalX ?? 50}
          focalY={focalY ?? 28}
          className="pr-player-portrait__img"
          fallback={
            <SilhouetteAvatar
              name={name}
              aspect={variant === "square" ? "square" : "portrait"}
              className="pr-player-portrait__silhouette"
            />
          }
        />

        <div className="pr-player-portrait__overlays" aria-hidden>
          {clubName ? (
            <span className="pr-player-portrait__badge pr-player-portrait__badge--club">
              <TeamCrest name={clubName} imageUrl={clubImageUrl} size="sm" />
            </span>
          ) : null}
          {nationName ? (
            <span className="pr-player-portrait__badge pr-player-portrait__badge--nation">
              <TeamCrest name={nationName} imageUrl={nationImageUrl} size="sm" />
            </span>
          ) : null}
          {squadNumber != null ? (
            <span className="pr-player-portrait__number">#{squadNumber}</span>
          ) : null}
          {isCaptain ? <span className="pr-player-portrait__captain">C</span> : null}
          {statusLabel ? <span className="pr-player-portrait__status">{statusLabel}</span> : null}
        </div>
      </div>

      {(credit || lastUpdated) && (
        <figcaption className="pr-player-portrait__credit">
          {credit ? <span>{credit}</span> : null}
          {credit && lastUpdated ? <span aria-hidden> · </span> : null}
          {lastUpdated ? <span>Updated {lastUpdated}</span> : null}
        </figcaption>
      )}
    </figure>
  );
}
