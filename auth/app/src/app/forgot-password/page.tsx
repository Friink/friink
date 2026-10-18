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

  return <main className="login-screen"><form className="login-form" onSubmit={submit}>
    <a className="auth-home-link" href="/" aria-label="Friink home"><img src="/brand/logoBrand.svg" alt="" /></a>
    <div className="brand-lockup brand-lockup-lg" aria-label="Friink"><img className="brand-lockup-wordmark" src="/brand/logoFullBrand.svg" alt="Friink" /></div>
    <div className="login-step-copy"><p>Reset your password</p><span>Enter your account email and we’ll send a single-use reset link.</span></div>
    <label className="pill-field"><span className="sr-only">Email address</span><input id="email" type="email" autoComplete="email" placeholder="Email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <div className="signup-actions"><a className="button-secondary login-back-button" href="/login">Back</a><button className="button-primary login-submit" disabled={busy}>{busy ? "Please wait…" : "Send reset link"}</button></div>
    {message && <p className="login-error" role="status">{message}</p>}
  </form></main>;
}
