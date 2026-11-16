export const SESSION_COOKIE_NAME = "quiet_ledger_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

function sameBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

/** Who a session belongs to. `email` is null for tokens from before Google sign-in (the owner). */
export type Session = { email: string | null };

const encodeEmail = (email: string) => base64Url(encoder.encode(email));
const decodeEmail = (value: string) => new TextDecoder().decode(fromBase64Url(value));

/**
 * `<expiresAt>[~<email>].<signature>`: the signed payload carries who signed in (Google sign-in),
 * so the server can check membership on every request.
 */
export async function createSessionToken(secret: string, email?: string | null) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = email ? `${expiresAt}~${encodeEmail(email.toLowerCase())}` : String(expiresAt);
  return `${payload}.${base64Url(await sign(payload, secret))}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string | undefined,
): Promise<Session | null> {
  if (!token || !secret) return null;
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length) return null;
  const [expiry, email, ...extra] = payload.split("~");
  if (extra.length) return null;
  const expiresAt = Number(expiry);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() / 1000) return null;
  try {
    if (!sameBytes(fromBase64Url(signature), await sign(payload, secret))) return null;
    return { email: email ? decodeEmail(email) : null };
  } catch {
    return null;
  }
}
