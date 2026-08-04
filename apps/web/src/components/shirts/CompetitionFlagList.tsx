import type { CompetitionFlag } from "@/lib/shirt-library-public-service";

export function CompetitionFlagList({ flags }: { flags: CompetitionFlag[] }) {
  if (!flags.length) return null;
  return (
    <section className="slp__section">
      <h2 className="slp__section-title">Countries &amp; regions</h2>
      <div className="slp__flags">
        {flags.map((f) => (
          <span key={f.countryName} className="slp__flag">
            {f.flagUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.flagUrl} alt="" width={20} height={14} loading="lazy" />
            ) : null}
            {f.countryName}
          </span>
        ))}
      </div>
    </section>
  );
}
