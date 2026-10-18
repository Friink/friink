"use client";

import { useState } from "react";
import { publishSessionEvent } from "@friink/account-switcher";

type SessionItem = {
  id: string;
  token: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export default function SessionList({ sessions, currentToken }: { sessions: SessionItem[]; currentToken?: string }) {
  const [items, setItems] = useState(sessions);
  const [busy, setBusy] = useState<string | null>(null);

  async function revoke(token: string) {
    setBusy(token);
    const response = await fetch("/api/auth/multi-session/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: token }),
    });
    if (response.ok) {
      setItems((current) => current.filter((session) => session.token !== token));
      publishSessionEvent("session-revoked");
    }
    setBusy(null);
  }

  return (
    <div className="session-list">
      {items.map((session) => (
        <article className="session-item" key={session.id}>
          <div>
            <strong>{session.userAgent || "Unknown device"}</strong>
            <span>{session.ipAddress || "IP unavailable"}</span>
            <small>Last active {new Date(session.updatedAt).toLocaleString()}</small>
            <small>Session expires {new Date(session.expiresAt).toLocaleString()}</small>
          </div>
          <button className="session-revoke" type="button" onClick={() => revoke(session.token)} disabled={busy === session.token}>
            {busy === session.token ? "Revoking…" : session.token === currentToken ? "Revoke this session" : "Revoke"}
          </button>
        </article>
      ))}
      {items.length === 0 && <p className="account-lede">No active sessions remain.</p>}
    </div>
  );
}
