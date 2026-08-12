import Link from "next/link";

export type CoachBreadcrumbItem = {
  label: string;
  href?: string;
};

export function CoachPublicBreadcrumb({ items }: { items: CoachBreadcrumbItem[] }) {
  return (
    <nav className="pr-coach-breadcrumb" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="pr-coach-breadcrumb__item">
            {i > 0 ? <span className="pr-coach-breadcrumb__sep">›</span> : null}
            {item.href && !last ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span className={last ? "is-current" : undefined}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
