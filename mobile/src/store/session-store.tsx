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

type Session = {
  ready: boolean;
  signedIn: boolean;
  serverUrl: string;
  signIn: (server: string, username: string, password: string) => Promise<void>;
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

  const signOut = useCallback(async () => {
    try {
      await api.apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Signing out locally is enough when the server is unreachable.
    }
    await api.logout();
    setSignedIn(false);
  }, []);

  const value = useMemo(
    () => ({ ready, signedIn, serverUrl, signIn, signOut }),
    [ready, signedIn, serverUrl, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}
