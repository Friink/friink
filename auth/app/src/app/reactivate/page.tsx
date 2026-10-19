"use client";

import { FormEvent, useState } from "react";
import PasswordToggle from "@/components/auth/password-toggle";
import { CodeInput, FlowActions, FlowMessage, FlowShell } from "@/components/auth/flow-shell";

export default function ReactivatePage() {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<"password" | "code">("password");
  const [message, setMessage] = useState("");

  function submit(event: FormEvent) { event.preventDefault(); if (step === "password") setStep("code"); else setMessage("Reactivation is ready for Auth API wiring."); }

  return <FlowShell eyebrow="Account recovery" title="Welcome back." description={step === "password" ? "Confirm your password to begin reactivating this account." : "Enter the fresh code sent to your email to finish reactivation."}>
    <form className="flow-form" onSubmit={submit}>
      {step === "password" ? <label className="flow-field"><span>Current password</span><span className="flow-password"><input type={visible ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><PasswordToggle visible={visible} label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)} /></span></label> : <CodeInput value={code} onChange={setCode} label="Reactivation code" />}
      <FlowActions primary={step === "password" ? "Send verification code" : "Reactivate account"} secondary={step === "code" ? "Back" : undefined} onSecondary={() => setStep("password")} />
      {message && <FlowMessage>{message}</FlowMessage>}
    </form>
  </FlowShell>;
}
