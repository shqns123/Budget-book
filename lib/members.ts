import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth-shared";
import { readPrivateState, writePrivateState } from "@/lib/sqlite-state";

/**
 * Who may open the ledger. Everyone shares the one ledger and can read and edit all of it; only
 * the owner (OWNER_EMAIL, the person who set the server up) invites and removes members.
 * Invited members are Gmail addresses: signing in with Google as that address lets them in.
 */
export type Role = "owner" | "member";
export type Member = { email: string; addedAt: string };

const MEMBERS_KEY = "__members";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function ownerEmail() {
  const email = process.env.OWNER_EMAIL;
  return email ? normalizeEmail(email) : null;
}

export async function readMembers() {
  const rows = await readPrivateState<Member[]>(MEMBERS_KEY, []);
  return Array.isArray(rows) ? rows.filter((m) => typeof m?.email === "string") : [];
}

export async function writeMembers(members: Member[]) {
  await writePrivateState(MEMBERS_KEY, members);
}

/**
 * The role of a signed-in email, or null if it may not use the ledger. A session without an email
 * comes from the ID / password login (or from before Google sign-in): that is the owner.
 */
export async function roleOf(email: string | null): Promise<Role | null> {
  if (email === null) return "owner";
  const address = normalizeEmail(email);
  if (address === ownerEmail()) return "owner";
  const members = await readMembers();
  return members.some((m) => normalizeEmail(m.email) === address) ? "member" : null;
}

export type Viewer = { email: string | null; role: Role };

/** The signed-in person behind a request (bearer token from the app, or the browser cookie). */
export async function viewerOf(request: Request): Promise<Viewer | null> {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const cookie = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);
  const session = await verifySessionToken(bearer ?? (cookie ? decodeURIComponent(cookie) : undefined), process.env.AUTH_SECRET);
  if (!session) return null;
  const role = await roleOf(session.email);
  return role ? { email: session.email ?? ownerEmail(), role } : null;
}

/**
 * For API routes: the viewer, or a 401 (not signed in) / 403 (no longer a member) response.
 * Removing a member takes effect on their next request.
 */
export async function requireViewer(request: Request): Promise<Viewer | NextResponse> {
  const viewer = await viewerOf(request);
  if (viewer) return viewer;
  const signedIn = Boolean(request.headers.get("authorization") || request.headers.get("cookie")?.includes(SESSION_COOKIE_NAME));
  return NextResponse.json(
    { error: signedIn ? "이 가계부의 멤버가 아니에요. 소유자에게 초대를 요청해 주세요." : "로그인이 필요합니다." },
    { status: signedIn ? 403 : 401 },
  );
}
