import Link from "next/link";
import type { ReactNode } from "react";

export function PublicEntityPreviewBanner({ preview }: { preview: boolean }) {
  if (!preview) return null;
  return (
    <p className="pr-player-preview-banner" role="status">
      Preview mode — this profile may not be published yet. Not for indexing.
    </p>
  );
}

export function PublicEntityBreadcrumbs({
  items,
}: {
  items: Array<{ href?: string; label: string; current?: boolean }>;
}) {
  return (
    <nav className="pr-mc-breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="contents">
          {index > 0 ? <span aria-hidden>/</span> : null}
          {item.href && !item.current ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span aria-current={item.current ? "page" : undefined}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PublicEntityAvatar({
  name,
  imageUrl,
  size = 96,
}: {
  name: string;
  imageUrl: string | null | undefined;
  size?: number;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        className="pr-entity-avatar"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="pr-entity-avatar pr-entity-avatar--placeholder"
      style={{ width: size, height: size }}
    >
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </div>
  );
}

export function PublicEntityFact({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="pr-player-fact">
      <dt>{label}</dt>
      <dd>{value != null && String(value).trim() ? value : "—"}</dd>
    </div>
  );
}

export function PublicEntitySection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="pr-entity-section">
      <h2 className="pr-entity-section__title">{title}</h2>
      {children}
    </section>
  );
}
