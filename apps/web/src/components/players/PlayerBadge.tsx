"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  PLAYER_BADGE_METALS,
  PLAYER_BADGE_SIZES,
  playerBadgeRarityFromRating,
  type PlayerBadgeRarity,
  type PlayerBadgeSize,
} from "@/lib/player-badge-tier";
import { playerPositionAbbrev } from "@/lib/player-position-abbrev";

export type PlayerBadgeProps = {
  name: string;
  imageUrl?: string | null;
  rating?: number | null;
  positionName?: string | null;
  positionAbbrev?: string | null;
  nationName?: string | null;
  nationImageUrl?: string | null;
  clubName?: string | null;
  clubImageUrl?: string | null;
  age?: number | null;
  marketValueLabel?: string | null;
  worldRank?: number | null;
  slug?: string | null;
  href?: string | null;
  size?: PlayerBadgeSize;
  rarity?: PlayerBadgeRarity;
  /** @deprecated Use rarity */
  tier?: PlayerBadgeRarity;
  className?: string;
  compact?: boolean;
  /** Transparent cutout PNG — sits on metal pattern without rectangular photo crop. */
  cutout?: boolean;
};

/**
 * Reference artboard — FUT-style rugby collectible (360×520).
 * Matches Planet Rugby mock: rating · pos · photo · name · flag|club|age · RATING/VALUE · rank.
 */
const VB_W = 360;
const VB_H = 520;

/** Outer metal frame — curved top, pointed tip. */
const SHIELD_OUTER =
  "M36 18 C36 6 54 2 76 2 L284 2 C306 2 324 6 324 18 L324 392 L180 514 L36 392 Z";

/** Inner face inset. */
const SHIELD_INNER =
  "M56 36 C56 24 72 18 90 18 L270 18 C288 18 304 24 304 36 L304 378 L180 486 L56 378 Z";

