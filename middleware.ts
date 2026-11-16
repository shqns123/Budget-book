import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
} from "@/lib/auth-shared";

const publicPaths = new Set(["/login", "/manifest.webmanifest", "/sw.js", "/offline.html"]);

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/api/auth") || publicPaths.has(pathname) || pathname.startsWith("/pwa-")) {
    return NextResponse.next();
  }

  // The native app sends its session token as a bearer header instead of a cookie.
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) {
    const session = await verifySessionToken(bearer, process.env.AUTH_SECRET);
    if (session) {
      // Sliding session for the app: hand back a fresh token on every request. (Membership is
      // checked by the API routes, which can read the database.)
      const response = NextResponse.next();
      response.headers.set(
        "x-session-token",
        await createSessionToken(process.env.AUTH_SECRET!, session.email),
      );
      return response;
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
  }

  const authenticated = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
    process.env.AUTH_SECRET,
  );
  if (authenticated) {
    // Extend the 400-day session whenever the ledger is used, so it behaves
    // like a persistent personal-device login while still allowing revocation.
    const response = NextResponse.next();
    response.cookies.set(
      SESSION_COOKIE_NAME,
      await createSessionToken(process.env.AUTH_SECRET!, authenticated.email),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_MAX_AGE_SECONDS,
      },
    );
    return response;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
