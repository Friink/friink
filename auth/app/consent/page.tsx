"use client";

import { FormEvent, useState } from "react";
import { FlowActions, FlowMessage, FlowShell } from "@/components/auth/flow-shell";

export default function ConsentPage() {
  const [submitted, setSubmitted] = useState(false);
  function submit(event: FormEvent) { event.preventDefault(); setSubmitted(true); }

  return <FlowShell eyebrow="Application access" title="Connect your Friink account." description="Review what this application is requesting before you continue.">
    {!submitted ? <form className="flow-form" onSubmit={submit}><div className="consent-app"><span className="consent-icon">f</span><div><strong>Friink application</strong><span>Requested by a trusted Friink product</span></div></div><ul className="consent-list"><li>View your basic account identity</li><li>Maintain a secure signed-in session</li></ul><p className="flow-footnote">You can revoke access later from an application that manages your account sessions.</p><FlowActions primary="Allow access" secondary="Cancel" /></form> : <div className="flow-success"><span className="flow-status-icon" aria-hidden="true">✓</span><FlowMessage>Access approval is ready for Auth API wiring.</FlowMessage><a className="flow-button flow-button-primary" href="/handoff">Continue</a></div>}
  </FlowShell>;
}
