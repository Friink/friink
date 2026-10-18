'use client';

import { useEffect, useState } from 'react';
import { AuthField, AuthShell, PasswordCriteria } from '@friink/auth-ui';
import { authClient } from '@/lib/auth-client';

export default function ResetPasswordPage() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token') ?? ''), []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8 || password !== confirm) {
      setMessage(password !== confirm ? 'Passwords do not match.' : 'Password does not meet the requirements.');
      return;
    }
    const result = await authClient.resetPassword({ newPassword: password, token });
    if (result.error) setMessage(result.error.message ?? 'This reset link is invalid or expired.');
    else { setDone(true); setMessage('Your password was reset. You can now log in.'); }
  }

  return <AuthShell><form className="friink-auth-fields" onSubmit={submit}><div className="friink-auth-step-copy"><p>Reset your password</p><span>{done ? message : 'Choose a new password for your Friink account.'}</span></div>{!done ? <><AuthField label="New password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required /><PasswordCriteria value={password} id="reset-password-criteria" /><AuthField label="Confirm password" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required /><button className="friink-auth-primary" type="submit">Reset password</button></> : <a className="friink-auth-secondary" href="/login">Return to login</a>}{message && !done ? <p className="friink-auth-error" role="alert">{message}</p> : null}</form></AuthShell>;
}
