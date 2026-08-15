'use client';

import Link from 'next/link';
import { FriinkLogo } from '@/components/friink-logo';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const code = resolveErrorCode(error);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9f9f9',
        color: '#171b1a',
        fontFamily: 'Nunito Local, sans-serif',
        position: 'relative',
      }}
    >
      <Link
        href="/"
        aria-label="Back to Friink"
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          width: 48,
          height: 48,
          borderRadius: 16,
          display: 'grid',
          placeItems: 'center',
          background: '#ffffff',
          color: '#1c9a54',
          border: '1px solid rgba(28, 154, 84, 0.2)',
          boxShadow: '0 10px 25px rgba(17, 20, 20, 0.08)',
          textDecoration: 'none',
        }}
      >
        <FriinkLogo />
      </Link>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 18,
          padding: '32px 24px',
          maxWidth: 560,
        }}
      >
        <img
          src="/brand/logoFullBrand.svg"
          alt="Friink"
          style={{
            width: 'min(240px, 60vw)',
            height: 'auto',
            display: 'block',
          }}
        />

        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            lineHeight: 1.1,
            letterSpacing: '-0.04em',
            fontWeight: 700,
          }}
        >
          It looks like we ran into a problem.
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: '1rem',
            color: '#4d5854',
            letterSpacing: '0.01em',
          }}
        >
          Error code {code}
        </p>

        <button
          type="button"
          onClick={() => reset()}
          style={{
            border: 'none',
            borderRadius: 999,
            background: '#33aa55',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: 14,
            padding: '12px 22px',
            cursor: 'pointer',
            boxShadow: '0 12px 30px rgba(51, 170, 85, 0.2)',
          }}
        >
          Try again
        </button>
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
