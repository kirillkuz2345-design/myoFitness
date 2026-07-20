import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16: middleware-конвенция переименована в proxy. Функция теперь называется proxy.
export async function proxy(request: NextRequest) {
  const allCookies = request.cookies.getAll();
  const hasSupabaseSession = allCookies.some(cookie => cookie.name.startsWith("sb-"));

  const { pathname } = request.nextUrl;

  const isProtected =
    pathname.startsWith("/client") ||
    pathname.startsWith("/trainer") ||
    pathname.startsWith("/settings");

  if (!hasSupabaseSession && isProtected) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/client/:path*", "/trainer/:path*", "/settings/:path*"],
};
