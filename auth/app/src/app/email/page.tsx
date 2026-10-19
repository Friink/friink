"use client";

import { FormEvent, useState } from "react";

type Step = "start" | "current" | "new";

export default function EmailPage() {
  const [newEmail, setNewEmail] = useState("");
  const [currentOtp, setCurrentOtp] = useState("");
  const [newOtp, setNewOtp] = useState("");
  const [step, setStep] = useState<Step>("start");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function requestCurrentCode() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/email-change", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send-current" }) });
      if (!response.ok) throw new Error("We could not send a verification code.");
      setStep("current"); setMessage("We sent a verification code to your current email.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "We could not send a verification code."); }
    finally { setBusy(false); }
  }

  async function requestNewCode(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/email-change", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request-new", newEmail, otp: currentOtp }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "We could not verify that code.");
      setStep("new"); setMessage("We sent a verification code to your new email.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "We could not verify that code."); }
    finally { setBusy(false); }
  }

  async function confirmChange(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/email-change", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", newEmail, otp: newOtp }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "We could not update your email.");
      setMessage("Your email address has been updated.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "We could not update your email."); }
    finally { setBusy(false); }
  }

  return <main className="login-screen"><section className="login-form" aria-live="polite">
    <a className="auth-home-link" href="/me" aria-label="Back to account"><img src="/brand/logoBrand.svg" alt="" /></a>
    <div className="brand-lockup brand-lockup-lg"><img className="brand-lockup-wordmark" src="/brand/logoFullBrand.svg" alt="Friink" /></div>
    <div className="login-step-copy"><p>Change your email.</p><span>{step === "start" ? "We’ll verify your current email before sending a code to the new address." : step === "current" ? "Enter the code sent to your current email." : "Enter the code sent to your new email."}</span></div>
    {step === "start" && <><label className="pill-field"><span className="sr-only">New email address</span><input type="email" autoComplete="email" placeholder="New email address" required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label><div className="signup-actions"><a className="button-secondary login-back-button" href="/me">Back</a><button className="button-primary login-submit" type="button" disabled={busy || !newEmail} onClick={requestCurrentCode}>{busy ? "Please wait…" : "Send code"}</button></div></>}
    {step === "current" && <form onSubmit={requestNewCode}><label className="pill-field"><span className="sr-only">Current email verification code</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="Verification code" required value={currentOtp} onChange={(event) => setCurrentOtp(event.target.value.replace(/\D/g, ""))} /></label><div className="signup-actions"><button className="button-secondary" type="button" onClick={() => setStep("start")}>Back</button><button className="button-primary login-submit" disabled={busy}>{busy ? "Please wait…" : "Verify code"}</button></div></form>}
    {step === "new" && <form onSubmit={confirmChange}><label className="pill-field"><span className="sr-only">New email verification code</span><input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="Verification code" required value={newOtp} onChange={(event) => setNewOtp(event.target.value.replace(/\D/g, ""))} /></label><div className="signup-actions"><button className="button-primary login-submit" disabled={busy}>{busy ? "Please wait…" : "Confirm email"}</button></div></form>}
    {message && <p className="login-error" role="status">{message}</p>}
  </section></main>;
}
