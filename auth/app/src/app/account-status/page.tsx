import Link from "next/link";
import { FlowShell } from "@/components/auth/flow-shell";

export default function AccountStatusPage() {
  return <FlowShell eyebrow="Account status" title="Your account needs attention." description="Choose the secure recovery action that matches your account status.">
    <div className="status-options"><Link className="status-option" href="/reactivate"><strong>Reactivate account</strong><span>Restore access to an account you deactivated.</span><b aria-hidden="true">→</b></Link><Link className="status-option" href="/deletion-cancel"><strong>Cancel deletion</strong><span>Keep an account that is scheduled for deletion.</span><b aria-hidden="true">→</b></Link></div>
  </FlowShell>;
}
