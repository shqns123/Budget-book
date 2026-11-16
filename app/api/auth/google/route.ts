import { NextResponse } from "next/server";
import { isGoogleLoginConfigured, issueSessionToken } from "@/lib/auth-server";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth-shared";
import { verifyGoogleIdToken } from "@/lib/google-auth";
import { roleOf } from "@/lib/members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Google sign-in: { idToken, client? } → a session for the owner or an invited member. */
export async function POST(request: Request) {
  if (!isGoogleLoginConfigured()) {
    return NextResponse.json({ error: "Google 로그인 설정이 완료되지 않았습니다." }, { status: 503 });
  }
  const body = (await request.json().catch(() => ({}))) as { idToken?: unknown; client?: unknown };
  if (typeof body.idToken !== "string" || !body.idToken) {
    return NextResponse.json({ error: "Google 로그인 정보가 없어요." }, { status: 400 });
  }
  let email: string;
  try {
    email = (await verifyGoogleIdToken(body.idToken)).email.toLowerCase();
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 401 });
  }
  if (!(await roleOf(email))) {
    return NextResponse.json(
      { error: `${email} 계정은 이 가계부에 초대되지 않았어요. 소유자에게 초대를 요청해 주세요.` },
      { status: 403 },
    );
  }
  const token = await issueSessionToken(email);
  // The native app keeps the token in secure storage; browsers only get the httpOnly cookie.
  const response = NextResponse.json(body.client === "native" ? { ok: true, token } : { ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
