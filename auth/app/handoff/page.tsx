import Link from "next/link";
import { FlowShell } from "@/components/auth/flow-shell";

export default function HandoffPage() {
  return <FlowShell eyebrow="Secure handoff" title="Returning you to Friink." description="Your Auth session is ready. We’re taking you back to the application that requested sign-in.">
    <div className="handoff-state"><span className="handoff-spinner" aria-hidden="true" /><p>Checking the return destination…</p><Link className="flow-link-button" href="/handoff/error">Something went wrong?</Link></div>
  </FlowShell>;
}
