import Link from "next/link";
import { FlowShell } from "@/components/auth/flow-shell";

export default function LinkExpiredPage() {
  return <FlowShell eyebrow="Secure link" title="This link has expired." description="For your security, Auth links and verification codes can only be used for a limited time.">
    <div className="flow-error-card"><span className="flow-status-icon flow-status-icon-error" aria-hidden="true">!</span><p>Request a fresh link or return to the sign-in screen to begin again.</p><Link className="flow-button flow-button-primary" href="/start">Start again</Link></div>
  </FlowShell>;
}
