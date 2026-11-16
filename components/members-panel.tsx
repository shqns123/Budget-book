"use client";

import { FormEvent, useEffect, useState } from "react";
import { Crown, Trash2, UserPlus } from "lucide-react";

type Member = { email: string; addedAt: string };
type MembersResponse = {
  me: { email: string | null; role: "owner" | "member" };
  owner: string | null;
  members: Member[];
  error?: string;
};

/**
 * Who shares this ledger. Everyone listed signs in with that Google account and can see and edit
 * everything; only the owner invites and removes members.
 */
export function MembersPanel() {
  const [data, setData] = useState<MembersResponse | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/members", { cache: "no-store" });
    const body = (await response.json()) as MembersResponse;
    if (!response.ok) throw new Error(body.error ?? "멤버를 불러오지 못했어요.");
    setData(body);
  }

  useEffect(() => {
    load().catch((e: Error) => setError(e.message));
  }, []);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "초대하지 못했어요.");
      setEmail("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(address: string) {
    if (!window.confirm(`${address}을(를) 가계부에서 내보낼까요? 다음 요청부터 볼 수 없어요.`)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/members?email=${encodeURIComponent(address)}`, { method: "DELETE" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "내보내지 못했어요.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const isOwner = data?.me.role === "owner";
  return (
    <section className="setting-table members-table">
      <header>
        <h2>멤버</h2>
        <p>초대한 Google 계정으로 로그인하면 같은 가계부를 보고 편집할 수 있어요.</p>
      </header>
      {data?.owner && (
        <div className="member-row">
          <Crown size={16} />
          <span>{data.owner}</span>
          <small>소유자</small>
        </div>
      )}
      {data?.members.map((member) => (
        <div className="member-row" key={member.email}>
          <span className="member-dot" />
          <span>{member.email}</span>
          <small>{new Date(member.addedAt).toLocaleDateString("ko-KR")} 초대</small>
          {isOwner && (
            <button type="button" disabled={busy} onClick={() => void remove(member.email)} aria-label={`${member.email} 내보내기`}>
              <Trash2 size={15} />
            </button>
          )}
        </div>
      ))}
      {data && !data.members.length && <p className="member-empty">아직 초대한 멤버가 없어요.</p>}
      {isOwner && (
        <form className="member-invite" onSubmit={invite}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="초대할 Gmail 주소"
            aria-label="초대할 Gmail 주소"
            required
          />
          <button type="submit" disabled={busy}>
            <UserPlus size={15} /> 초대
          </button>
        </form>
      )}
      {error && <p className="save-error">{error}</p>}
    </section>
  );
}
