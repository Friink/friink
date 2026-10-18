import Link from 'next/link';
import { AuthShell } from '@friink/auth-ui';

export default function NotFound() {
  return (
    <AuthShell>
      <div className="friink-auth-fields">
        <div className="friink-auth-step-copy">
          <p>That page isn’t here</p>
          <span>The Friink auth page you requested could not be found.</span>
        </div>
        <Link className="friink-auth-primary" href="/login">Return to login</Link>
      </div>
    </AuthShell>
  );
}
