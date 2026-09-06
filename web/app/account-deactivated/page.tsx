import Link from 'next/link';

export default function AccountDeactivatedPage() {
  return (
    <main className="login-screen">
      <section className="login-form" aria-labelledby="account-deactivated-title">
        <h1 id="account-deactivated-title">Your account is deactivated</h1>
        <p>All Friink sessions have been logged out. Your profile and public content are unavailable for now.</p>
        <p>If you have an uncancelled subscription, billing may continue. You can come back anytime and reactivate your account with a verified login.</p>
        <Link className="login-submit" href="/login">Return to login</Link>
      </section>
    </main>
  );
}
