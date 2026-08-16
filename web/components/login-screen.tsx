'use client';

import { useState } from 'react';
import { BrandLockup } from '@/components/design/brand-lockup';
import { PillButton } from '@/components/design/pill-button';
import { PillField } from '@/components/design/pill-field';
import { login, saveAuthSession, signUp, type AuthUser, getApiBaseUrl } from '@/lib/auth';

const AUTH_FAILURE_MESSAGE = 'Sorry, that didn’t work.';
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S+$/;

type LoginScreenProps = {
  onAuthenticated: (user: AuthUser) => void;
};

type AuthStep = 'login' | 'signup-email' | 'signup-password' | 'signup-profile';

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [step, setStep] = useState<AuthStep>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isLoginStep = step === 'login';
  const isSignupEmailStep = step === 'signup-email';
  const isSignupPasswordStep = step === 'signup-password';
  const isSignupProfileStep = step === 'signup-profile';
  const signupProgressLabel = isSignupProfileStep ? 'Step 3 of 3' : isSignupPasswordStep ? 'Step 2 of 3' : 'Step 1 of 3';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage('');

    if (isLoginStep) {
      setIsSubmitting(true);
      try {
        const session = await login(email, password);
        saveAuthSession(session);
        onAuthenticated(session.user);
      } catch {
        setErrorMessage(AUTH_FAILURE_MESSAGE);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (isSignupEmailStep) {
      if (!validateEmail(email)) {
        setErrorMessage('Please enter a valid email address.');
        return;
      }

      setStep('signup-password');
      return;
    }

    if (isSignupPasswordStep) {
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }

      if (!PASSWORD_PATTERN.test(password)) {
        setErrorMessage('Password does not meet complexity requirements.');
        return;
      }

      setStep('signup-profile');
      return;
    }

    if (isSignupProfileStep) {
      setIsSubmitting(true);
      try {
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
          setIsSubmitting(false);
          setErrorMessage('Username must be 3–30 characters and contain only letters, numbers, and underscores.');
          return;
        }

        const available = await checkUsernameUnique(username);
        if (available === false) {
          setIsSubmitting(false);
          setErrorMessage('That username is already taken.');
          return;
        }

        const session = await signUp({ name: fullName, email, username, password, dateOfBirth });
        if (session.accessToken) {
          saveAuthSession(session);
          onAuthenticated(session.user);
        } else {
          const loginSession = await login(email, password);
          saveAuthSession(loginSession);
          onAuthenticated(loginSession.user);
        }
      } catch {
        setErrorMessage(AUTH_FAILURE_MESSAGE);
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  function handleStartSignup() {
    setErrorMessage('');
    setStep('signup-email');
  }

  function handleBackToLogin() {
    setErrorMessage('');
    setStep('login');
  }

  function validateEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  async function checkUsernameUnique(handle: string): Promise<boolean | undefined> {
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/username-available?username=${encodeURIComponent(handle)}`);
      if (res.status === 404) return undefined;
      if (!res.ok) return undefined;
      const data = await res.json();
      return Boolean((data as { available?: boolean }).available);
    } catch {
      return undefined;
    }
  }

  return (
    <div className="login-screen">
      <a className="auth-home-link" href="/" aria-label="Back to Friink home">
        <img src="/brand/logoBrand.svg" alt="" />
      </a>
      <form className="login-form" onSubmit={handleSubmit}>
        <BrandLockup size="lg" />
        {errorMessage && <p className="login-error" role="alert">{errorMessage}</p>}

        {isLoginStep && (
          <>
            <PillField
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
            />

            <PillField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
              trailing={
                <button
                  className="password-toggle"
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <i className={`fa-regular ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
                </button>
              }
            />

            

            <button className="forgot-password" type="button">
              Forgot password?
            </button>

            <PillButton className="login-submit" type="submit">
              {isSubmitting ? 'Please wait...' : 'Login'}
            </PillButton>

            <p className="login-switch">
              Don't have an account?{' '}
              <button type="button" onClick={handleStartSignup}>
                Sign up
              </button>
            </p>
          </>
        )}

        {isSignupEmailStep && (
          <>
            <div className="signup-step-copy" aria-label="Signup progress">
              <p>{signupProgressLabel}</p>
            </div>
            <PillField
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
            />

            <div className="signup-actions signup-actions-single">
              <button
                className="signup-back-button"
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setStep('login');
                }}
              >
                Back
              </button>
              <PillButton className="login-submit" type="submit">
                Continue
              </PillButton>
            </div>
          </>
        )}

        {isSignupPasswordStep && (
          <>
            <div className="signup-step-copy" aria-label="Signup progress">
              <p>{signupProgressLabel}</p>
            </div>

            <PillField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="new-password"
              required
              trailing={
                <button
                  className="password-toggle"
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <i className={`fa-regular ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
                </button>
              }
            />

            <PillField
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm Password"
              autoComplete="new-password"
              required
              trailing={
                <button
                  className="password-toggle"
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword((c) => !c)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  aria-pressed={showConfirmPassword}
                >
                  <i className={`fa-regular ${showConfirmPassword ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
                </button>
              }
            />

            <div className="signup-actions signup-actions-single">
              <button
                className="signup-back-button"
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setStep('signup-email');
                }}
              >
                Back
              </button>
              <PillButton className="login-submit" type="submit">
                Continue
              </PillButton>
            </div>
          </>
        )}

        {isSignupProfileStep && (
          <>
            <div className="signup-step-copy" aria-label="Signup progress">
              <p>{signupProgressLabel}</p>
            </div>

            <PillField
              label="Name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Name"
              autoComplete="name"
              required
            />

            <PillField
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="username"
              prefix={'@'}
              autoComplete="username"
              required
            />

            <PillField
              label="Date of birth"
              type="date"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
              placeholder="YYYY-MM-DD"
              autoComplete="bday"
              required
            />

            <div className="signup-actions">
              <button className="signup-back-button" type="button" onClick={() => setStep('signup-password')}>
                Back
              </button>
              <PillButton className="login-submit" type="submit">
                {isSubmitting ? 'Please wait...' : 'Create account'}
              </PillButton>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
