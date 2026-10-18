import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AccountActions from "@/components/auth/account-actions";
import AccountSwitcherElement from "@/components/auth/account-switcher-element";
import { config } from "@/lib/config";

export default async function MePage() {
  const current = await auth.api.getSession({ headers: await headers() });
  if (!current) redirect("/login");

  const user = current.user;
  const isOnboarded = user.onboardingStatus === "complete" && Boolean(user.username);

  return (
    <div className="account-shell">
      <aside className="account-sidebar">
        <a className="brand" href="/" aria-label="Friink home">m</a>
        <AccountSwitcherElement authUrl={config.authUrl} />
        <nav className="account-nav" aria-label="Account navigation">
          <a href="/me" aria-current="page">Current account</a>
          {isOnboarded && <a href={`/${encodeURIComponent(user.username as string)}`}>Account home</a>}
          <a href="/security/sessions">Sessions &amp; security</a>
        </nav>
        <AccountActions currentToken={current.session.token} />
      </aside>
      <main className="account-content">
        <p className="micro">Current account</p>
        <h1>{user.name}.</h1>
        <p className="account-lede">This is the account currently selected for this auth session.</p>
        <section className="account-card" aria-label="Current account details">
          <span className="account-card-kicker">Account details</span>
          <strong>{user.email}</strong>
          <span>{user.username ? `@${user.username}` : "Username setup pending"}</span>
          <span>{isOnboarded ? "Setup complete" : "Setup pending"}</span>
        </section>
      </main>
    </div>
  );
}
