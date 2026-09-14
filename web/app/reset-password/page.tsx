'use client';

import { useEffect, useState } from 'react';
import { BrandLockup } from '@/components/design/brand-lockup';
import { Button } from '@/components/design/button';
import { InputField } from '@/components/design/input-field';
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, PasswordCriteria } from '@/components/password-criteria';
import { clearAuthSession, confirmPasswordReset } from '@/lib/auth';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token') ?? ''), []);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || password.length < 8 || password !== confirm || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9\s]/.test(password) || /\s/.test(password)) {
      setMessage(password !== confirm ? 'Passwords do not match.' : 'Password does not meet the requirements.');
      return;
    }
    setBusy(true);
    try { await confirmPasswordReset(token, password); setDone(true); setMessage('Your password was reset. You can now log in.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'This reset link is invalid or expired.'); }
    finally { setBusy(false); }
  }

  return (
    <main className="login-screen">
      <form className="login-form" onSubmit={submit}>
        <BrandLockup size="lg" />
        <div className="login-step-copy">
          <p>Reset your password</p>
          <span>{done ? message : 'Choose a new password for your Friink account.'}</span>
        </div>
        {!done && <>
          <InputField label="New password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} pattern={PASSWORD_PATTERN.source} required trailing={<button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'}><i className={`fa-regular ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" /></button>} />
          <PasswordCriteria value={password} id="reset-password-criteria" />
          <InputField label="Confirm password" type={showConfirm ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" autoComplete="new-password" required trailing={<button className="password-toggle" type="button" onClick={() => setShowConfirm((value) => !value)} aria-label={showConfirm ? 'Hide password' : 'Show password'}><i className={`fa-regular ${showConfirm ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" /></button>} />
          <Button className="login-submit" type="submit" disabled={busy}>{busy ? 'Please wait...' : 'Reset password'}</Button>
        </>}
        {done && <a className="button-secondary login-back-button" href="/login" onClick={() => clearAuthSession()}>Return to login</a>}
        {message && !done && <p className="login-error" role="alert">{message}</p>}
      </form>
    </main>
  );
}
