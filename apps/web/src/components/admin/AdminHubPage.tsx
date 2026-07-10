import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import type { AdminHubLink } from "@/lib/admin-nav";

type AdminHubPageProps = {
  eyebrow?: string;
  title: string;
  description: string;
  links: AdminHubLink[];
};

export function AdminHubPage({ eyebrow = "Keys", title, description, links }: AdminHubPageProps) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="cms-grid-2 lg:grid-cols-3">
        {links.map((item) => (
          <Link key={item.href} href={item.href} className="cms-card cms-card--link">
            <div className="flex items-start justify-between gap-3">
              <h2 className="cms-card__title m-0 text-base">{item.title}</h2>
              {item.status ? (
                <span className={`cms-status cms-status--${statusClass(item.status)}`}>
                  {item.status}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-zinc-500 m-0 mt-2 leading-relaxed">{item.description}</p>
            <p className="text-xs font-semibold text-emerald-400 m-0 mt-4 uppercase tracking-wide">
              Open →
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}

function statusClass(status: AdminHubLink["status"]) {
  switch (status) {
    case "Live":
      return "success";
    case "API":
      return "warning";
    default:
      return "neutral";
  }
}
