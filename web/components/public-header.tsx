'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { loadPersistedAuthSession, type AuthSession } from '@/lib/auth';
import styles from '@/app/landing.module.css';

type HeaderProps = {
  page?: 'landing' | 'subscriptions';
};

function getReturnPath() {
  if (typeof window === 'undefined') return '/home';

  try {
    const referrer = document.referrer ? new URL(document.referrer) : null;
    if (referrer?.origin === window.location.origin && referrer.pathname !== '/subscriptions') {
      return `${referrer.pathname}${referrer.search}${referrer.hash}`;
    }
  } catch {
    // Keep the stable app destination when referrer data is unavailable.
  }

  return '/home';
}

export function Header({ page = 'landing' }: HeaderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [returnPath, setReturnPath] = useState('/home');

  useEffect(() => {
    setSession(loadPersistedAuthSession());
    setReturnPath(getReturnPath());
    setSessionChecked(true);
  }, []);

  return (
    <nav className={styles.nav} aria-label="Site navigation">
      <div className={styles.navInner}>
        <Link href="/" aria-label="Friink home">
          <picture>
            <source media="(prefers-color-scheme: dark)" srcSet="/brand/logoFullWhite.svg" />
            <Image src="/brand/logoFullBlack.svg" alt="Friink" width={176} height={56} className={styles.logoFull} priority />
          </picture>
        </Link>
        <div className={styles.navActions}>
          {page === 'landing' ? (
            <>
              <a className={styles.navLink} href="#vision">Our vision</a>
              <Link className={styles.navLink} href="#plans">Plans</Link>
            </>
          ) : <Link className={styles.navLink} href="/">Home</Link>}
          {sessionChecked && session ? (
            <Link className={styles.avatarLink} href={returnPath} aria-label="Return to Friink">
              <img
                className={styles.avatar}
                src={session.user.profilePictureUrl || '/media/profile.jpg'}
                alt={session.user.name || session.user.username}
              />
            </Link>
          ) : sessionChecked ? (
            <Link className={styles.cta} href="/login">Login</Link>
          ) : <span className={styles.authPlaceholder} aria-hidden="true" />}
        </div>
      </div>
    </nav>
  );
}
