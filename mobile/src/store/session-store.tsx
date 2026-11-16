import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as api from "@/lib/api";
import { getGoogleIdToken, googleSignOut } from "@/lib/google";

type Session = {
  ready: boolean;
  signedIn: boolean;
  serverUrl: string;
  signIn: (server: string, username: string, password: string) => Promise<void>;
  /** Google sign-in; false when the person closed the account picker. */
  signInWithGoogle: (server: string) => Promise<boolean>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [serverUrl, setServerUrl] = useState("");

  useEffect(() => {
    void api
      .loadSession()
      .then((session) => {
        setServerUrl(session.serverUrl);
        setSignedIn(session.signedIn);
      })
      .catch(() => setSignedIn(false))
      .finally(() => setReady(true));
    api.setUnauthorizedHandler(() => setSignedIn(false));
    return () => api.setUnauthorizedHandler(null);
  }, []);

  const signIn = useCallback(async (server: string, username: string, password: string) => {
    await api.login(server, username, password);
    setServerUrl(api.getServerUrl());
    setSignedIn(true);
  }, []);

  const signInWithGoogle = useCallback(async (server: string) => {
    const idToken = await getGoogleIdToken();
    if (!idToken) return false;
    try {
      await api.loginWithGoogle(server, idToken);
    } catch (error) {
      // e.g. not invited: let the next try pick another account
      await googleSignOut();
      throw error;
    }
    setServerUrl(api.getServerUrl());
    setSignedIn(true);
    return true;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Signing out locally is enough when the server is unreachable.
    }
    await api.logout();
    await googleSignOut();
    setSignedIn(false);
  }, []);

  const value = useMemo(
    () => ({ ready, signedIn, serverUrl, signIn, signInWithGoogle, signOut }),
    [ready, signedIn, serverUrl, signIn, signInWithGoogle, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}
