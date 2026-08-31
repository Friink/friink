'use client';

import { useState } from 'react';
import { BrandLockup } from '@/components/design/brand-lockup';
import { Button } from '@/components/design/button';
import { InputField } from '@/components/design/input-field';
import { login, saveAuthSession, signUp, type AuthUser } from '@/lib/auth';

const AUTH_FAILURE_MESSAGE = 'Sorry, that didn’t work.';
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,}$/;
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

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
      } catch (error) {
        setErrorMessage(getAuthErrorMessage(error));
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
        if (!USERNAME_PATTERN.test(username)) {
          setIsSubmitting(false);
          setErrorMessage("Username may contain only letters, numbers, '-', '_', and '.' with no spaces.");
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
      } catch (error) {
        setErrorMessage(getAuthErrorMessage(error));
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
            <InputField
              label="Email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
            />

            <InputField
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

            <div className="signup-actions signup-actions-single">
              <a className="signup-back-button login-back-button" href="/">
                Back
              </a>
              <Button className="login-submit" type="submit">
                {isSubmitting ? 'Please wait...' : 'Login'}
              </Button>
            </div>

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
            <InputField
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
              <Button className="login-submit" type="submit">
                Continue
              </Button>
            </div>
          </>
        )}

        {isSignupPasswordStep && (
          <>
            <div className="signup-step-copy" aria-label="Signup progress">
              <p>{signupProgressLabel}</p>
            </div>

            <InputField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="new-password"
              minLength={8}
              pattern={PASSWORD_PATTERN.source}
              title="Use at least 8 characters with uppercase, lowercase, number, and special character, with no spaces."
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

            <InputField
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm Password"
              autoComplete="new-password"
              minLength={8}
              pattern={PASSWORD_PATTERN.source}
              title="Use at least 8 characters with uppercase, lowercase, number, and special character, with no spaces."
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
              <Button className="login-submit" type="submit">
                Continue
              </Button>
            </div>
          </>
        )}

        {isSignupProfileStep && (
          <>
            <div className="signup-step-copy" aria-label="Signup progress">
              <p>{signupProgressLabel}</p>
            </div>

            <InputField
              label="Name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Name"
              autoComplete="name"
              required
            />

            <InputField
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="username"
              prefix={'@'}
              autoComplete="off"
              required
            />

            <InputField
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
              <Button className="login-submit" type="submit">
                {isSubmitting ? 'Please wait...' : 'Create account'}
              </Button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function getAuthErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : AUTH_FAILURE_MESSAGE;
}
