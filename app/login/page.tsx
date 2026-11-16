"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { LockKeyhole, PiggyBank } from "lucide-react";

type GoogleId = {
  accounts: {
    id: {
      initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
      renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleId;
  }
}

type AuthConfig = { googleClientId: string | null; passwordLogin: boolean };

const GSI_SRC = "https://accounts.google.com/gsi/client";

function goNext() {
  const next = new URLSearchParams(window.location.search).get("next");
  window.location.assign(next?.startsWith("/") ? next : "/");
}

/**
 * Sign in with Google (the owner's address or an invited member's). The ID / password form is
 * the owner's fallback, behind a small link.
 */
export default function LoginPage() {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const googleButton = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/config")
      .then((response) => response.json() as Promise<AuthConfig>)
      .then((value) => {
        setConfig(value);
        if (!value.googleClientId) setShowPassword(value.passwordLogin);
      })
      .catch(() => setMessage("연결 상태를 확인한 뒤 다시 시도해 주세요."));
  }, []);

  // Google Identity Services: renders the button and hands back an ID token for the server to check.
  useEffect(() => {
    const clientId = config?.googleClientId;
    if (!clientId || !googleButton.current) return;
    const render = () => {
      if (!window.google || !googleButton.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => {
          if (credential) void signInWithGoogle(credential);
        },
      });
      googleButton.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButton.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
        width: 280,
        locale: "ko",
      });
    };
    if (window.google) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.onload = render;
    script.onerror = () => setMessage("Google 로그인을 불러오지 못했어요.");
    document.head.appendChild(script);
  }, [config?.googleClientId]);

  async function signInWithGoogle(idToken: string) {
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "로그인할 수 없습니다.");
        return;
      }
      goNext();
    } catch {
      setMessage("연결 상태를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(body.error ?? "로그인할 수 없습니다.");
        return;
      }
      goNext();
    } catch {
      setMessage("연결 상태를 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-mark"><PiggyBank size={28} /></div>
        <p>PRIVATE LEDGER</p>
        <h1>잔잔한 가계부</h1>
        <span>
          {config?.googleClientId ? "초대받은 Google 계정으로 로그인하세요." : "안전하게 기록을 이어가세요."}
        </span>
        {config?.googleClientId && (
          <div className="login-google" ref={googleButton} aria-busy={submitting} />
        )}
        {showPassword ? (
          <>
            <label>
              아이디
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
            </label>
            <label>
              비밀번호
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </label>
            <button type="submit" disabled={submitting}>
              <LockKeyhole size={16} /> {submitting ? "확인 중" : "로그인"}
            </button>
          </>
        ) : null}
        {message && <p className="login-error">{message}</p>}
        {config?.googleClientId && config.passwordLogin && !showPassword && (
          <button type="button" className="login-fallback" onClick={() => setShowPassword(true)}>
            아이디로 로그인
          </button>
        )}
      </form>
    </main>
  );
}
