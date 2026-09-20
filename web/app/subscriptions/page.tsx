import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import styles from '../landing.module.css';
import { Header } from '@/components/public-header';
import { PublicRouteGuard } from '@/components/public-route-guard';

export const metadata: Metadata = {
  title: 'Plans',
  description: 'Choose the Friink plan that fits the way you connect.',
};

const plans = [
  { name: 'Friink Free', price: 'Free', description: 'Everything you need to connect and create.', features: ['Never expires', 'Unlimited posts, replies, and quotes', 'Chat with mutual followers', 'Use Friink as a professional'], action: 'Start free', featured: false },
  { name: 'Friink Pro', price: 'USD 4', cadence: '/month after the first month', description: 'More room for your voice, work, and connections.', features: ['Everything in Free', 'Message requests', 'Profile view count', 'Posts up to 512 characters', 'Directory listing for registered professionals'], featured: true },
  { name: 'Friink Pro+', price: 'USD 8', cadence: '/month · 1 month free for Pro users', description: 'A fuller view of your presence on Friink.', features: ['Everything in Pro', 'Profile and post analytics', 'Profile boost for the feed', 'Fewer ads'], featured: false },
];

export default function SubscriptionsPage() {
  return (
    <PublicRouteGuard>
      <div className={styles.page}>
      <Header page="subscriptions" />

      <main className={styles.plansPage}>
        <section className={`${styles.sectionInner} ${styles.plansPageInner}`}>
          <span className={styles.eyebrow}>Plans</span>
          <h1>Find your place here.</h1>
          <p className={styles.plansIntro}>Start free. Upgrade when you want more room to connect, create, and understand your presence on Friink.</p>
          <div className={styles.plansGrid}>
            {plans.map((plan) => (
              <article className={`${styles.planCard} ${plan.featured ? styles.planCardFeatured : ''}`} key={plan.name}>
                {plan.featured ? <span className={styles.planBadge}>Most useful</span> : null}
                <p className={styles.planName}>{plan.name}</p>
                <p className={styles.planPrice}>{plan.price}{plan.cadence ? <span>{plan.cadence}</span> : null}</p>
                <p className={styles.planDescription}>{plan.description}</p>
                <ul className={styles.planList}>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                {plan.action ? <Link href="/login" className={`${styles.cta} ${styles.secondaryCta}`}>{plan.action}</Link> : <span className={styles.planComingSoon}>Coming soon</span>}
              </article>
            ))}
          </div>
          <p className={styles.plansNote}>Paid plans are being prepared. Your Free account will always remain available.</p>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Link href="/" aria-label="Friink home">
            <picture>
              <source media="(prefers-color-scheme: dark)" srcSet="/brand/logoWhite.svg" />
              <Image src="/brand/logoBlack.svg" alt="Friink" width={96} height={97} className={styles.footerLogo} />
            </picture>
          </Link>
          <p>&copy; 2026 Friink. Built for humans.</p>
        </div>
      </footer>
      </div>
    </PublicRouteGuard>
  );
}
