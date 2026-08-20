import Link from "next/link";
import type { PublicVenueCard } from "@/lib/public-venue-product-types";
import {
  formatCapacity,
  formatOpened,
  formatRating,
} from "@/lib/public-venue-product-math";

export function VenueDash() {
  return <span className="pr-venues__dash">—</span>;
}

function formatSurface(surface: string | null): string {
  if (!surface?.trim()) return "—";
  return surface.trim();
}

export function VenueCard({
  venue,
  compact = false,
}: {
  venue: PublicVenueCard;
  compact?: boolean;
}) {
  const loc = [venue.city, venue.countryName].filter(Boolean).join(", ");
  const cap = venue.rugbyCapacity ?? venue.capacity;
  const rankClass =
    venue.rank === 1 ? "pr-venues__rank is-gold" : "pr-venues__rank";

  return (
    <article className={`pr-venues__card${compact ? " is-compact" : ""}`}>
      <Link href={`/venues/${venue.slug}`} className="pr-venues__card-link">
        <div
          className="pr-venues__card-media"
          aria-hidden
          style={
            venue.imageUrl
              ? {
                  backgroundImage: `url(${venue.imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <span className={rankClass}>{venue.rank}</span>
          <span className="pr-venues__rating">
            <span className="pr-venues__rating-star" aria-hidden>
              ★
            </span>
            {venue.r365Rating != null ? (
              formatRating(venue.r365Rating)
            ) : venue.rankSource === "editorial" ? (
              <span className="pr-venues__rating-tag">Editorial</span>
            ) : (
              <VenueDash />
            )}
          </span>
        </div>
        <div className="pr-venues__card-body">
          <h3 className="pr-venues__card-name">{venue.name}</h3>
          <p className="pr-venues__card-loc">
            {venue.flagUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={venue.flagUrl} alt="" className="pr-venues__flag" width={16} height={12} />
            ) : null}
            <span>{loc || "Location unknown"}</span>
          </p>
          <dl className="pr-venues__card-stats">
            <div>
              <dt>Capacity</dt>
              <dd>{formatCapacity(cap)}</dd>
            </div>
            <div>
              <dt>Opened</dt>
              <dd>{formatOpened(venue.openedYear)}</dd>
            </div>
            <div>
              <dt>Surface</dt>
              <dd>{formatSurface(venue.surface)}</dd>
            </div>
          </dl>
        </div>
      </Link>
    </article>
  );
}

export function VenueMiniList({
  venues,
  valueKey,
}: {
  venues: PublicVenueCard[];
  valueKey: "capacity" | "remotenessKm";
}) {
  return (
    <ul className="pr-venues__mini-list">
      {venues.map((v) => {
        const loc = [v.city, v.countryName].filter(Boolean).join(", ");
        const val =
          valueKey === "capacity"
            ? formatCapacity(v.rugbyCapacity ?? v.capacity)
            : v.remotenessKm != null
              ? `${v.remotenessKm.toLocaleString("en-GB")} km`
              : "—";
        return (
          <li key={v.id}>
            <Link href={`/venues/${v.slug}`}>
              <span
                className="pr-venues__mini-thumb"
                style={
                  v.imageUrl
                    ? { backgroundImage: `url(${v.imageUrl})`, backgroundSize: "cover" }
                    : undefined
                }
                aria-hidden
              />
              <span className="pr-venues__mini-rank">{v.rank}</span>
              <span className="pr-venues__mini-copy">
                <p className="pr-venues__mini-name">{v.name}</p>
                <p className="pr-venues__mini-sub">{loc || "—"}</p>
              </span>
              <span className="pr-venues__mini-val">{val}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function VenueSimpleMap({
  markers,
}: {
  markers: Array<{
    id: string;
    slug: string;
    name: string;
    latitude: number;
    longitude: number;
  }>;
}) {
  if (markers.length === 0) {
    return (
      <p className="pr-venues__map-empty">
        No geocoded venues in this set yet — markers appear only when latitude and longitude are
        stored.
      </p>
    );
  }

  return (
    <div className="pr-venues__map" role="img" aria-label={`${markers.length} venue locations`}>
      {markers.map((m) => {
        const left = ((m.longitude + 180) / 360) * 100;
        const top = ((90 - m.latitude) / 180) * 100;
        return (
          <Link
            key={m.id}
            href={`/venues/${m.slug}`}
            className="pr-venues__map-dot"
            style={{ left: `${left}%`, top: `${top}%` }}
            title={m.name}
          >
            <span className="sr-only">{m.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
