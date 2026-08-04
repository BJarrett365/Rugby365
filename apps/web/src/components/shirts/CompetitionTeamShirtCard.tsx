import Link from "next/link";
import { ApprovedRugbyShirt } from "@/components/shirts/ApprovedRugbyShirt";
import type { PublicShirtTeamCard } from "@/lib/shirt-library-public-service";

function ShirtSlot({
  label,
  shirt,
  crestUrl,
}: {
  label: string;
  shirt: PublicShirtTeamCard["home"];
  crestUrl: string | null;
}) {
  return (
    <div className="slp__shirt-slot">
      <span className="slp__shirt-label">{label}</span>
      {shirt ? (
        <ApprovedRugbyShirt config={shirt.svgConfig} size={96} crestUrl={crestUrl} title={label} />
      ) : (
        <div className="slp__awaiting">Shirt Awaiting Approval</div>
      )}
    </div>
  );
}

export function CompetitionTeamShirtCard({ team }: { team: PublicShirtTeamCard }) {
  const flagUrl = team.countryIso
    ? `https://flagcdn.com/w40/${team.countryIso.toLowerCase()}.png`
    : null;

  return (
    <article className="slp__card">
      <div className="slp__card-head">
        {team.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="slp__card-logo" src={team.imageUrl} alt="" />
        ) : (
          <div className="slp__card-logo" />
        )}
        <div>
          <h3 className="slp__card-name">
            <Link href={team.clubHref}>{team.name}</Link>
          </h3>
          <p className="slp__card-country">
            {flagUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={flagUrl} alt="" width={18} height={12} />
            ) : null}
            {team.countryName ?? "—"}
          </p>
        </div>
      </div>

      <div className="slp__shirts">
        <ShirtSlot label="Home" shirt={team.home} crestUrl={team.imageUrl} />
        <ShirtSlot label="Away" shirt={team.away} crestUrl={team.imageUrl} />
      </div>
      {team.third ? (
        <div className="slp__shirts" style={{ gridTemplateColumns: "1fr" }}>
          <ShirtSlot label="Third" shirt={team.third} crestUrl={team.imageUrl} />
        </div>
      ) : null}

      <p className="slp__card-country" style={{ margin: 0 }}>
        {team.statusLabel}
      </p>

      <div className="slp__card-actions">
        <Link className="slp__btn slp__btn--primary" href={team.clubHref}>
          View Club
        </Link>
        <Link className="slp__btn" href={team.detailHref}>
          View Shirt Details
        </Link>
      </div>
    </article>
  );
}
