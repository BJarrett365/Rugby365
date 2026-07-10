import Link from "next/link";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/matches", label: "Matches" },
  { href: "/matches/demo-sa-barb/commentary", label: "Live" },
  { href: "/display/tv/demo-sa-barb/commentary", label: "TV" },
  { href: "/admin/operator", label: "CMS" },
];

export function AppShell({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "minimal" | "tv";
}) {
  if (variant === "minimal") {
    return <div className="app-shell app-shell--minimal">{children}</div>;
  }

  if (variant === "tv") {
    return (
      <div className="app-shell app-shell--tv">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <main id="main" className="app-shell__main app-shell__main--tv">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="app-shell__topbar no-print">
        <Link href="/" className="app-shell__brand">
          Rugby365
        </Link>
        <nav className="app-shell__nav" aria-label="Primary">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="app-shell__nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main" className="app-shell__main">
        {children}
      </main>
      <footer className="app-shell__footer no-print">
        <p>Rugby365 — Mobile · Tablet · Desktop · App · TV · Print</p>
      </footer>
    </div>
  );
}
