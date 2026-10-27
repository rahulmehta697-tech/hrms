import { NextResponse, type NextRequest } from "next/server";

const OPEN = ["/login", "/setup", "/join", "/api/join", "/api/health", "/api/demo/reset"];

export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (OPEN.some((o) => p === o || p.startsWith(o + "/"))) return NextResponse.next();
  if (!req.cookies.get("hrms_s")) {
    if (p.startsWith("/api/")) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/|favicon.ico).*)"] };
