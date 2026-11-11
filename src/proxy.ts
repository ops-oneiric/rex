import { NextResponse, type NextRequest } from "next/server";

/**
 * Content Security Policy with a fresh nonce per request. Next.js reads the nonce from the
 * request's CSP header and adds it to its own scripts, so only scripts Rex served can run
 * ('strict-dynamic' lets those load the rest of the app). Every page is rendered per request
 * (see the root layout), which nonces require. Inline style attributes are still allowed:
 * React sets widths and heights through them, and styles cannot run code.
 */
function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

// Also the first line of defence for sign-in: visitors without a session cookie go to the
// login page. Pages, server actions and route handlers still validate the session themselves
// (src/lib/auth/dal.ts and src/lib/auth/session.ts).
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname !== "/login" && !request.cookies.has("rex_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/health|icon.svg|favicon.ico|robots.txt).*)",
  ],
};
