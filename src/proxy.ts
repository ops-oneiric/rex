import { NextResponse, type NextRequest } from "next/server";

// First line of defence only: sends visitors without a session cookie to the login
// page. Pages and server actions still validate the session themselves (src/lib/auth/dal.ts).
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === "/login") return NextResponse.next();

  if (!request.cookies.has("rex_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/health|icon.svg|favicon.ico|robots.txt).*)",
  ],
};
