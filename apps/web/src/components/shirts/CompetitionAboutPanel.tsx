export function CompetitionAboutPanel({
  title,
  about,
}: {
  title: string;
  about: string;
}) {
  return (
    <section className="slp__panel">
      <h2 className="slp__section-title">{title}</h2>
      <p>{about}</p>
    </section>
  );
}
