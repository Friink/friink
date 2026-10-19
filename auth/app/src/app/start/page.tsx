"use client";

import { FormEvent, useState } from "react";

export default function StartPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function continueWithEmail(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const next = new URL("/login", window.location.origin);
      next.searchParams.set("email", email.trim().toLowerCase());
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      if (returnTo) next.searchParams.set("returnTo", returnTo);
      window.location.assign(next.toString());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to continue.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="auth-shell">
    <header className="auth-header"><a className="brand" href="/" aria-label="Friink home">m</a><span className="auth-label">Secure account access</span></header>
    <main className="auth-main"><section className="auth-card" aria-live="polite"><p className="micro">Friink account</p><h1>Start here.</h1><p className="intro">Enter your email to sign in, or choose sign up for a new account.</p><form className="auth-form" onSubmit={continueWithEmail}><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /><div className="auth-actions"><button className="auth-button" disabled={busy}>{busy ? "Continuing…" : "Continue ↗"}</button></div></form><nav className="auth-entry-links" aria-label="Account access options"><a href="/forgot-password">Forgot password?</a><a href="/signup">Sign up</a></nav>{message && <p className="notice error">{message}</p>}</section></main>
    <footer className="auth-footer"><p>© 2026 Friink.</p><p>Authentication service</p></footer>
  </div>;
}
