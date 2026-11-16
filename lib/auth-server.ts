import { timingSafeEqual } from "node:crypto";
import { createSessionToken } from "@/lib/auth-shared";

export function hasValidCredentials(username: string, password: string) {
  const expectedUsername = process.env.AUTH_USERNAME;
  const expectedPassword = process.env.AUTH_PASSWORD;
  if (!expectedUsername || !expectedPassword) return false;
  const supplied = Buffer.from(`${username}\u0000${password}`);
  const expected = Buffer.from(`${expectedUsername}\u0000${expectedPassword}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

/** The signing secret is set (needed by every way of signing in). */
export function hasSecret() {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32);
}

/** The ID / password login (kept as a fallback to Google sign-in) is set up. */
export function isPasswordLoginConfigured() {
  return hasSecret() && Boolean(process.env.AUTH_USERNAME && process.env.AUTH_PASSWORD);
}

/** Google sign-in is set up: a web client ID and the owner's Google address. */
export function isGoogleLoginConfigured() {
  return hasSecret() && Boolean(process.env.GOOGLE_CLIENT_ID && process.env.OWNER_EMAIL);
}

export function isAuthConfigured() {
  return isPasswordLoginConfigured() || isGoogleLoginConfigured();
}

/** A session for `email` (Google sign-in), or for the owner (ID / password login). */
export async function issueSessionToken(email?: string | null) {
  return createSessionToken(process.env.AUTH_SECRET!, email ?? process.env.OWNER_EMAIL ?? null);
}
