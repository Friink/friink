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

  return <main className="login-screen"><form className="login-form" onSubmit={submit}>
    <a className="auth-home-link" href="/" aria-label="Friink home"><img src="/brand/logoBrand.svg" alt="" /></a>
    <div className="brand-lockup brand-lockup-lg" aria-label="Friink"><img className="brand-lockup-wordmark" src="/brand/logoFullBrand.svg" alt="Friink" /></div>
    <div className="login-step-copy"><p>Reset your password</p><span>Choose a new password for your Friink account.</span></div>
    <label className="pill-field password-field"><span className="sr-only">New password</span><input id="password" type={visible ? "text" : "password"} autoComplete="new-password" placeholder="New password" required value={password} onChange={(event) => setPassword(event.target.value)} /><button className="password-toggle" type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible((value) => !value)}>{visible ? "◉" : "◌"}</button></label>
    <ResetPasswordCriteria value={password} />
    <label className="pill-field password-field"><span className="sr-only">Confirm password</span><input id="confirm-password" type={visible ? "text" : "password"} autoComplete="new-password" placeholder="Confirm password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} /><button className="password-toggle" type="button" aria-label={visible ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={visible} onClick={() => setVisible((value) => !value)}>{visible ? "◉" : "◌"}</button></label>
    <div className="signup-actions"><a className="button-secondary login-back-button" href="/login">Back</a><button className="button-primary login-submit" disabled={busy}>{busy ? "Please wait…" : "Reset password"}</button></div>
    {message && <p className="login-error" role="alert">{message}</p>}
  </form></main>;
}

function ResetPasswordCriteria({ value }: { value: string }) {
  const hasMix = /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9\s]/.test(value);
  return <ul className="password-criteria" aria-label="Password requirements"><li className={value.length >= 8 ? "met" : ""}>✓ At least 8 characters</li><li className={hasMix ? "met" : ""}>✓ Mix of letters, numbers, and symbols</li><li className={!/\s/.test(value) ? "met" : ""}>✓ No spaces</li></ul>;
}
