import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const allCookies = request.cookies.getAll();
  const hasSupabaseSession = allCookies.some(cookie => cookie.name.startsWith("sb-"));

  const { pathname } = request.nextUrl;

  if (!hasSupabaseSession && (pathname.startsWith("/client") || pathname.startsWith("/trainer"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/client/:path*", "/trainer/:path*"],
};