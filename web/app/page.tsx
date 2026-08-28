import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import styles from './landing.module.css';
import { LandingAuthRedirect } from './landing-auth-redirect';
import { SubscribeForm } from './subscribe-form';

export const metadata: Metadata = {
  title: {
    absolute: 'Friink | Home',
  },
};

export default function HomePage() {
  return (
    <div className={styles.page}>
      <LandingAuthRedirect />
      <nav className={styles.nav} aria-label="Marketing navigation">
        <div className={styles.navInner}>
          <Link href="/" aria-label="Friink home">
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet="/brand/logoFullWhite.svg" />
              <Image src="/brand/logoFullBlack.svg" alt="Friink" width={176} height={56} className={styles.logoFull} priority />
            </picture>
          </Link>
          <div className={styles.navLinks}>
            <a className={styles.navLink} href="#vision">Our vision</a>
            <Link className={styles.cta} href="/login">Early access</Link>
          </div>
          <Link className={`${styles.cta} ${styles.mobileCta}`} href="/login">Early access</Link>
        </div>
      </nav>

      <main className={styles.hero}>
        <section className={`${styles.sectionInner} ${styles.heroInner}`}>
          <div className={styles.heroCopy}>
            <h1>A place for humans.</h1>
            <p>A calmer social space unlike anything you have seen so far.</p>
            <div className={styles.heroActions}>
              <Link href="/login" className={styles.cta}>
                Try now <span className={styles.ctaArrow} aria-hidden="true">-&gt;</span>
              </Link>
              <a href="#subscribe" className={`${styles.cta} ${styles.secondaryCta}`}>Subscribe</a>
            </div>
          </div>
        </section>

        <section id="progress" className={styles.progress}>
          <div className={styles.sectionInner}>
            <div className={styles.progressCard}>
              <div className={styles.progressHeader}>
                <div>
                  <h2>Under Development</h2>
                  <p>Laying the foundation for a better space.</p>
                </div>
                <span className={styles.progressValue}>10%</span>
              </div>
              <div className={styles.progressTrack} role="progressbar" aria-label="Development progress" aria-valuenow={10} aria-valuemin={0} aria-valuemax={100}>
                <div className={styles.progressFill} />
              </div>
            </div>
          </div>
        </section>

        <section id="vision" className={styles.vision}>
          <div className={`${styles.sectionInner} ${styles.visionGrid}`}>
            <div className={styles.visionImage}>
              <Image src="/media/pexels-ryank-17841014.jpg" alt="An abstract image representing clarity emerging from chaos" width={900} height={620} />
            </div>
            <div className={styles.visionCopy}>
              <span className={styles.eyebrow}>Our vision</span>
              <h2>Designing for clarity, and peace.</h2>
              <p>
                Social spaces are noisy, overwhelming, and built to keep you scrolling. We are building Friink with a different philosophy.
                It is a space designed to support your active life, offering a refreshing digital environment that respects you and your
                well-being. The goal is to create a social space that promotes human connection.
              </p>
            </div>
          </div>
        </section>

        <section id="subscribe" className={styles.subscribe}>
          <div className={`${styles.sectionInner} ${styles.subscribeInner}`}>
            <svg className={styles.drop} aria-hidden="true" width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12,2c-5.33,4.55-8,8.48-8,11.8c0,4.98,3.8,8.2,8,8.2s8-3.22,8-8.2C20,10.48,17.33,6.55,12,2z M7.83,14 c0.37,0,0.67,0.26,0.74,0.62c0.41,2.22,2.28,2.98,3.64,2.87c0.43-0.02,0.79,0.32,0.79,0.75c0,0.4-0.32,0.73-0.72,0.75 c-2.13,0.13-4.62-1.09-5.19-4.12C7.01,14.42,7.37,14,7.83,14z" />
            </svg>
            <h2>Be part of the beginning.</h2>
            <p>Join the newsletter to get notified when we open the doors.</p>
            <SubscribeForm />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <picture>
            <source media="(prefers-color-scheme: dark)" srcSet="/brand/logoWhite.svg" />
            <Image src="/brand/logoBlack.svg" alt="Friink" width={64} height={64} className={styles.footerLogo} />
          </picture>
          <p>&copy; 2026 Friink. Built for humans.</p>
        </div>
      </footer>
    </div>
  );
}
