import { NextResponse, type NextRequest } from "next/server";
import {
  expectedSiteGateToken,
  SITE_GATE_COOKIE,
  siteGateEnabled,
} from "@/lib/site-gate";

function isPublicLiveCentrePath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/matches" ||
    pathname.startsWith("/matches/") ||
    pathname.startsWith("/api/fixtures") ||
    pathname.startsWith("/tables") ||
    pathname.startsWith("/coaches") ||
    pathname.startsWith("/players") ||
    pathname.startsWith("/competitions") ||
    pathname.startsWith("/transfers") ||
    pathname.startsWith("/rankings") ||
    pathname.startsWith("/venues") ||
    pathname.startsWith("/api/competitions") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/api/legends") ||
    pathname.startsWith("/api/coaches") ||
    pathname.startsWith("/api/players") ||
    pathname.startsWith("/api/teams") ||
    pathname.startsWith("/api/venues")
  );
}

export function middleware(request: NextRequest) {
  if (!siteGateEnabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (
    isPublicLiveCentrePath(pathname) ||
    pathname === "/login" ||
    pathname.startsWith("/api/site-gate") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/manifest.json" ||
    pathname === "/robots.txt" ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|woff2?)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SITE_GATE_COOKIE)?.value;
  if (token && token === expectedSiteGateToken()) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
