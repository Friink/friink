import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AccountShell from "@/components/auth/account-shell";

export default async function SecurityPage() {
  const current = await auth.api.getSession({ headers: await headers() });
  if (!current) redirect("/login");
  if (!current.user.username || current.user.onboardingStatus !== "complete") redirect("/onboarding");
  return <AccountShell username={current.user.username} currentToken={current.session.token} activePath="security"><p className="micro">Account security</p><h1>Security.</h1><p className="account-lede">Review and protect the ways your Friink account can be accessed.</p><div className="security-grid"><a className="account-card" href="/security/sessions"><strong>Sessions</strong><span>Review active devices and revoke access you no longer recognize.</span></a><a className="account-card" href="/email"><strong>Email and verification</strong><span>Manage your sign-in email and verification status.</span></a><a className="account-card" href="/settings"><strong>Password and settings</strong><span>Manage account details and sign-in preferences.</span></a></div></AccountShell>;
}
