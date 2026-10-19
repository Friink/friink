import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AccountShell from "@/components/auth/account-shell";

export default async function AccountHome({ params }: { params: Promise<{ username: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  if (session.user.onboardingStatus !== "complete" || !session.user.username) redirect("/onboarding");

  const { username } = await params;
  if (username.toLowerCase() !== session.user.username.toLowerCase()) redirect(`/${encodeURIComponent(session.user.username)}`);
  return <AccountShell username={session.user.username} currentToken={session.session.token} activePath="profile">
        <p className="micro">Friink account</p>
        <h1>Welcome, {session.user.name.split(" ")[0]}.</h1>
        <p className="account-lede">Your account is ready. This pilot account home is intentionally small; connected products will appear here as they are registered.</p>
        <div className="account-card"><span className="account-card-kicker">Signed in as</span><strong>@{session.user.username}</strong><span>{session.user.email}</span></div>
  </AccountShell>;
}
