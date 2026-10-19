import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AccountShell from "@/components/auth/account-shell";

export default async function MePage() {
  const current = await auth.api.getSession({ headers: await headers() });
  if (!current) redirect("/login");

  const user = current.user;
  const isOnboarded = user.onboardingStatus === "complete" && Boolean(user.username);

  return <AccountShell username={user.username} currentToken={current.session.token} activePath="profile">
        <p className="micro">Current account</p>
        <h1>{user.name}.</h1>
        <p className="account-lede">This is the account currently selected for this auth session.</p>
        <section className="account-card" aria-label="Current account details">
          <span className="account-card-kicker">Account details</span>
          <strong>{user.email}</strong>
          <span>{user.username ? `@${user.username}` : "Username setup pending"}</span>
          <span>{isOnboarded ? "Setup complete" : "Setup pending"}</span>
        </section>
  </AccountShell>;
}
