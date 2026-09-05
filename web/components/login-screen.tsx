'use client';

import { useState } from 'react';
import { BrandLockup } from '@/components/design/brand-lockup';
import { Button } from '@/components/design/button';
import { InputField } from '@/components/design/input-field';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, PasswordCriteria } from '@/components/password-criteria';
import { checkUsernameAvailability, completeSignup, isLoginChallenge, login, saveAuthSession, signUp, startSignupEmail, verifyLoginChallenge, verifySignupEmail, type AuthSession, type AuthUser, type SignupInput } from '@/lib/auth';

const AUTH_FAILURE_MESSAGE = 'Sorry, that didn’t work.';
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

type LoginScreenProps = {
  onAuthenticated: (user: AuthUser) => void;
};

type AuthStep = 'login' | 'login-otp' | 'signup-email' | 'signup-password' | 'signup-profile' | 'signup-otp';

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [step, setStep] = useState<AuthStep>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signupOtp, setSignupOtp] = useState('');
  const [signupReservationToken, setSignupReservationToken] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [loginChallengeToken, setLoginChallengeToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isLoginStep = step === 'login';
  const isLoginOtpStep = step === 'login-otp';
  const isSignupEmailStep = step === 'signup-email';
  const isSignupPasswordStep = step === 'signup-password';
  const isSignupProfileStep = step === 'signup-profile';
  const isSignupOtpStep = step === 'signup-otp';
  const signupProgressLabel = isSignupProfileStep ? 'Step 4 of 4' : isSignupPasswordStep ? 'Step 3 of 4' : isSignupOtpStep ? 'Step 2 of 4' : 'Step 1 of 4';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage('');

    if (isLoginStep) {
      setIsSubmitting(true);
      try {
        const result = await login(loginIdentifier, password);
        if (isLoginChallenge(result)) {
          setLoginChallengeToken(result.challengeToken);
          setLoginOtp('');
          setStep('login-otp');
        } else {
          finishAuthentication(result);
        }
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

      setIsSubmitting(true);
      try {
        const signupStart = await startSignupEmail(email);
        if (signupStart.verification_required) {
          setSignupReservationToken(signupStart.reservation_token);
          setSignupOtp('');
          setStep('signup-otp');
        } else {
          setSignupReservationToken('');
          setStep('signup-password');
        }
      } catch (error) {
        setErrorMessage(getAuthErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (isSignupPasswordStep) {
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }

      if (!PASSWORD_PATTERN.test(password) || password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
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

        const availability = await checkUsernameAvailability(username);
        if (!availability.available) {
          setIsSubmitting(false);
          setErrorMessage('Username is already taken.');
          return;
        }

        const signupInput: SignupInput = { name: fullName, email, username, password, dateOfBirth };
        const session = signupReservationToken
          ? await completeSignup(signupReservationToken, signupInput)
          : await signUp(signupInput);
        if (!isLoginChallenge(session)) {
          finishAuthentication(session);
        } else {
          setLoginChallengeToken(session.challengeToken);
          setLoginOtp('');
          setStep('login-otp');
        }
      } catch (error) {
        setErrorMessage(getAuthErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (isLoginOtpStep) {
      if (!/^[A-Za-z0-9]{6}$/.test(loginOtp)) {
        setErrorMessage('Enter the 6-character verification code from your email.');
        return;
      }

      setIsSubmitting(true);
      try {
        finishAuthentication(await verifyLoginChallenge(loginChallengeToken, loginOtp));
      } catch (error) {
        setErrorMessage(getAuthErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (isSignupOtpStep) {
      if (!/^[A-Za-z0-9]{6}$/.test(signupOtp)) {
        setErrorMessage('Enter the 6-character verification code from your email.');
        return;
      }

      setIsSubmitting(true);
      try {
        await verifySignupEmail(signupReservationToken, signupOtp);
        setStep('signup-password');
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

  function finishAuthentication(session: AuthSession) {
    saveAuthSession(session);
    onAuthenticated(session.user);
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
              label="Email or username"
              type="text"
              value={loginIdentifier}
              onChange={(event) => setLoginIdentifier(event.target.value)}
              placeholder="Email or username"
              autoComplete="username"
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

        {isLoginOtpStep && (
          <>
            <div className="signup-step-copy" aria-label="Login verification">
              <p>Verify this login</p>
              <span>We sent a 6-character verification code to your email.</span>
            </div>

            <InputField
              label="Verification code"
              type="text"
              value={loginOtp}
              onChange={(event) => setLoginOtp(event.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase())}
              placeholder="Verification code"
              autoComplete="one-time-code"
              inputMode="text"
              minLength={6}
              maxLength={6}
              pattern="[A-Za-z0-9]{6}"
              required
            />

            <div className="signup-actions signup-actions-single">
              <button className="signup-back-button" type="button" onClick={() => { setErrorMessage(''); setStep('login'); }}>
                Back
              </button>
              <Button className="login-submit" type="submit">
                {isSubmitting ? 'Please wait...' : 'Verify login'}
              </Button>
            </div>
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
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              pattern={PASSWORD_PATTERN.source}
              title="Use at least 8 characters with uppercase, lowercase, number, and special character, with no spaces."
              aria-describedby="signup-password-criteria"
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

            <PasswordCriteria value={password} id="signup-password-criteria" />

            <InputField
              label="Confirm Password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm Password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              maxLength={PASSWORD_MAX_LENGTH}
              pattern={PASSWORD_PATTERN.source}
              title="Use at least 8 characters with uppercase, lowercase, number, and special character, with no spaces."
              aria-describedby="signup-password-criteria"
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

        {isSignupOtpStep && (
          <>
            <div className="signup-step-copy" aria-label="Signup progress">
              <p>{signupProgressLabel}</p>
              <span>We sent a 6-character verification code to your email.</span>
            </div>

            <InputField
              label="Verification code"
              type="text"
              value={signupOtp}
              onChange={(event) => setSignupOtp(event.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase())}
              placeholder="Verification code"
              autoComplete="one-time-code"
              inputMode="text"
              minLength={6}
              maxLength={6}
              pattern="[A-Za-z0-9]{6}"
              required
            />

            <div className="signup-actions signup-actions-single">
              <button className="signup-back-button" type="button" onClick={() => { setErrorMessage(''); setStep('signup-email'); }}>
                Back
              </button>
              <Button className="login-submit" type="submit">
                {isSubmitting ? 'Please wait...' : 'Verify email'}
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
