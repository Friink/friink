import Link from 'next/link';

export default function AccountDeletionStartedPage() {
  return (
    <main className="login-screen">
      <section className="login-form" aria-labelledby="account-deletion-title">
        <h1 id="account-deletion-title">Your account is scheduled for deletion</h1>
        <p>Your sessions have been logged out. You can return during the grace period and verify your account to cancel deletion.</p>
        <Link className="login-submit" href="/login">Return to login</Link>
      </section>
    </main>
  );
}
