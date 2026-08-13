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

export function isAuthConfigured() {
  return Boolean(
    process.env.AUTH_USERNAME &&
      process.env.AUTH_PASSWORD &&
      process.env.AUTH_SECRET &&
      process.env.AUTH_SECRET.length >= 32,
  );
}

export async function issueSessionToken() {
  return createSessionToken(process.env.AUTH_SECRET!);
}
