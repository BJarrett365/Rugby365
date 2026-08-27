import { NextResponse } from "next/server";
import {
  buildSiteGateToken,
  credentialsMatch,
  SITE_GATE_COOKIE,
  siteGateEnabled,
} from "@/lib/site-gate";

export async function POST(req: Request) {
  if (!siteGateEnabled()) {
    return NextResponse.json({ ok: true, gate: "disabled" });
  }

  let body: { username?: string; password?: string } = {};
  try {
    body = (await req.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const username = String(body.username ?? "");
  const password = String(body.password ?? "");
  if (!credentialsMatch(username, password)) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SITE_GATE_COOKIE,
    value: buildSiteGateToken(username, password),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SITE_GATE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
