"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ADMIN_BOTTOM_NAV,
  ADMIN_HUB_KEYS,
  ADMIN_NAV_SECTIONS,
  hubKeyActive,
  isNavItemActive,
  navItemActive,
  type AdminNavItem,
  type AdminNavSection,
} from "@/lib/admin-nav";

function NavLink({
  item,
  active,
  className,
  onNavigate,
}: {
  item: AdminNavItem;
  active: boolean;
  className: string;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      className={`${className} touch-target${active ? ` ${className}--active` : ""}`}
      onClick={onNavigate}
    >
      <span className="admin-shell__nav-full">{item.label}</span>
      <span className="admin-shell__nav-short">{item.short}</span>
    </Link>
  );
}

function NavSection({
  section,
  pathname,
  linkClassName,
  onNavigate,
}: {
  section: AdminNavSection;
  pathname: string;
  linkClassName: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="admin-shell__nav-group">
      {section.label ? (
        <p className="admin-shell__nav-group-label" aria-hidden="true">
          {section.label}
        </p>
      ) : null}
      {section.items.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          active={isNavItemActive(pathname, item, section.id)}
          className={linkClassName}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

function bottomNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  const hubKey = ADMIN_HUB_KEYS.find((k) => k.href === href);
  if (hubKey) return hubKeyActive(pathname, hubKey);
  return navItemActive(pathname, href);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="admin-shell" data-cms-theme="planet-rugby">
      <header className="admin-shell__header no-print">
        <div className="admin-shell__header-row">
          <Link href="/admin" className="admin-shell__brand">
            Rugby365 CMS
          </Link>
          <button
            type="button"
            className="admin-shell__menu-btn touch-target"
            aria-expanded={menuOpen}
            aria-controls="admin-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            Menu
          </button>
        </div>
        <nav
          id="admin-nav"
          className={`admin-shell__nav ${menuOpen ? "admin-shell__nav--open" : ""}`}
          aria-label="Admin"
        >
          {ADMIN_NAV_SECTIONS.map((section) => (
            <NavSection
              key={section.id}
              section={section}
              pathname={pathname}
              linkClassName="admin-shell__nav-link"
              onNavigate={closeMenu}
            />
          ))}
        </nav>
      </header>
      <div className="admin-shell__body">
        <aside className="admin-shell__sidebar no-print" aria-label="Admin sidebar">
          {ADMIN_NAV_SECTIONS.map((section) => (
            <NavSection
              key={section.id}
              section={section}
              pathname={pathname}
              linkClassName="admin-shell__sidebar-link"
            />
          ))}
        </aside>
        <div className="admin-shell__content">{children}</div>
      </div>
      <nav className="admin-shell__bottom-nav no-print" aria-label="Admin mobile">
        {ADMIN_BOTTOM_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`admin-shell__bottom-link touch-target${bottomNavActive(pathname, item.href) ? " admin-shell__bottom-link--active" : ""}`}
          >
            {item.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
