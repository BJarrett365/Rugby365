"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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
  if (href === "/matches") {
    return pathname === "/matches" || pathname.startsWith("/matches/");
  }
  if (href === "/admin") return pathname === "/admin";
  const hubKey = ADMIN_HUB_KEYS.find((k) => k.href === href);
  if (hubKey) return hubKeyActive(pathname, hubKey);
  return navItemActive(pathname, href);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const embed = searchParams.get("embed") === "1";
  const [menuOpen, setMenuOpen] = useState(false);
  // Active nav classes only after mount — keeps SSR markup identical to the first client paint.
  const [navReady, setNavReady] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    setNavReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("pr-embed-mode", embed);
    return () => document.documentElement.classList.remove("pr-embed-mode");
  }, [embed]);

  const activePath = navReady ? pathname : "";

  if (embed) {
    return (
      <div className="admin-shell admin-shell--embed" data-cms-theme="planet-rugby">
        <div className="admin-shell__content admin-shell__content--embed">{children}</div>
      </div>
    );
  }

  return (
    <div className="admin-shell" data-cms-theme="planet-rugby">
      <header className="admin-shell__header no-print">
        <div className="admin-shell__header-row">
          <Link href="/matches" className="admin-shell__brand">
            Rugby365
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
              pathname={activePath}
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
              pathname={activePath}
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
            className={`admin-shell__bottom-link touch-target${
              navReady && bottomNavActive(pathname, item.href) ? " admin-shell__bottom-link--active" : ""
            }`}
          >
            {item.short}
          </Link>
        ))}
      </nav>
    </div>
  );
}
