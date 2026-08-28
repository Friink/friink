import type { Metadata } from 'next';
import Link from 'next/link';
import { NotFoundTitle } from './not-found-title';

export const metadata: Metadata = {
  title: {
    absolute: 'Friink | Error (404)',
  },
};

export default function NotFound() {
  return (
    <main className="error-page">
      <NotFoundTitle />
      <section className="error-card" aria-labelledby="not-found-title">
        <p className="error-code">404</p>
        <h1 id="not-found-title">Page not found</h1>
        <p className="error-message">This route does not exist or has been removed.</p>
        <Link className="error-action" href="/">
          Go home
        </Link>
      </section>
    </main>
  );
}
