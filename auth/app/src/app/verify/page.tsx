"use client";

import { FormEvent, useState } from "react";
import { CodeInput, FlowActions, FlowMessage, FlowShell } from "@/components/auth/flow-shell";

export default function VerifyPage() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    window.setTimeout(() => { setBusy(false); setComplete(true); setMessage("Verification complete. The next Auth step can be connected here."); }, 350);
  }

  return <FlowShell title={complete ? "You’re verified." : "Check your email."} description={complete ? "Your code was accepted. You can safely continue." : "Enter the six-digit code we sent to your email. It expires soon for your security."}>
    {!complete ? <form className="flow-form" onSubmit={submit}><CodeInput value={code} onChange={setCode} /><FlowActions primary={busy ? "Verifying…" : "Verify code"} disabled={busy} /><button className="flow-link-button" type="button" disabled={busy} onClick={() => setMessage("A fresh code request is ready for Auth API wiring.")}>Resend code</button>{message && <FlowMessage>{message}</FlowMessage>}</form> : <div className="flow-success"><span className="flow-status-icon" aria-hidden="true">✓</span>{message && <FlowMessage>{message}</FlowMessage>}<a className="flow-button flow-button-primary" href="/start">Continue to Friink</a></div>}
  </FlowShell>;
}
