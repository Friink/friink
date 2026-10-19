"use client";

import { FormEvent, useState } from "react";
import { CodeInput, FlowActions, FlowMessage, FlowShell } from "@/components/auth/flow-shell";

export default function DeletionCancelPage() {
  const [code, setCode] = useState("");
  const [done, setDone] = useState(false);
  function submit(event: FormEvent) { event.preventDefault(); setDone(true); }

  return <FlowShell eyebrow="Account recovery" title={done ? "Deletion cancelled." : "Keep your account."} description={done ? "Your account is active again. You can continue using Friink." : "A deletion request is active for this account. Verify your email to cancel it before the grace period ends."}>
    {done ? <div className="flow-success"><span className="flow-status-icon" aria-hidden="true">✓</span><FlowMessage>Your deletion cancellation flow is complete.</FlowMessage><a className="flow-button flow-button-primary" href="/start">Continue to Friink</a></div> : <form className="flow-form" onSubmit={submit}><div className="flow-notice"><strong>Deletion scheduled</strong><span>Your account remains recoverable during the 32-day grace period.</span></div><CodeInput value={code} onChange={setCode} label="Cancellation code" /><FlowActions primary="Cancel deletion" /></form>}
  </FlowShell>;
}
