'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FriinkLogo } from '@/components/friink-logo';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const code = resolveErrorCode(error);

  useEffect(() => {
    document.title = `Friink | Error (${code})`;
  }, [code]);

  // apply theme on client only to avoid hydration mismatch
  // cookie wins, otherwise use system preference
  const darkVars: Record<string, string> = {
    '--color-background': '#333333',
    '--color-background-accent': '#3a3a3a',
    '--color-paper': '#3d3d3d',
    '--color-ink': '#f5f5f5',
    '--color-muted': '#c4c4c4',
    '--color-line': '#555555',
    '--color-brand-soft': '#244d30',
    '--color-chrome': '#262626',
  };

  // set CSS variables on mount if dark should be used
  if (typeof window !== 'undefined') {
    // run after paint to avoid SSR mismatch
    requestAnimationFrame(() => {
      try {
        const m = document.cookie.match(/(?:^|; )friink_appearance=([^;]+)/);
        const appearance = m && m[1] ? decodeURIComponent(m[1]) : null;
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const useDark = appearance === 'dark' || appearance === null || appearance === 'system' ? prefersDark : appearance === 'dark';

        if (useDark) {
          const root = document.documentElement;
          Object.entries(darkVars).forEach(([k, v]) => root.style.setProperty(k, v));
        }
      } catch (e) {
        // ignore
      }
    });
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-background)',
        color: 'var(--color-ink)',
        fontFamily: 'var(--font-body)',
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
          background: 'transparent',
          color: 'var(--color-brand)',
          border: 'none',
          boxShadow: 'none',
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
            fontSize: 'clamp(1.75rem, 3.5vw, 2.25rem)',
            lineHeight: 1.12,
            letterSpacing: '-0.02em',
            fontWeight: 700,
            color: 'var(--color-ink)',
          }}
        >
          It looks like we ran into a problem.
        </h1>

        <p
          style={{
            margin: 0,
            fontSize: '1.5rem',
            color: 'var(--color-muted)',
            letterSpacing: '0.01em',
            fontWeight: 700,
          }}
        >
          {`Error Code: ${code}`}
        </p>

        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" onClick={() => reset()} className="signup-back-button">
            Try again
          </button>

          <GoBackButton />
        </div>
      </div>
    </main>
  );
}

function GoBackButton() {
  const router = useRouter();

  const handleGoBack = () => {
    try {
      const hasReferrer = typeof document !== 'undefined' && !!document.referrer;
      const hasHistory = typeof window !== 'undefined' && window.history && window.history.length > 1;

      if (hasReferrer || hasHistory) {
        router.back();
        return;
      }
    } catch (e) {
      // ignore
    }

    router.push('/');
  };

  return (
    <button type="button" onClick={handleGoBack} className="pill-button pill-button-brand">
      Go back
    </button>
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
