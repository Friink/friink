import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { AuthShell } from '@friink/auth-ui';
import { auth } from '@/lib/auth';
import { AccountSwitcherElement } from '@/components/account-switcher-element';

export const metadata: Metadata = {
  title: 'My account',
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(value);
}

export default async function MePage() {
  const current = await auth.api.getSession({ headers: await headers() });

  if (!current) {
    return (
      <AuthShell>
        <div className="friink-auth-me">
          <div className="friink-auth-step-copy">
            <p>You’re not signed in</p>
            <span>Sign in to view the active Friink account session.</span>
          </div>
          <a className="friink-auth-primary" href="/login">Go to login</a>
        </div>
      </AuthShell>
    );
  }

  const user = current.user as typeof current.user & { username?: string };
  const details = [
    ['Name', user.name],
    ['Username', user.username ? `@${user.username}` : 'Not set'],
    ['Email', user.email],
    ['Email verified', user.emailVerified ? 'Yes' : 'No'],
    ['User ID', user.id],
    ['Session expires', formatDate(current.session.expiresAt)],
  ];

  return (
    <AuthShell>
      <div className="friink-auth-me">
        <AccountSwitcherElement />
        <div className="friink-auth-step-copy">
          <p>Active session</p>
          <span>This is the Friink account currently authenticated in this browser.</span>
        </div>
        <dl className="friink-auth-me-details">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <div className="friink-auth-actions">
          <a className="friink-auth-secondary" href="/">Home</a>
          <a className="friink-auth-primary" href="/login">Switch account</a>
        </div>
      </div>
    </AuthShell>
  );
}
