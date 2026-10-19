import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AccountShell from "@/components/auth/account-shell";
import SessionList from "@/components/auth/session-list";

export default async function SessionsPage() {
  const requestHeaders = await headers();
  const current = await auth.api.getSession({ headers: requestHeaders });
  if (!current) redirect("/");
  if (current.user.onboardingStatus !== "complete" || !current.user.username) redirect("/onboarding");

  const allSessions = await auth.api.listDeviceSessions({ headers: requestHeaders });
  const accountSessions = allSessions.filter((item) => item.user.id === current.user.id);
  const hasCurrentSession = accountSessions.some((item) => item.session.token === current.session.token);
  const sessions = hasCurrentSession
    ? accountSessions
    : [{ user: current.user, session: current.session }, ...accountSessions];
  return <AccountShell username={current.user.username} currentToken={current.session.token} activePath="security">
        <p className="micro">Security</p>
        <h1>Active sessions.</h1>
        <p className="account-lede">Review where your account is signed in and revoke access you no longer recognize.</p>
        <SessionList sessions={sessions.map((item) => ({ ...item.session, updatedAt: item.session.updatedAt.toISOString(), expiresAt: item.session.expiresAt.toISOString() }))} currentToken={current.session.token} />
  </AccountShell>;
}
