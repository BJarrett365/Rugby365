import Link from "next/link";
import { listPublishedShirtLibraryCompetitions } from "@/lib/shirt-library-public-service";
import "@/styles/shirt-library-public.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shirt Library · Rugby365",
  description:
    "Approved Rugby365 home and away shirt designs by competition and season — sponsor-free pitch graphics.",
};

export default async function ShirtLibraryLandingPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    region?: string;
    approved?: string;
    season?: string;
    country?: string;
  }>;
}) {
  const sp = await searchParams;
  const cards = await listPublishedShirtLibraryCompetitions();

  const filtered = cards.filter((c) => {
    if (sp.type) {
      const type = (c.competitionType ?? "").toLowerCase();
      const want = sp.type.toLowerCase();
      if (want === "club") {
        if (type === "international") return false;
      } else if (want === "cross-border") {
        if (type !== "european" && !(c.region && !c.countryName)) return false;
      } else if (type !== want) {
        return false;
      }
    }
    if (sp.region) {
      const hay = `${c.region ?? ""} ${c.countryName ?? ""} ${c.catalogGroup ?? ""}`.toLowerCase();
      if (!hay.includes(sp.region.toLowerCase())) return false;
    }
    if (sp.country) {
      const hay = (c.countryName ?? "").toLowerCase();
      if (!hay.includes(sp.country.toLowerCase())) return false;
    }
    if (sp.season && c.seasonLabel !== sp.season) return false;
    if (sp.approved === "full" && c.readinessPct < 100) return false;
    if (sp.approved === "part" && (c.readinessPct <= 0 || c.readinessPct >= 100)) return false;
    return true;
  });

  const typeFilters = ["international", "domestic", "european", "club"];
  const regions = [
    ...new Set(
      cards
        .map((c) => c.region || c.catalogGroup || c.countryName)
        .filter((v): v is string => Boolean(v)),
    ),
  ].slice(0, 12);
  const seasons = [...new Set(cards.map((c) => c.seasonLabel).filter(Boolean))].slice(0, 8);

  return (
    <div className="slp">
      <header className="slp__header">
        <div className="slp__brand">Rugby365 Shirt Library</div>
        <h1 className="slp__title">Competition shirt guides</h1>
        <p className="slp__subtitle">
          Published, season-fixed home and away designs approved for Rugby365 pitch graphics.
        </p>
      </header>

      <div className="slp__filters">
        <Link
          className={`slp__filter${!sp.type && !sp.approved && !sp.region ? " slp__filter--active" : ""}`}
          href="/shirt-library"
        >
          All
        </Link>
        {typeFilters.map((t) => (
          <Link
            key={t}
            className={`slp__filter${sp.type === t ? " slp__filter--active" : ""}`}
            href={`/shirt-library?type=${t}`}
          >
            {t}
          </Link>
        ))}
        <Link
          className={`slp__filter${sp.approved === "full" ? " slp__filter--active" : ""}`}
          href="/shirt-library?approved=full"
        >
          Fully approved
        </Link>
        <Link
          className={`slp__filter${sp.approved === "part" ? " slp__filter--active" : ""}`}
          href="/shirt-library?approved=part"
        >
          Partly approved
        </Link>
        <Link
          className={`slp__filter${sp.type === "cross-border" ? " slp__filter--active" : ""}`}
          href="/shirt-library?type=cross-border"
        >
          Cross-border
        </Link>
        {seasons.map((s) => (
          <Link
            key={s}
            className={`slp__filter${sp.season === s ? " slp__filter--active" : ""}`}
            href={`/shirt-library?season=${encodeURIComponent(s)}`}
          >
            {s}
          </Link>
        ))}
        {regions.map((r) => (
          <Link
            key={r}
            className={`slp__filter${sp.region === r ? " slp__filter--active" : ""}`}
            href={`/shirt-library?region=${encodeURIComponent(r)}`}
          >
            {r}
          </Link>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="slp__empty">
          <p>No published competition shirt guides yet.</p>
          <p style={{ fontSize: "0.9rem" }}>
            Publish a season from Admin → Shirt Library to make it public.
          </p>
        </div>
      ) : (
        <div className="slp__landing-grid">
          {filtered.map((c) => (
            <Link key={`${c.competitionId}-${c.seasonId}`} className="slp__landing-card" href={c.href}>
              <div className="slp__brand">{c.competitionType ?? "Competition"}</div>
              <h2 className="slp__card-name" style={{ fontSize: "1.15rem" }}>
                {c.name}
              </h2>
              <p className="slp__card-country">
                {[c.countryName, c.region, c.catalogGroup].filter(Boolean).join(" · ") || "—"}
              </p>
              <p className="slp__card-country">{c.seasonLabel}</p>
              <p className="slp__card-country">
                {c.teamCount} teams · {c.approvedShirtCount} shirts approved · {c.readinessPct}%
                ready
              </p>
              <span className="slp__btn slp__btn--primary" style={{ justifySelf: "start" }}>
                View competition
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
