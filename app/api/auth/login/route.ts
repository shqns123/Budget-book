import { NextResponse } from "next/server";
import {
  hasValidCredentials,
  isAuthConfigured,
  issueSessionToken,
} from "@/lib/auth-server";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth-shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "로그인 설정이 완료되지 않았습니다." },
      { status: 503 },
    );
  }
  const body = (await request.json()) as { username?: unknown; password?: unknown };
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!hasValidCredentials(username, password)) {
    return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, await issueSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
