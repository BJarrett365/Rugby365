import Link from "next/link";

export type PlayerBreadcrumbItem = {
  label: string;
  href?: string;
};

export function PlayerPublicBreadcrumb({ items }: { items: PlayerBreadcrumbItem[] }) {
  return (
    <nav className="pr-player-v2__breadcrumb" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`}>
            {i > 0 ? <span aria-hidden>›</span> : null}
            {item.href && !last ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
          </span>
        );
      })}
    </nav>
  );
}
