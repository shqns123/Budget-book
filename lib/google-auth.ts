/**
 * Google sign-in, as in the group calendar app: the web page (Google Identity Services) and the
 * native app (Google Sign-In with the web client ID) both get a Google ID token, and the server
 * checks it with Google before signing the person in.
 */
export type GoogleProfile = { sub: string; email: string; name?: string; picture?: string };

/** Web client ID(s) from Google Cloud; tokens must be issued for one of them. */
export function googleClientIds() {
  return (process.env.GOOGLE_CLIENT_ID ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Google 로그인 정보를 확인하지 못했어요.");
  const profile = (await response.json()) as GoogleProfile & {
    aud?: string;
    email_verified?: string | boolean;
  };
  if (!profile.aud || !googleClientIds().includes(profile.aud)) {
    throw new Error("이 서버용으로 발급된 Google 로그인이 아니에요.");
  }
  if (profile.email_verified !== true && profile.email_verified !== "true") {
    throw new Error("Google 계정의 이메일 인증이 필요해요.");
  }
  return profile;
}
