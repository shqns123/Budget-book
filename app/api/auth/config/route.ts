import { NextResponse } from "next/server";
import { isGoogleLoginConfigured, isPasswordLoginConfigured } from "@/lib/auth-server";
import { googleClientIds } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

/** What the login page offers: the Google button (with its public client ID) and/or the fallback. */
export async function GET() {
  return NextResponse.json({
    googleClientId: isGoogleLoginConfigured() ? googleClientIds()[0] : null,
    passwordLogin: isPasswordLoginConfigured(),
  });
}
