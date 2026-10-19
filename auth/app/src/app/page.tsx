"use client";

import { FormEvent, useEffect, useState } from "react";
import { destinationAfterAuth, getTrustedReturnTo, onboardingUrl } from "@/lib/return-url";
import PasswordToggle from "@/components/auth/password-toggle";

type Flow = "sign-in" | "sign-up";
type Step = "identifier" | "credentials" | "verify";

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [flow, setFlow] = useState<Flow | null>(null);
  const [step, setStep] = useState<Step>("identifier");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionCheckError, setSessionCheckError] = useState("");
  const [sessionCheckAttempt, setSessionCheckAttempt] = useState(0);
  const [returnTo, setReturnTo] = useState<string | null>(null);

  useEffect(() => {
    const requestedReturnTo = getTrustedReturnTo();
    setReturnTo(requestedReturnTo);
    const path = window.location.pathname;
    const requestedFlow = path.endsWith("/signup") ? "sign-up" : path.endsWith("/login") ? "sign-in" : null;
    const params = new URLSearchParams(window.location.search);
    const intent = params.get("intent");
    const emailFromStart = params.get("email");
    if (requestedFlow || intent === "login" || intent === "signup") {
      setFlow(requestedFlow ?? (intent === "signup" ? "sign-up" : "sign-in"));
      if (emailFromStart) {
        setEmail(emailFromStart);
        setStep(requestedFlow === "sign-up" || intent === "signup" ? "verify" : "credentials");
      }
      setCheckingSession(false);
      return;
    }
    let active = true;
    async function resolveSession() {
      try {
        const response = await fetch("/api/auth/get-session", { credentials: "include", cache: "no-store" });
        if (!response.ok) throw new Error("Session check failed");
        const result = await response.json();
        const user = result?.user;
        if (user) {
          window.location.replace(user.onboardingStatus === "complete" && user.username ? destinationAfterAuth(requestedReturnTo, `/${encodeURIComponent(user.username)}`) : onboardingUrl(requestedReturnTo));
          return;
        }
        if (active) setCheckingSession(false);
      } catch {
        if (active) { setSessionCheckError("We couldn’t verify your session."); setCheckingSession(false); }
      }
    }
    resolveSession();
    return () => { active = false; };
  }, [sessionCheckAttempt]);

  async function continueWithEmail(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      if (!flow) {
        setFlow("sign-in");
        setStep("credentials");
        return;
      }
      if (flow === "sign-in") {
        setStep("credentials");
        return;
      }
      const otpResponse = await fetch("/api/auth-flow/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, purpose: "signup" }) });
      const otpResult = await otpResponse.json().catch(() => ({}));
      if (!otpResponse.ok) throw new Error(otpResult.error ?? "Unable to send a verification code");
      setStep("verify"); setMessage("We sent a verification code to your email.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to continue"); }
    finally { setBusy(false); }
  }

  async function submitCredentials(event: FormEvent) {
    event.preventDefault();
    if (flow === "sign-up" && password !== confirmPassword) { setMessage("Passwords do not match."); return; }
    setBusy(true); setMessage("");
    try {
      const endpoint = flow === "sign-in" ? "/api/auth-flow/password" : "/api/auth-flow/signup";
      const body = flow === "sign-in" ? { email, password } : { password, name };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Authentication failed");
      if (flow === "sign-in") { setStep("verify"); setMessage("We sent a sign-in code to your email."); }
      else { window.location.assign(onboardingUrl(returnTo)); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Authentication failed"); }
    finally { setBusy(false); }
  }

  async function verifyEmail(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const body = flow === "sign-in" ? { otp, password } : { otp };
      const response = await fetch("/api/auth-flow/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "That code is not valid");
      if (flow === "sign-in") {
        const destination = result.user?.onboardingStatus === "complete" && result.user?.username ? destinationAfterAuth(returnTo, `/${encodeURIComponent(result.user.username)}`) : onboardingUrl(returnTo);
        window.location.assign(destination);
      } else { setOtp(""); setStep("credentials"); setMessage("Email verified. Create your password."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "That code is not valid"); }
    finally { setBusy(false); }
  }

  async function resendCode() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth-flow/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, purpose: flow === "sign-in" ? "login" : "signup" }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Unable to send a new code");
      setMessage("A new verification code is on its way.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to send a new code"); }
    finally { setBusy(false); }
  }

  const isError = /failed|unable|not valid|error|match|find|already/i.test(message);
  const title = step === "verify" ? "Check your email." : flow ? (flow === "sign-in" ? "Welcome back." : "Create your account.") : "Continue to your account.";
  const intro = step === "verify" ? `Enter the code we sent to ${email}.` : flow ? `Continue with ${email}.` : "Enter your email and we’ll take you to the right place.";
  const signupHref = returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : "/signup";

  if (checkingSession) return <div className="auth-shell"><main className="auth-main"><p className="micro">Checking your session…</p></main></div>;
  if (sessionCheckError) return <div className="auth-shell"><main className="auth-main"><section className="auth-card"><p className="micro">Session check</p><h1>Let’s try that again.</h1><p className="intro">{sessionCheckError} Your account has not been signed out.</p><div className="auth-actions"><button className="auth-button" type="button" onClick={() => { setSessionCheckError(""); setCheckingSession(true); setSessionCheckAttempt((attempt) => attempt + 1); }}>Retry ↗</button></div></section></main></div>;

  return <main className="login-screen">
    <form className="login-form" onSubmit={step === "identifier" ? continueWithEmail : step === "verify" ? verifyEmail : submitCredentials} aria-live="polite">
      <a className="auth-home-link" href="/" aria-label="Friink home"><img src="/brand/logoBrand.svg" alt="" /></a>
      <div className="brand-lockup brand-lockup-lg" aria-label="Friink"><img className="brand-lockup-wordmark" src="/brand/logoFullBrand.svg" alt="Friink" /></div>
      <div className="login-step-copy"><p>{title}</p><span>{intro}</span></div>
      {step === "identifier" ? <>
        <label className="pill-field"><span className="sr-only">Email address</span><input id="email" type="email" autoComplete="email" placeholder="Email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <div className="signup-actions signup-actions-single"><button className="button-primary login-submit" disabled={busy}>{busy ? "Checking…" : "Continue"}</button></div>
        <nav className="auth-entry-links" aria-label="Account access options"><a href="/forgot-password">Forgot password?</a><a href={signupHref}>Sign up</a></nav>
      </> : step === "verify" ? <>
        <label className="pill-field"><span className="sr-only">Verification code</span><input id="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="Verification code" required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} /></label>
        <div className="signup-actions"><button className="button-secondary" type="button" disabled={busy} onClick={() => { setStep("identifier"); setFlow(null); setMessage(""); }}>Back</button><button className="button-primary login-submit" disabled={busy}>{busy ? "Verifying…" : "Verify code"}</button></div>
        <div className="auth-secondary-actions"><button className="text-link" type="button" disabled={busy} onClick={resendCode}>Resend code</button><button className="text-link" type="button" disabled={busy} onClick={() => { setStep("identifier"); setFlow(null); setMessage(""); }}>Use a different email</button></div>
      </> : <>
        {flow === "sign-up" && <label className="pill-field"><span className="sr-only">Name</span><input id="name" autoComplete="name" placeholder="Name" required value={name} onChange={(event) => setName(event.target.value)} /></label>}
        <label className="pill-field password-field"><span className="sr-only">Password</span><input id="password" type={passwordVisible ? "text" : "password"} autoComplete={flow === "sign-in" ? "current-password" : "new-password"} placeholder="Password" required value={password} onChange={(event) => setPassword(event.target.value)} /><PasswordToggle visible={passwordVisible} label={passwordVisible ? "Hide password" : "Show password"} onClick={() => setPasswordVisible((visible) => !visible)} /></label>
        {flow === "sign-up" && <SignupPasswordCriteria value={password} />}
        {flow === "sign-in" && <a className="forgot-password" href="/forgot-password">Forgot password?</a>}
        {flow === "sign-up" && <label className="pill-field password-field"><span className="sr-only">Confirm password</span><input id="confirm-password" type={confirmPasswordVisible ? "text" : "password"} autoComplete="new-password" placeholder="Confirm password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /><PasswordToggle visible={confirmPasswordVisible} label={confirmPasswordVisible ? "Hide confirmation password" : "Show confirmation password"} onClick={() => setConfirmPasswordVisible((visible) => !visible)} /></label>}
        <div className="signup-actions"><button className="button-secondary" type="button" disabled={busy} onClick={() => { setStep("identifier"); setFlow(null); setMessage(""); }}>Back</button><button className="button-primary login-submit" disabled={busy}>{busy ? "Please wait…" : flow === "sign-in" ? "Continue" : "Create account"}</button></div>
      </>}
      {flow === "sign-in" && <p className="login-switch">Don’t have an account? <a href={signupHref}>Sign up</a></p>}
      {message && <p className="login-error" role={isError ? "alert" : "status"}>{message}</p>}
    </form>
  </main>;
}

function SignupPasswordCriteria({ value }: { value: string }) {
  const hasMix = /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9\s]/.test(value);
  return <ul className="password-criteria" aria-label="Password requirements"><li className={value.length >= 8 ? "met" : ""}>✓ At least 8 characters</li><li className={hasMix ? "met" : ""}>✓ Mix of letters, numbers, and symbols</li><li className={!/\s/.test(value) ? "met" : ""}>✓ No spaces</li></ul>;
}
