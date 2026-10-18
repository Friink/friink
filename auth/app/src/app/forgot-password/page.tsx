"use client";

import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/request-password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, redirectTo: `${window.location.origin}/reset-password` }) });
      if (!response.ok) throw new Error("Unable to send a reset link.");
      setMessage("If an account exists for that email, a reset link is on its way.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to send a reset link."); }
    finally { setBusy(false); }
  }

  return <div className="auth-shell"><header className="auth-header"><a className="brand" href="/" aria-label="Friink home">m</a><span className="auth-label">Secure account access</span></header><main className="auth-main"><section className="auth-card"><p className="micro">Password recovery</p><h1>Reset your password.</h1><p className="intro">Enter your email and we’ll send a secure reset link if the account exists.</p><form className="auth-form" onSubmit={submit}><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /><div className="auth-actions"><button className="auth-button" disabled={busy}>{busy ? "Sending…" : "Send reset link ↗"}</button><a className="auth-button secondary" href="/login">Back to login</a></div></form>{message && <p className="notice">{message}</p>}</section></main><footer className="auth-footer"><p>© 2026 Friink.</p><p>Authentication service</p></footer></div>;
}
