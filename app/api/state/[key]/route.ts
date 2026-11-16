import { NextResponse } from "next/server";
import { requireViewer } from "@/lib/members";
import { isStateKey, readState, writeState } from "@/lib/sqlite-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ key: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  // Only the owner and invited members (checked on every request, so removal takes effect).
  const viewer = await requireViewer(request);
  if (viewer instanceof NextResponse) return viewer;
  const { key } = await params;
  if (!isStateKey(key)) {
    return NextResponse.json({ error: "Unknown state" }, { status: 404 });
  }
  return NextResponse.json({ value: await readState(key) });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const viewer = await requireViewer(request);
  if (viewer instanceof NextResponse) return viewer;
  const { key } = await params;
  if (!isStateKey(key)) {
    return NextResponse.json({ error: "Unknown state" }, { status: 404 });
  }
  const body = (await request.json()) as { value?: unknown };
  if (!("value" in body)) {
    return NextResponse.json({ error: "Missing value" }, { status: 400 });
  }
  await writeState(key, body.value);
  return NextResponse.json({ ok: true });
}
