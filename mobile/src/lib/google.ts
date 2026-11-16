// Google Sign-In (as in the group calendar app). It is a native module: it exists only in a
// development / release build, never in Expo Go or on web, so it is loaded lazily and the login
// screen falls back to the ID / password form without it.
import { Platform } from "react-native";

/** The server's Google web client ID: the ID token is issued for it, so the server accepts it. */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

type GoogleModule = typeof import("@react-native-google-signin/google-signin");

function load(): GoogleModule | null {
  if (!WEB_CLIENT_ID || Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@react-native-google-signin/google-signin") as GoogleModule;
  } catch {
    return null;
  }
}

const mod = load();
let configured = false;

export const googleAvailable = mod != null;

/** A Google ID token for the account the person picks, or null if they cancel. */
export async function getGoogleIdToken(): Promise<string | null> {
  if (!mod) throw new Error("Google 로그인은 앱 빌드(개발용 앱 포함)에서만 쓸 수 있어요.");
  const { GoogleSignin, isSuccessResponse } = mod;
  if (!configured) {
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID, iosClientId: IOS_CLIENT_ID });
    configured = true;
  }
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const result = await GoogleSignin.signIn();
  if (!isSuccessResponse(result)) return null;
  if (!result.data.idToken) throw new Error("Google 로그인 정보를 받지 못했어요.");
  return result.data.idToken;
}

/** Forget the picked account, so the next sign-in asks again (switching accounts). */
export async function googleSignOut() {
  try {
    await mod?.GoogleSignin.signOut();
  } catch {
    // not signed in with Google
  }
}
