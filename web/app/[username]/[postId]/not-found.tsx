import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="error-page post-unavailable">
      <h1>Post unavailable</h1>
      <p>This post may have been deleted or is no longer visible to you.</p>
      <Link href="/home">Go home</Link>
    </main>
  );
}
