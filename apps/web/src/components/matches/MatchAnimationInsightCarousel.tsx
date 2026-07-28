"use client";

import { useEffect, useState } from "react";
import { TeamCrest } from "./TeamCrest";
import { MediaImage } from "@/components/media/MediaImage";
import type { MatchAnimationPublicPayload } from "@/lib/match-animation-types";
import {
  buildMatchControlRows,
  buildSetPieceDefenceRows,
  type InsightCarouselCard,
} from "@/lib/match-animation-insight";

type Props = {
  payload: MatchAnimationPublicPayload;
  mode: "half_time" | "full_time";
  reducedMotion?: boolean;
};

function countCards(
  events: MatchAnimationPublicPayload["events"],
): { homeYellow: number; awayYellow: number; homeRed: number; awayRed: number } {
  let homeYellow = 0;
  let awayYellow = 0;
  let homeRed = 0;
  let awayRed = 0;
  for (const e of events) {
    const t = e.eventType.toLowerCase();
    if (t.includes("yellow") || t.includes("sin")) {
      if (e.teamSide === "home") homeYellow += 1;
      if (e.teamSide === "away") awayYellow += 1;
    }
    if (/\bred\b/.test(t) || t.includes("red_card")) {
      if (e.teamSide === "home") homeRed += 1;
      if (e.teamSide === "away") awayRed += 1;
    }
  }
  return { homeYellow, awayYellow, homeRed, awayRed };
}

function buildScorerLines(payload: MatchAnimationPublicPayload): string[] {
  const lines: string[] = [];
  for (const e of payload.events) {
    const t = e.eventType.toLowerCase();
    if (!/try|penalty|drop|conversion/.test(t)) continue;
    if (t.includes("miss")) continue;
    const who = e.playerName?.trim() || (e.teamSide === "home" ? "Home" : e.teamSide === "away" ? "Away" : "Unknown");
    const kind = t.includes("try")
      ? "Try"
      : t.includes("drop")
        ? "DG"
        : t.includes("conversion")
          ? "Con"
          : "Pen";
    lines.push(`${e.minute}' ${kind} — ${who}`);
  }
  return lines.slice(0, 12);
}

export function buildInsightCarouselCards(
  payload: MatchAnimationPublicPayload,
  mode: "half_time" | "full_time",
): InsightCarouselCard[] {
  const cards: InsightCarouselCard[] = [];
  const { home, away, teamStats } = payload;
  const cardsCount = countCards(payload.events);

  // At full time the dedicated FT panel already shows the scoreline + MOTM —
  // keep the carousel for extras (scorers, stats, venue) only.
  if (mode === "half_time") {
    cards.push({
      id: "result",
      title: "HALF-TIME",
      scoreline: {
        home: payload.halfTimeHome ?? payload.homeScore,
        away: payload.halfTimeAway ?? payload.awayScore,
        label: "Half-time",
      },
    });
  }

  const scorers = buildScorerLines(payload);
  if (scorers.length) {
    cards.push({
      id: "scorers",
      title: "SCORERS",
      body: scorers.join("\n"),
    });
  }

  if (mode === "half_time" && payload.playerOfTheMatch) {
    const side =
      payload.playerOfTheMatchTeamSide === "away"
        ? away
        : payload.playerOfTheMatchTeamSide === "home"
          ? home
          : null;
    cards.push({
      id: "motm",
      title: "MAN OF THE MATCH",
      motm: {
        name: payload.playerOfTheMatch,
        imageUrl: payload.playerOfTheMatchImageUrl,
        teamName: side?.name ?? null,
        rating: null,
        stats: [],
      },
    });
  }

  const control = buildMatchControlRows(teamStats.home, teamStats.away);
  if (control.length) {
    cards.push({ id: "control", title: "MATCH CONTROL", rows: control });
  }

  const setPiece = buildSetPieceDefenceRows(teamStats.home, teamStats.away, cardsCount);
  if (setPiece.length) {
    cards.push({
      id: "set_piece",
      title: mode === "half_time" ? "SET PIECE & DEFENCE" : "SET PIECE & DISCIPLINE",
      rows: setPiece,
    });
  }

  if (payload.venue || payload.homeCoachName || payload.awayCoachName) {
    cards.push({
      id: "venue",
      title: "VENUE & CONDITIONS",
      venue: {
        name: payload.venue?.name ?? payload.venueName ?? "Venue TBC",
        city: payload.venue?.city ?? null,
        country: payload.venue?.country ?? null,
        capacity: payload.venue?.capacity ?? null,
        homeCoach: payload.homeCoachName,
        awayCoach: payload.awayCoachName,
        attendance: payload.attendance,
        weather: payload.weather,
      },
    });
  }

  return cards;
}