function truncateName(name: string, max = 20): string {
  const t = name.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Drop season suffixes / roman numerals stuck on club names. */
export function cleanPlayerBadgeClubLabel(value: string | null | undefined): string | null {
  const t = value?.trim();
  if (!t) return null;
  return (
    t
      .replace(/\s+(X{0,3})(IX|IV|V?I{0,3})$/i, "")
      .replace(/\s+20\d{2}(?:[–\-\/](?:\d{2}|20\d{2}))?$/i, "")
      .replace(/\s+season$/i, "")
      .trim() || t
  );
}

type Metal = (typeof PLAYER_BADGE_METALS)[PlayerBadgeRarity];

/**
 * Rugby365 Player Badge — premium collectible matching the Planet Rugby mock.
 */
export function PlayerBadge({
  name,
  imageUrl,
  rating,
  positionName,
  positionAbbrev,
  nationName,
  nationImageUrl,
  clubName,
  clubImageUrl,
  age,
  marketValueLabel,
  worldRank,
  slug,
  href,
  size = "md",
  rarity,
  tier,
  className,
  compact = false,
  cutout = false,
}: PlayerBadgeProps) {
  const uid = useId().replace(/:/g, "");
  const resolvedRarity = rarity ?? tier ?? playerBadgeRarityFromRating(rating);
  const metal = PLAYER_BADGE_METALS[resolvedRarity];
  const dims = PLAYER_BADGE_SIZES[size];
  const abbrev = (positionAbbrev?.trim() || playerPositionAbbrev(positionName)).toUpperCase();
  const ratingLabel = rating != null && Number.isFinite(rating) ? String(Math.round(rating)) : "—";
  const valueLabel = marketValueLabel?.trim() || "—";
  const displayName = truncateName(name, size === "micro" || size === "sm" ? 16 : 22).toUpperCase();
  const clubLabel = cleanPlayerBadgeClubLabel(clubName);
  const link = href ?? (slug ? `/players/${slug}` : null);
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(imageUrl?.trim()) && !imgFailed;

  const body = (
    <article
      className={`pr-player-badge pr-player-badge--${size} pr-player-badge--${resolvedRarity}${
        compact ? " pr-player-badge--compact" : ""
      } ${className ?? ""}`.trim()}
      data-rarity={resolvedRarity}
      style={
        {
          width: dims.width,
          ["--pb-glow" as string]: metal.glow,
        } as CSSProperties
      }
    >
      <BadgeSvg
        uid={uid}
        metal={metal}
        name={name}
        displayName={displayName}
        ratingLabel={ratingLabel}
        abbrev={abbrev}
        showPhoto={showPhoto}
        imageUrl={imageUrl}
        onImgError={() => setImgFailed(true)}
        nationName={nationName}
        nationImageUrl={nationImageUrl}
        clubName={clubLabel}
        clubImageUrl={clubImageUrl}
        age={age}
        valueLabel={valueLabel}
        worldRank={worldRank}
        compact={compact}
        cutout={cutout}
        width={dims.width}
        height={dims.height}
      />
    </article>
  );

  if (link) {
    return (
      <Link href={link} className="pr-player-badge-link">
        {body}
      </Link>
    );
  }
  return body;
}

function BadgeSvg({
  uid,
  metal,
  name,
  displayName,
  ratingLabel,
  abbrev,
  showPhoto,
  imageUrl,
  onImgError,
  nationName,
  nationImageUrl,
  clubName,
  clubImageUrl,
  age,
  valueLabel,
  worldRank,
  compact,
  cutout,
  width,
  height,
}: {
  uid: string;
  metal: Metal;
  name: string;
  displayName: string;
  ratingLabel: string;
  abbrev: string;
  showPhoto: boolean;
  imageUrl?: string | null;
  onImgError: () => void;
  nationName?: string | null;
  nationImageUrl?: string | null;
  clubName?: string | null;
  clubImageUrl?: string | null;
  age?: number | null;
  valueLabel: string;
  worldRank?: number | null;
  compact: boolean;
  cutout: boolean;
  width: number;
  height: number;
}) {
  const g = {
    metal: `pb-${uid}-metal`,
    bevel: `pb-${uid}-bevel`,
    panel: `pb-${uid}-panel`,
    spotlight: `pb-${uid}-spot`,
    pattern: `pb-${uid}-pat`,
    clipOuter: `pb-${uid}-clip-o`,
    clipInner: `pb-${uid}-clip-i`,
    clipPhoto: `pb-${uid}-clip-p`,
    shadow: `pb-${uid}-shadow`,
    nameBar: `pb-${uid}-name`,
    infoBar: `pb-${uid}-info`,
    fade: `pb-${uid}-fade`,
  };

  const ageLabel = age != null && Number.isFinite(age) ? `${Math.round(age)} yrs` : null;
  const hasNation = Boolean(nationName?.trim() || nationImageUrl);
  const hasClub = Boolean(clubName?.trim());
  const metaBits = [hasNation, hasClub, Boolean(ageLabel)].filter(Boolean).length;

  return (
    <svg
      className="pr-player-badge__svg"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width={width}
      height={height}
      role="img"
      aria-label={`${name} · Rating ${ratingLabel} · ${abbrev}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={g.metal} x1="8%" y1="0%" x2="92%" y2="100%">
          <stop offset="0%" stopColor={metal.highlight} />
          <stop offset="20%" stopColor={metal.base} />
          <stop offset="52%" stopColor={metal.mid} />
          <stop offset="78%" stopColor={metal.shadow} />
          <stop offset="100%" stopColor={metal.deep} />
        </linearGradient>
        <linearGradient id={g.bevel} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={metal.highlight} stopOpacity="0.9" />
          <stop offset="40%" stopColor={metal.base} stopOpacity="0.25" />
          <stop offset="100%" stopColor={metal.deep} stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={g.panel} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1C1610" />
          <stop offset="35%" stopColor={metal.panel} />
          <stop offset="100%" stopColor="#040302" />
        </linearGradient>
        <radialGradient id={g.spotlight} cx="50%" cy="20%" r="55%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <pattern id={g.pattern} width="32" height="28" patternUnits="userSpaceOnUse">
          <path
            d="M16 0 L32 28 L0 28 Z"
            fill="none"
            stroke={metal.pattern}
            strokeWidth="0.9"
          />
          <path d="M16 8 L26 28 L6 28 Z" fill="none" stroke={metal.pattern} strokeWidth="0.55" />
        </pattern>
        <linearGradient id={g.nameBar} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#000" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.82" />
        </linearGradient>
        <linearGradient id={g.infoBar} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#C8C2B4" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#A8A294" stopOpacity="0.88" />
        </linearGradient>
        <linearGradient id={g.fade} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={metal.panel} stopOpacity="0" />
          <stop offset="100%" stopColor={metal.panel} stopOpacity="0.95" />
        </linearGradient>
        <filter id={g.shadow} x="-18%" y="-8%" width="136%" height="128%">
          <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#000" floodOpacity="0.48" />
        </filter>
        <clipPath id={g.clipOuter}>
          <path d={SHIELD_OUTER} />
        </clipPath>
        <clipPath id={g.clipInner}>
          <path d={SHIELD_INNER} />
        </clipPath>
        <clipPath id={g.clipPhoto}>
          <rect x="50" y="16" width="260" height="292" rx="2" />
        </clipPath>
      </defs>

      <g filter={`url(#${g.shadow})`}>
        {/* Metal frame */}
        <path d={SHIELD_OUTER} fill={`url(#${g.metal})`} />
        <path
          d={SHIELD_OUTER}
          fill="none"
          stroke={metal.highlight}
          strokeOpacity="0.65"
          strokeWidth="2.8"
        />
        <path d={SHIELD_INNER} fill={`url(#${g.bevel})`} opacity="0.32" />
        <path
          d={SHIELD_INNER}
          fill="none"
          stroke={metal.highlight}
          strokeOpacity="0.45"
          strokeWidth="1.5"
        />

        {/* Inner face + triangle motif */}
        <g clipPath={`url(#${g.clipInner})`}>
          <rect x="0" y="0" width={VB_W} height={VB_H} fill={`url(#${g.panel})`} />
          <rect x="48" y="14" width="264" height="310" fill={`url(#${g.pattern})`} opacity="0.9" />
          <rect x="48" y="14" width="264" height="310" fill={`url(#${g.spotlight})`} />
        </g>

        {/* Player photo / cutout */}
        <g clipPath={`url(#${g.clipOuter})`}>
          {showPhoto ? (
            <image
              href={imageUrl!}
              x={cutout ? "28" : "42"}
              y={cutout ? "-8" : "6"}
              width={cutout ? "304" : "276"}
              height={cutout ? "340" : "310"}
              preserveAspectRatio={cutout ? "xMidYMax meet" : "xMidYMin slice"}
              clipPath={cutout ? undefined : `url(#${g.clipPhoto})`}
              onError={onImgError}
            />
          ) : (
            <g transform="translate(100 42)" opacity="0.92">
              <ellipse cx="80" cy="55" rx="42" ry="46" fill="#1A2830" />
              <path
                d="M38 112c12-22 36-32 42-32s30 10 42 32c11 18 14 36 14 54v78H24v-78c0-18 3-36 14-54z"
                fill="#243440"
              />
              <ellipse
                cx="80"
                cy="55"
                rx="42"
                ry="46"
                fill="none"
                stroke={metal.accent}
                strokeOpacity="0.3"
                strokeWidth="2"
              />
            </g>
          )}
          {!cutout ? <rect x="48" y="248" width="264" height="72" fill={`url(#${g.fade})`} /> : null}
        </g>

        {/* Top rating + position */}
        <text
          x="70"
          y="76"
          fill="#fff"
          fontFamily="Montserrat, Inter, ui-sans-serif, system-ui, sans-serif"
          fontWeight={800}
          fontSize={50}
          letterSpacing="-1.8"
        >
          {ratingLabel}
        </text>
        <text
          x="290"
          y="70"
          fill="#fff"
          fontFamily="Montserrat, Inter, ui-sans-serif, system-ui, sans-serif"
          fontWeight={800}
          fontSize={24}
          textAnchor="end"
          letterSpacing="2.2"
        >
          {abbrev}
        </text>

        {/* Name bar */}
        <rect x="56" y="300" width="248" height="34" fill={`url(#${g.nameBar})`} />
        <text
          x="180"
          y="323"
          fill="#fff"
          fontFamily="Montserrat, Inter, ui-sans-serif, system-ui, sans-serif"
          fontWeight={800}
          fontSize={displayName.length > 16 ? 12.5 : 14.5}
          textAnchor="middle"
          letterSpacing="0.5"
        >
          {displayName}
        </text>

        {!compact ? (
          <>
            {/* Flag · Club · Age — light strip like mock */}
            <rect x="56" y="334" width="248" height="28" fill={`url(#${g.infoBar})`} />
            <g transform="translate(0 334)">
              {(() => {
                const flagW = hasNation ? 20 : 0;
                const clubText = clubName ? truncateName(clubName, metaBits > 2 ? 13 : 18) : "";
                const clubApprox = clubText.length * 5.8;
                const ageApprox = ageLabel ? ageLabel.length * 5.8 : 0;
                const gaps = Math.max(0, metaBits - 1) * 12;
                const totalW =
                  flagW + (hasClub ? (hasNation ? 0 : 18) + clubApprox : 0) + (ageLabel ? ageApprox : 0) + gaps;
                let x = Math.max(64, (VB_W - totalW) / 2);

                const nodes: ReactNode[] = [];
                if (hasNation) {
                  if (nationImageUrl) {
                    nodes.push(
                      <image
                        key="flag"
                        href={nationImageUrl}
                        x={x}
                        y="7"
                        width="20"
                        height="14"
                        preserveAspectRatio="xMidYMid slice"
                      />,
                    );
                  } else {
                    nodes.push(
                      <rect
                        key="flag"
                        x={x}
                        y="7"
                        width="20"
                        height="14"
                        rx="1.5"
                        fill="#4A5560"
                        opacity="0.55"
                      />,
                    );
                  }
                  x += 20;
                }

                if (hasNation && (hasClub || ageLabel)) {
                  nodes.push(
                    <line
                      key="d1"
                      x1={x + 5}
                      y1="6"
                      x2={x + 5}
                      y2="22"
                      stroke="rgba(40,36,30,0.35)"
                      strokeWidth="1"
                    />,
                  );
                  x += 12;
                }

                if (hasClub) {
                  if (!hasNation && clubImageUrl) {
                    nodes.push(
                      <image
                        key="crest"
                        href={clubImageUrl}
                        x={x}
                        y="6"
                        width="16"
                        height="16"
                        preserveAspectRatio="xMidYMid meet"
                      />,
                    );
                    x += 18;
                  }
                  nodes.push(
                    <text
                      key="club"
                      x={x}
                      y="19"
                      fill="#1A1814"
                      fontFamily="Montserrat, Inter, ui-sans-serif, system-ui, sans-serif"
                      fontWeight={700}
                      fontSize={11}
                    >
                      {clubText}
                    </text>,
                  );
                  x += clubApprox + 2;
                }

                if ((hasNation || hasClub) && ageLabel) {
                  nodes.push(
                    <line
                      key="d2"
                      x1={x + 4}
                      y1="6"
                      x2={x + 4}
                      y2="22"
                      stroke="rgba(40,36,30,0.35)"
                      strokeWidth="1"
                    />,
                  );
                  x += 12;
                }

                if (ageLabel) {
                  nodes.push(
                    <text
                      key="age"
                      x={x}
                      y="19"
                      fill="#1A1814"
                      fontFamily="Montserrat, Inter, ui-sans-serif, system-ui, sans-serif"
                      fontWeight={700}
                      fontSize={11}
                    >
                      {ageLabel}
                    </text>,
                  );
                }

                return nodes;
              })()}
            </g>

            {/* RATING / VALUE — open panel in tip (no heavy box) */}
            <line x1="180" y1="378" x2="180" y2="438" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" />
            <text
              x="126"
              y="392"
              fill="rgba(220,220,210,0.72)"
              fontFamily="Montserrat, Inter, ui-sans-serif, system-ui, sans-serif"
              fontWeight={700}
              fontSize={9}
              textAnchor="middle"
              letterSpacing="2"
            >
              RATING
            </text>
            <text
              x="126"
              y="422"
              fill="#fff"
              fontFamily="Montserrat, Inter, ui-sans-serif, system-ui, sans-serif"
              fontWeight={800}
              fontSize={26}
              textAnchor="middle"
            >
              {ratingLabel}
            </text>
            <text
              x="234"
              y="392"
              fill="rgba(220,220,210,0.72)"
              fontFamily="Montserrat, Inter, ui-sans-serif, system-ui, sans-serif"
              fontWeight={700}
              fontSize={9}
              textAnchor="middle"
              letterSpacing="2"
            >
              VALUE
            </text>
            <text
              x="234"
              y="422"
              fill="#fff"
              fontFamily="Montserrat, Inter, ui-sans-serif, system-ui, sans-serif"
              fontWeight={800}
              fontSize={valueLabel.length > 6 ? 15 : 20}
              textAnchor="middle"
            >
              {valueLabel}
            </text>

            {/* World ranking in tip */}
            <text
              x="180"
              y="462"
              fill="#fff"
              fontFamily="Montserrat, Inter, ui-sans-serif, system-ui, sans-serif"
              fontWeight={700}
              fontSize={11}
              textAnchor="middle"
              letterSpacing="0.3"
            >
              {worldRank != null ? `#${worldRank} World Ranking` : "Rugby365"}
            </text>
          </>
        ) : (
          <text
            x="180"
            y="368"
            fill={metal.accent}
            fontFamily="Montserrat, Inter, ui-sans-serif, system-ui, sans-serif"
            fontWeight={800}
            fontSize={20}
            textAnchor="middle"
          >
            {ratingLabel}
          </text>
        )}
      </g>
    </svg>
  );
}
