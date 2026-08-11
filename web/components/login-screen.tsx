'use client';

import { useState } from 'react';
import { FriinkLogo } from '@/components/friink-logo';

type LoginScreenProps = {
  onLogin: () => void;
};

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showForm, setShowForm] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onLogin();
  }

  if (!showForm) {
    return (
      <div className="login-screen">
        <div className="login-splash">
          <FriinkLogo className="login-logo" />
          <p className="login-tagline">Your people, in one place</p>
          <button className="primary-button login-cta" type="button" onClick={() => setShowForm(true)}>
            Get started
          </button>
          <button className="text-link" type="button" onClick={() => setShowForm(true)}>
            I already have an account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <form className="login-form" onSubmit={handleSubmit}>
        <FriinkLogo className="login-logo login-logo-small" />
        <h1>Welcome back</h1>
        <p className="login-subtitle">Sign in to continue to Friink</p>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>

        <button className="primary-button" type="submit">
          Log in
        </button>

        <button className="text-link" type="button" onClick={() => setShowForm(false)}>
          Back
        </button>
      </form>
    </div>
  );
}
