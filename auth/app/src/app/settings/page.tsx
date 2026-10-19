import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AccountShell from "@/components/auth/account-shell";

export default async function SettingsPage() {
  const current = await auth.api.getSession({ headers: await headers() });
  if (!current) redirect("/login");
  if (!current.user.username || current.user.onboardingStatus !== "complete") redirect("/onboarding");
  return <AccountShell username={current.user.username} currentToken={current.session.token} activePath="settings"><p className="micro">Account settings</p><h1>Settings.</h1><p className="account-lede">Keep your identity and account preferences up to date.</p><div className="security-grid"><a className="account-card" href="/email"><strong>Email address</strong><span>Change the email used for sign-in and verification.</span></a><a className="account-card" href="/security"><strong>Security</strong><span>Review active sessions and account protection.</span></a><a className="account-card" href="/account-status"><strong>Account status</strong><span>Review recovery and lifecycle actions when your account needs attention.</span></a></div></AccountShell>;
}
