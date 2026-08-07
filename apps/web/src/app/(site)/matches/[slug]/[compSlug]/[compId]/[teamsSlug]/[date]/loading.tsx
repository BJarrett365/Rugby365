export default function MatchDetailLoading() {
  return (
    <div className="pr-match-centre match-detail" aria-busy="true">
      <nav aria-label="Breadcrumb">
        <ol className="pr-mc-breadcrumbs">
          <li>Home</li>
          <li className="pr-mc-breadcrumbs__sep" aria-hidden>
            &gt;
          </li>
          <li>Scores &amp; Fixtures</li>
          <li className="pr-mc-breadcrumbs__sep" aria-hidden>
            &gt;
          </li>
          <li className="pr-mc-breadcrumbs__current">Loading match…</li>
        </ol>
      </nav>
      <div className="pr-mc-shell">
        <div className="pr-mc-main">
          <header className="pr-mc-header">
            <h1 className="pr-mc-header__title">Loading match…</h1>
            <p style={{ color: "var(--pr-mc-grey, #a7adac)", margin: "0.75rem 0 0" }}>
              Fetching teams, scores and match details.
            </p>
          </header>
        </div>
      </div>
    </div>
  );
}
