import Link from "next/link";
import { FlowShell } from "@/components/auth/flow-shell";

export default function HandoffErrorPage() {
  return <FlowShell eyebrow="Secure handoff" title="We couldn’t return you." description="The requested destination was unavailable or is not trusted by Friink. Your Auth session has not been changed.">
    <div className="flow-error-card"><span className="flow-status-icon flow-status-icon-error" aria-hidden="true">!</span><p>Try starting the sign-in flow again from the application you were using.</p><Link className="flow-button flow-button-primary" href="/start">Return to sign in</Link></div>
  </FlowShell>;
}
