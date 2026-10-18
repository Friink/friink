"use client";

import { FormEvent, useState } from "react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setMessage("Passwords do not match."); return; }
    setBusy(true); setMessage("");
    try {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) throw new Error("This reset link is missing or expired.");
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, newPassword: password }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message ?? "Unable to reset your password.");
      setMessage("Your password has been reset. You can now sign in.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to reset your password."); }
    finally { setBusy(false); }
  }

  return <div className="auth-shell"><header className="auth-header"><a className="brand" href="/" aria-label="Friink home">m</a><span className="auth-label">Secure account access</span></header><main className="auth-main"><section className="auth-card"><p className="micro">Password recovery</p><h1>Choose a new password.</h1><p className="intro">Use a strong password you do not reuse elsewhere.</p><form className="auth-form" onSubmit={submit}><label htmlFor="password">New password</label><div className="password-field"><input id="password" type={visible ? "text" : "password"} autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} /><button className="password-toggle" type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible((value) => !value)}>{visible ? "◉" : "◌"}</button></div><label htmlFor="confirm-password">Confirm password</label><div className="password-field"><input id="confirm-password" type={visible ? "text" : "password"} autoComplete="new-password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></div><div className="auth-actions"><button className="auth-button" disabled={busy}>{busy ? "Saving…" : "Reset password ↗"}</button><a className="auth-button secondary" href="/login">Back to login</a></div></form>{message && <p className="notice">{message}</p>}</section></main><footer className="auth-footer"><p>© 2026 Friink Ul Furqan.</p><p>Authentication service</p></footer></div>;
}
