"use client";

import { FormEvent, useState } from "react";
import PasswordToggle from "@/components/auth/password-toggle";
import { CodeInput, FlowActions, FlowMessage, FlowShell } from "@/components/auth/flow-shell";

export default function DeleteAccountPage() {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<"confirm" | "code">("confirm");
  const [done, setDone] = useState(false);
  function submit(event: FormEvent) { event.preventDefault(); if (step === "confirm") setStep("code"); else setDone(true); }

  const content = done ? (
    <div className="flow-success"><span className="flow-status-icon" aria-hidden="true">✓</span><FlowMessage>Your deletion request is ready for Auth API wiring.</FlowMessage><a className="flow-button flow-button-primary" href="/">Return to Friink</a></div>
  ) : (
    <form className="flow-form" onSubmit={submit}>
      {step === "confirm" ? <><div className="flow-danger-notice"><strong>This action has lasting consequences</strong><span>Your public identity and user-generated content will be removed after the grace period. Chats and required security records are retained.</span></div><label className="flow-field"><span>Current password</span><span className="flow-password"><input type={visible ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><PasswordToggle visible={visible} label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)} /></span></label><FlowActions primary="Continue to verification" secondary="Keep account" /></> : <><CodeInput value={code} onChange={setCode} label="Deletion confirmation code" /><FlowActions primary="Schedule deletion" secondary="Back" onSecondary={() => setStep("confirm")} /></>}
    </form>
  );

  return <FlowShell eyebrow="Account security" title={done ? "Deletion scheduled." : step === "confirm" ? "Delete your account?" : "Confirm deletion."} description={done ? "Your account is now in its grace period. You can cancel deletion before the deadline." : step === "confirm" ? "This starts a 32-day deletion period. You will be signed out everywhere, and permanent deletion removes Auth identity data at the end of the period." : "Enter the fresh code sent to your email to schedule permanent deletion."}>{content}</FlowShell>;
}
