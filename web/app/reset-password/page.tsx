'use client';

import { useEffect, useState } from 'react';
import { BrandLockup } from '@/components/design/brand-lockup';
import { Button } from '@/components/design/button';
import { InputField } from '@/components/design/input-field';
import { confirmPasswordReset } from '@/lib/auth';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token') ?? ''), []);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || password.length < 8 || password.length > 16 || password !== confirm || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9\s]/.test(password) || /\s/.test(password)) {
      setMessage(password !== confirm ? 'Passwords do not match.' : 'Password does not meet the requirements.');
      return;
    }
    setBusy(true);
    try { await confirmPasswordReset(token, password); setDone(true); setMessage('Your password was reset. You can now log in.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'This reset link is invalid or expired.'); }
    finally { setBusy(false); }
  }

  return <main className="login-screen"><BrandLockup size="lg" /><form className="login-form" onSubmit={submit}><div className="login-step-copy"><p>Reset your password</p><span>{done ? message : 'Choose a new password for your Friink account.'}</span></div>{!done && <><InputField label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required /><InputField label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required /><Button className="login-submit" type="submit" disabled={busy}>{busy ? 'Please wait...' : 'Reset password'}</Button></>}{done && <a className="signup-back-button" href="/login">Return to login</a>}{message && !done && <p className="login-error" role="alert">{message}</p>}</form></main>;
}
