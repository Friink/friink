'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { clearAuthSession, loadPersistedAuthSession, type AuthSession } from '@/lib/auth';
import { ActionMenu } from '@/components/action-menu';
import styles from '@/app/landing.module.css';

type HeaderProps = {
  page?: 'landing' | 'subscriptions';
};

export function Header({ page = 'landing' }: HeaderProps) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setSession(loadPersistedAuthSession());
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
          ) : null}
          {sessionChecked && session ? (
            <>
            <button
              ref={accountTriggerRef}
              className={styles.accountTrigger}
              type="button"
              aria-label="Open account menu"
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
              onClick={() => setAccountMenuOpen((open) => !open)}
            >
              <img
                className={styles.avatar}
                src={session.user.profilePictureUrl || '/media/profile.jpg'}
                alt={session.user.name || session.user.username}
              />
            </button>
            <ActionMenu
              open={accountMenuOpen}
              anchorRef={accountTriggerRef}
              ariaLabel="Account menu"
              className="public-account-menu"
              anchorGap={2}
              offsetX={2}
              header={
                <div className="action-menu-profile">
                  <strong>{session.user.name || session.user.username}</strong>
                  <span>@{session.user.username}</span>
                </div>
              }
              items={[
                { label: 'Feed', icon: 'fa-house', href: '/home' },
                { label: 'Settings', icon: 'fa-gear', href: '/settings' },
                {
                  label: 'Log out',
                  icon: 'fa-right-from-bracket',
                  onClick: () => {
                    clearAuthSession();
                    setSession(null);
                    setAccountMenuOpen(false);
                  },
                },
              ]}
              onClose={() => setAccountMenuOpen(false)}
            />
            </>
          ) : sessionChecked ? (
            <Link className={styles.cta} href="/login">Login</Link>
          ) : <span className={styles.authPlaceholder} aria-hidden="true" />}
        </div>
      </div>
    </nav>
  );
}
