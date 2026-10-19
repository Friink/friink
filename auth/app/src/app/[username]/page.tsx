import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AccountActions from "@/components/auth/account-actions";
import AccountSwitcherElement from "@/components/auth/account-switcher-element";
import { config } from "@/lib/config";

export default async function AccountHome({ params }: { params: Promise<{ username: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  if (session.user.onboardingStatus !== "complete" || !session.user.username) redirect("/onboarding");

  const { username } = await params;
  if (username.toLowerCase() !== session.user.username.toLowerCase()) redirect(`/${encodeURIComponent(session.user.username)}`);
  return (
    <div className="account-shell">
      <aside className="account-sidebar">
        <a className="brand" href="/" aria-label="Friink home">m</a>
        <AccountSwitcherElement authUrl={config.authUrl} />
        <nav className="account-nav" aria-label="Account navigation">
          <a href={`/${encodeURIComponent(session.user.username)}`} aria-current="page">Account home</a>
          <a href="/security/sessions">Sessions &amp; security</a>
        </nav>
        <AccountActions currentToken={session.session.token} />
      </aside>
      <main className="account-content">
        <p className="micro">Friink account</p>
        <h1>Welcome, {session.user.name.split(" ")[0]}.</h1>
        <p className="account-lede">Your account is ready. This pilot account home is intentionally small; connected products will appear here as they are registered.</p>
        <div className="account-card"><span className="account-card-kicker">Signed in as</span><strong>@{session.user.username}</strong><span>{session.user.email}</span></div>
      </main>
    </div>
  );
}
