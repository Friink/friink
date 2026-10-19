"use client";

import { FormEvent, useState } from "react";
import PasswordToggle from "@/components/auth/password-toggle";
import { FlowActions, FlowMessage, FlowShell } from "@/components/auth/flow-shell";

export default function DeactivatePage() {
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);
  function submit(event: FormEvent) { event.preventDefault(); setDone(true); }

  const content = done ? (
    <div className="flow-success"><span className="flow-status-icon" aria-hidden="true">✓</span><FlowMessage>Your deactivation flow is complete and ready for Auth API wiring.</FlowMessage><a className="flow-button flow-button-primary" href="/">Return to Friink</a></div>
  ) : (
    <form className="flow-form" onSubmit={submit}>
      <div className="flow-notice"><strong>Before you continue</strong><span>You will be signed out on every device. Existing conversations remain available according to Friink’s account policy.</span></div>
      <label className="flow-field"><span>Current password</span><span className="flow-password"><input type={visible ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /><PasswordToggle visible={visible} label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)} /></span></label>
      <FlowActions primary="Deactivate account" secondary="Keep account" />
    </form>
  );

  return <FlowShell eyebrow="Account security" title={done ? "Account deactivated." : "Take a pause."} description={done ? "Your sessions have been ended. You can reactivate this account by signing in again." : "Deactivation ends every Auth session immediately. Your email and username remain reserved, and an active subscription is not cancelled."}>{content}</FlowShell>;
}
