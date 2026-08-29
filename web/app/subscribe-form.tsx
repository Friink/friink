"use client";

import { useState } from 'react';
import styles from './landing.module.css';

export function SubscribeForm() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
      <iframe name="zoho-hidden-frame" id="zoho-hidden-frame" className={styles.hiddenFrame} aria-hidden="true" />
      <form
        className={styles.form}
        action="https://forms.zohopublic.com/adminfri1/form/EmailSubscription/formperma/d8QCBbrRcMNOVCT7RQnWYneUowki3t51BQlD8LRoTig/htmlRecords/submit"
        method="POST"
        acceptCharset="UTF-8"
        encType="multipart/form-data"
        target="zoho-hidden-frame"
        onSubmit={() => {
          window.setTimeout(() => setSubmitted(true), 500);
        }}
      >
        <input type="hidden" name="zf_referrer_name" value="" />
        <input type="hidden" name="zf_redirect_url" value="" />
        <input type="hidden" name="zc_gad" value="" />
        <label className="sr-only" htmlFor="waitlist-email">Your email address</label>
        <input
          id="waitlist-email"
          name="Email"
          autoComplete="email"
          required
          type="email"
          maxLength={255}
          placeholder="Your email address"
          disabled={submitted}
        />
        <button type="submit" className={styles.cta} disabled={submitted}>
          {submitted ? "You're on the list" : 'Subscribe'}
        </button>
      </form>
      <p className={submitted ? styles.confirmation : styles.hidden}>No spam. It's a promise.</p>
    </>
  );
}
