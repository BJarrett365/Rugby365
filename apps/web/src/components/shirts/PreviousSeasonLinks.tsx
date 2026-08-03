import Link from "next/link";

export function PreviousSeasonLinks({
  seasons,
}: {
  seasons: Array<{ id: string; label: string; href: string }>;
}) {
  if (!seasons.length) return null;
  return (
    <section className="slp__section">
      <h2 className="slp__section-title">Previous seasons</h2>
      <div className="slp__season-links">
        {seasons.map((s) => (
          <Link key={s.id} className="slp__btn" href={s.href}>
            {s.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
