import { NextResponse } from "next/server";
import {
  hasValidCredentials,
  isPasswordLoginConfigured,
  issueSessionToken,
} from "@/lib/auth-server";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // The ID / password login is the owner's fallback to Google sign-in.
  if (!isPasswordLoginConfigured()) {
    return NextResponse.json(
      { error: "로그인 설정이 완료되지 않았습니다." },
      { status: 503 },
    );
  }
  const body = (await request.json()) as {
    username?: unknown;
    password?: unknown;
    client?: unknown;
  };
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!hasValidCredentials(username, password)) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  const token = await issueSessionToken();
  // The native app keeps the token in secure storage and sends it as a bearer header.
  // Browsers never receive it in the body; they only get the httpOnly cookie.
  const response = NextResponse.json(
    body.client === "native" ? { ok: true, token } : { ok: true },
  );
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
