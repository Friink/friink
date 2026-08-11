'use client';

import { useState } from 'react';
import { FriinkLogo } from '@/components/friink-logo';

type LoginScreenProps = {
  onLogin: () => void;
};

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onLogin();
  }

  return (
    <div className="login-screen">
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="login-brand" aria-label="Friink">
          <img src="/brand/logoBlack.svg" alt="" />
          <strong>Friink</strong>
        </div>

        <label className="login-field">
          <span className="sr-only">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
          />
        </label>

        <label className="login-field login-password-field">
          <span className="sr-only">Password</span>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            required
          />
          <button
            className="password-toggle"
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            <i className={`fa-regular ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
          </button>
        </label>

        {!isSignUp && (
          <button className="forgot-password" type="button">
            Forgot password?
          </button>
        )}

        <button className="login-submit" type="submit">
          {isSignUp ? 'Sign up' : 'Login'}
        </button>

        <p className="login-switch">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" onClick={() => setIsSignUp((current) => !current)}>
            {isSignUp ? 'Login' : 'Sign up'}
          </button>
        </p>
      </form>
    </div>
  );
}
