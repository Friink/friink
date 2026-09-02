import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import styles from './landing.module.css';
import { Header } from '@/components/public-header';
import { SubscribeForm } from './subscribe-form';

export const metadata: Metadata = {
  title: {
    absolute: 'Friink | A place for humans.',
  },
};

export default function HomePage() {
  return (
    <div className={styles.page}>
      <Header />

      <main className={styles.hero}>
        <section className={`${styles.sectionInner} ${styles.heroInner}`}>
          <div className={styles.heroCopy}>
            <h1>A place for humans.</h1>
            <p>A calmer social space unlike anything you have seen so far.</p>
            <div className={styles.heroActions}>
              <Link href="/login" className={styles.cta}>
                Try now
                <svg className={styles.ctaIcon} aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12H19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13 6L19 12L13 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
                <span className={styles.progressValue}>25%</span>
              </div>
              <div className={styles.progressTrack} role="progressbar" aria-label="Development progress" aria-valuenow={25} aria-valuemin={0} aria-valuemax={100}>
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
              <span className={styles.eyebrow}>
                <svg className={styles.eyebrowIcon} aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M2 12C4.8 7.5 8.06 5.25 12 5.25C15.94 5.25 19.2 7.5 22 12C19.2 16.5 15.94 18.75 12 18.75C8.06 18.75 4.8 16.5 2 12Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.9" />
                </svg>
                Our vision
              </span>
              <h2>Designing for clarity, and peace.</h2>
              <p>
                Social spaces are noisy, overwhelming, and built to keep you scrolling. We are building Friink with a different philosophy.
                It is a space designed to support your active life, offering a refreshing digital environment that respects you and your
                well-being. The goal is to create a social space that promotes human connection.
              </p>
            </div>
          </div>
        </section>

        <section id="plans" className={styles.plans}>
          <div className={`${styles.sectionInner} ${styles.plansInner}`}>
            <span className={styles.eyebrow}>Plans</span>
            <h2>Choose your pace.</h2>
            <p className={styles.plansIntro}>Start free and find the level of Friink that fits the way you connect.</p>
            <div className={styles.plansGrid}>
              <article className={styles.planCard}>
                <p className={styles.planName}>Friink Free</p>
                <p className={styles.planPrice}>Free</p>
                <p className={styles.planDescription}>A calm place to stay connected.</p>
                <ul className={styles.planList}>
                  <li>Never expires</li>
                  <li>Unlimited posts, replies, and quotes</li>
                  <li>Message your connections</li>
                </ul>
                <Link href="/login" className={`${styles.cta} ${styles.secondaryCta}`}>Start free</Link>
              </article>
              <article className={`${styles.planCard} ${styles.planCardFeatured}`}>
                <span className={styles.planBadge}>Most useful</span>
                <p className={styles.planName}>Friink Pro</p>
                <p className={styles.planPrice}>USD 4<span>/month</span></p>
                <p className={styles.planDescription}>More room for your voice and your work.</p>
                <ul className={styles.planList}>
                  <li>Everything in Free</li>
                  <li>Message requests to non-connections</li>
                  <li>Profile boost and profile views</li>
                  <li>Posts, replies, and quotes up to 512 characters</li>
                  <li>Optional professional verification</li>
                </ul>
                <span className={styles.planComingSoon}>Coming soon</span>
              </article>
              <article className={styles.planCard}>
                <p className={styles.planName}>Friink Pro+</p>
                <p className={styles.planPrice}>USD 8<span>/month</span></p>
                <p className={styles.planDescription}>A fuller view of your presence on Friink.</p>
                <ul className={styles.planList}>
                  <li>Everything in Pro</li>
                  <li>Pro badge</li>
                  <li>Profile and post analytics</li>
                </ul>
                <span className={styles.planComingSoon}>Coming soon</span>
              </article>
            </div>
            <Link href="/subscriptions" className={styles.plansLink}>Compare all plans <span aria-hidden="true">→</span></Link>
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
