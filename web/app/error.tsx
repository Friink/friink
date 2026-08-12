'use client';

import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const code = error?.digest ?? 'xxx';

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
          width: 44,
          height: 44,
          borderRadius: 14,
          display: 'grid',
          placeItems: 'center',
          background: '#edf5ef',
          color: '#1c9a54',
          border: '1px solid rgba(28, 154, 84, 0.2)',
          boxShadow: '0 10px 25px rgba(17, 20, 20, 0.06)',
          textDecoration: 'none',
        }}
      >
        <span aria-hidden="true" style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
          F
        </span>
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
          there appears to be something wrong
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: '1rem',
            color: '#4d5854',
            letterSpacing: '0.01em',
          }}
        >
          Error code: {code}
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
