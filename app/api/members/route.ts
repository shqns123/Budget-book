import { NextResponse } from "next/server";
import { normalizeEmail, ownerEmail, readMembers, requireViewer, writeMembers } from "@/lib/members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Who shares the ledger: { me, owner, members }. Any member may look. */
export async function GET(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof NextResponse) return viewer;
  return NextResponse.json({ me: viewer, owner: ownerEmail(), members: await readMembers() });
}

/** Invite: { email }. Owner only. */
export async function POST(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof NextResponse) return viewer;
  if (viewer.role !== "owner") {
    return NextResponse.json({ error: "멤버는 소유자만 초대할 수 있어요." }, { status: 403 });
  }
  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  if (!EMAIL.test(email)) return NextResponse.json({ error: "이메일 주소를 확인해 주세요." }, { status: 400 });
  if (email === ownerEmail()) return NextResponse.json({ error: "소유자는 초대할 필요가 없어요." }, { status: 400 });
  const members = await readMembers();
  if (members.some((m) => normalizeEmail(m.email) === email)) {
    return NextResponse.json({ error: "이미 초대한 주소예요." }, { status: 409 });
  }
  const next = [...members, { email, addedAt: new Date().toISOString() }];
  await writeMembers(next);
  return NextResponse.json({ members: next });
}

/** Remove: ?email=. Owner only; takes effect on that member's next request. */
export async function DELETE(request: Request) {
  const viewer = await requireViewer(request);
  if (viewer instanceof NextResponse) return viewer;
  if (viewer.role !== "owner") {
    return NextResponse.json({ error: "멤버는 소유자만 내보낼 수 있어요." }, { status: 403 });
  }
  const email = normalizeEmail(new URL(request.url).searchParams.get("email") ?? "");
  const members = await readMembers();
  const next = members.filter((m) => normalizeEmail(m.email) !== email);
  await writeMembers(next);
  return NextResponse.json({ members: next });
}