/** Swipeable HT / FT insight cards over the pitch — rugby stats only, hide empties. */
export function MatchAnimationInsightCarousel({
  payload,
  mode,
  reducedMotion = false,
}: Props) {
  const cards = buildInsightCarouselCards(payload, mode);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [payload.matchId, mode, cards.length]);

  useEffect(() => {
    if (reducedMotion || cards.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % cards.length);
    }, 8000);
    return () => window.clearInterval(id);
  }, [cards.length, reducedMotion, payload.matchId, mode]);

  if (!cards.length) return null;
  const card = cards[Math.min(index, cards.length - 1)]!;
  const { home, away } = payload;

  return (
    <div className="pr-ma-insight" aria-live="polite">
      <article className="pr-ma-insight__card">
        <h3 className="pr-ma-insight__title">{card.title}</h3>

        {card.scoreline ? (
          <div className="pr-ma-insight__scoreline">
            <span className="pr-ma-insight__side">
              <TeamCrest name={home.name} imageUrl={home.imageUrl} size="md" labelled />
              <span>{home.shortName}</span>
            </span>
            <strong className="pr-ma-insight__score">
              {card.scoreline.home} – {card.scoreline.away}
            </strong>
            <span className="pr-ma-insight__side pr-ma-insight__side--away">
              <TeamCrest name={away.name} imageUrl={away.imageUrl} size="md" labelled />
              <span>{away.shortName}</span>
            </span>
          </div>
        ) : null}

        {card.motm ? (
          <div className="pr-ma-insight__motm">
            {card.motm.imageUrl ? (
              <MediaImage
                src={card.motm.imageUrl}
                alt=""
                width={72}
                height={72}
                className="pr-ma-insight__motm-photo"
              />
            ) : (
              <span className="pr-ma-insight__motm-fallback" aria-hidden>
                ★
              </span>
            )}
            <div>
              <p className="pr-ma-insight__motm-name">{card.motm.name}</p>
              {card.motm.teamName ? (
                <p className="pr-ma-insight__motm-team">{card.motm.teamName}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {card.rows?.length ? (
          <ul className="pr-ma-insight__rows">
            {card.rows.map((row) => (
              <li key={row.label} className="pr-ma-insight__row">
                <span className="pr-ma-insight__home">{row.home}</span>
                <span className="pr-ma-insight__label">{row.label}</span>
                <span className="pr-ma-insight__away">{row.away}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {card.body ? (
          <pre className="pr-ma-insight__body">{card.body}</pre>
        ) : null}

        {card.venue ? (
          <div className="pr-ma-insight__venue">
            <p className="pr-ma-insight__venue-name">{card.venue.name}</p>
            {[card.venue.city, card.venue.country].filter(Boolean).length ? (
              <p>{[card.venue.city, card.venue.country].filter(Boolean).join(", ")}</p>
            ) : null}
            {card.venue.weather &&
            (card.venue.weather.temperatureC != null ||
              card.venue.weather.windSpeedKmh != null) ? (
              <p className="pr-ma-insight__weather">
                {[
                  card.venue.weather.temperatureC != null
                    ? `${Math.round(card.venue.weather.temperatureC)}°C`
                    : null,
                  card.venue.weather.windSpeedKmh != null
                    ? `Wind ${Math.round(card.venue.weather.windSpeedKmh)} km/h${
                        card.venue.weather.windCompass
                          ? ` ${card.venue.weather.windCompass}`
                          : ""
                      }`
                    : null,
                  card.venue.weather.humidityPct != null
                    ? `Humidity ${card.venue.weather.humidityPct}%`
                    : null,
                  card.venue.weather.precipitationMm != null &&
                  card.venue.weather.precipitationMm > 0
                    ? `Rain ${card.venue.weather.precipitationMm} mm`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : (
              <p className="pr-ma-insight__weather pr-ma-insight__weather--empty">
                Weather / wind (no venue GEO yet)
              </p>
            )}
            {card.venue.capacity != null ? (
              <p>Capacity {card.venue.capacity.toLocaleString("en-GB")}</p>
            ) : null}
            {card.venue.attendance != null ? (
              <p>Attendance {card.venue.attendance.toLocaleString("en-GB")}</p>
            ) : null}
            {(card.venue.homeCoach || card.venue.awayCoach) && (
              <p className="pr-ma-insight__coaches">
                {[
                  card.venue.homeCoach ? `${home.shortName}: ${card.venue.homeCoach}` : null,
                  card.venue.awayCoach ? `${away.shortName}: ${card.venue.awayCoach}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        ) : null}
      </article>

      {cards.length > 1 ? (
        <div className="pr-ma-insight__dots" role="tablist" aria-label="Insight cards">
          {cards.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`pr-ma-insight__dot${i === index ? " is-active" : ""}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
