'use client';

import Link from 'next/link';
import { FriinkLogo } from '@/components/friink-logo';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const code = resolveErrorCode(error);

  return (
    <main className="error-page">
      <div className="error-content">
        <img src="/brand/logoFullBrand.svg" alt="Friink" className="error-logo" />

        <h1>It looks like we ran into a problem.</h1>

        <p className="error-code">Error code {code}</p>

        <div className="error-actions">
          <button type="button" onClick={() => reset()} className="error-try">
            Try again
          </button>
          <Link href="/" className="error-home">
            Back to Friink
          </Link>
        </div>
      </div>
    </main>
  );
}

function resolveErrorCode(error: Error & { digest?: string }): number {
  const digestCode = Number.parseInt(error?.digest ?? '', 10);

  if (Number.isInteger(digestCode) && digestCode >= 100 && digestCode <= 599) {
    return digestCode;
  }

  if (error?.message?.includes('NEXT_NOT_FOUND')) {
    return 404;
  }

  if (error?.message?.includes('NEXT_REDIRECT')) {
    return 307;
  }

  return 500;
}
