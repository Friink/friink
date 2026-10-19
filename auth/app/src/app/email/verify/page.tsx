"use client";

import { FormEvent, useState } from "react";
import { CodeInput, FlowActions, FlowMessage, FlowShell } from "@/components/auth/flow-shell";

export default function VerifyEmailPage() {
  const [code, setCode] = useState("");
  const [done, setDone] = useState(false);

  function submit(event: FormEvent) { event.preventDefault(); setDone(true); }

  return <FlowShell title={done ? "Email verified." : "Verify your new email."} description={done ? "Your email address is ready to use with Friink." : "Enter the code sent to your new email address."} backHref="/me" backLabel="Return to account">
    {done ? <div className="flow-success"><span className="flow-status-icon" aria-hidden="true">✓</span><FlowMessage>Your email verification flow is complete.</FlowMessage><a className="flow-button flow-button-primary" href="/me">Return to account</a></div> : <form className="flow-form" onSubmit={submit}><CodeInput value={code} onChange={setCode} label="Email verification code" /><FlowActions primary="Verify email" /><button className="flow-link-button" type="button">Send a new code</button></form>}
  </FlowShell>;
}
