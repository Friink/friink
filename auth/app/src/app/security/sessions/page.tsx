import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AccountActions from "@/components/auth/account-actions";
import AccountSwitcherElement from "@/components/auth/account-switcher-element";
import SessionList from "@/components/auth/session-list";
import { config } from "@/lib/config";

export default async function SessionsPage() {
  const requestHeaders = await headers();
  const current = await auth.api.getSession({ headers: requestHeaders });
  if (!current) redirect("/");
  if (current.user.onboardingStatus !== "complete" || !current.user.username) redirect("/onboarding");

  const allSessions = await auth.api.listDeviceSessions({ headers: requestHeaders });
  const sessions = allSessions.filter((item) => item.user.id === current.user.id);
  return (
    <div className="account-shell">
      <aside className="account-sidebar">
        <a className="brand" href="/" aria-label="Friink home">m</a>
        <AccountSwitcherElement authUrl={config.authUrl} />
        <nav className="account-nav" aria-label="Account navigation">
          <a href={`/${encodeURIComponent(current.user.username)}`}>Account home</a>
          <a href="/security/sessions" aria-current="page">Sessions &amp; security</a>
        </nav>
        <AccountActions currentToken={current.session.token} />
      </aside>
      <main className="account-content">
        <p className="micro">Security</p>
        <h1>Active sessions.</h1>
        <p className="account-lede">Review where your account is signed in and revoke access you no longer recognize.</p>
        <SessionList sessions={sessions.map((item) => ({ ...item.session, updatedAt: item.session.updatedAt.toISOString(), expiresAt: item.session.expiresAt.toISOString() }))} currentToken={current.session.token} />
      </main>
    </div>
  );
}
