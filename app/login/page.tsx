"use client";

import { FormEvent, useState } from "react";
import { LockKeyhole, PiggyBank } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(next?.startsWith("/") ? next : "/");
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
        <span>안전하게 기록을 이어가세요.</span>
        <label>
          아이디
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
        </label>
        <label>
          비밀번호
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
        </label>
        {message && <p className="login-error">{message}</p>}
        <button type="submit" disabled={submitting}>
          <LockKeyhole size={16} /> {submitting ? "확인 중" : "로그인"}
        </button>
      </form>
    </main>
  );
}

