'use client';

import { useEffect, useState } from 'react';
import { BrandLockup } from '@/components/design/brand-lockup';
import { Button } from '@/components/design/button';
import { InputField } from '@/components/design/input-field';
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, PasswordCriteria } from '@/components/password-criteria';
import { AuthApiError, checkUsernameAvailability, completeApprovedLogin, continueProgressiveLogin, completeSignup, getLoginApprovalStatus, isLoginChallenge, login, refreshAuthSession, requestPasswordReset, saveAuthSession, signUp, startProgressiveLogin, startSignupEmail, verifyLoginChallenge, verifySignupEmail, type AuthSession, type AuthUser, type SignupInput } from '@/lib/auth';

const AUTH_FAILURE_MESSAGE = 'Sorry, that didn’t work.';
const LOGIN_COOLDOWN_STORAGE_KEY = 'friink_login_cooldown';
const USERNAME_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

type LoginScreenProps = {
  onAuthenticated: (user: AuthUser) => void;
  mode?: 'page' | 'account-modal';
  initialMessage?: string;
  progressive?: boolean;
};

type AuthStep = 'login-email' | 'login-password' | 'login-otp' | 'forgot-password' | 'signup-email' | 'signup-password' | 'signup-profile' | 'signup-otp' | 'progressive-email' | 'progressive-continue';

export function LoginScreen({ onAuthenticated, mode = 'page', initialMessage, progressive = false }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [step, setStep] = useState<AuthStep>(progressive ? 'progressive-email' : 'login-email');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signupOtp, setSignupOtp] = useState('');
  const [signupReservationToken, setSignupReservationToken] = useState('');
  const [loginOtp, setLoginOtp] = useState('');
  const [loginChallengeToken, setLoginChallengeToken] = useState('');
  const [progressiveFlowToken, setProgressiveFlowToken] = useState('');
  const [lifecycleStatus, setLifecycleStatus] = useState<'deactivated' | 'pending_deletion' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginCooldownUntil, setLoginCooldownUntil] = useState<number | null>(null);
  const [loginCooldownSeconds, setLoginCooldownSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState(initialMessage ?? '');

  const isLoginEmailStep = step === 'login-email';
  const isLoginPasswordStep = step === 'login-password';
  const isLoginOtpStep = step === 'login-otp';
  const isForgotPasswordStep = step === 'forgot-password';
  const isSignupEmailStep = step === 'signup-email';
  const isSignupPasswordStep = step === 'signup-password';
  const isSignupProfileStep = step === 'signup-profile';
  const isSignupOtpStep = step === 'signup-otp';
  const isProgressiveEmailStep = step === 'progressive-email';
  const isProgressiveContinueStep = step === 'progressive-continue';
  const signupProgressLabel = isSignupProfileStep ? 'Step 4 of 4' : isSignupPasswordStep ? 'Step 3 of 4' : isSignupOtpStep ? 'Step 2 of 4' : 'Step 1 of 4';

  useEffect(() => {
    const restoreCooldown = () => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(LOGIN_COOLDOWN_STORAGE_KEY) ?? 'null') as { identifier?: string; until?: number } | null;
        if (!stored?.until || stored.until <= Date.now()) {
          window.localStorage.removeItem(LOGIN_COOLDOWN_STORAGE_KEY);
          setLoginCooldownUntil(null);
          setLoginCooldownSeconds(0);
          return;
        }
        if (stored.identifier) setLoginIdentifier(stored.identifier);
        setLoginCooldownUntil(stored.until);
        setLoginCooldownSeconds(Math.max(1, Math.ceil((stored.until - Date.now()) / 1000)));
        setStep('login-password');
      } catch {
        // A blocked or malformed local-storage value must not block login.
      }
    };
    restoreCooldown();
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOGIN_COOLDOWN_STORAGE_KEY) restoreCooldown();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!loginCooldownUntil) return;
    const update = () => {
      const remaining = Math.ceil((loginCooldownUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setLoginCooldownUntil(null);
        setLoginCooldownSeconds(0);
        setErrorMessage('');
        try { window.localStorage.removeItem(LOGIN_COOLDOWN_STORAGE_KEY); } catch { /* best effort */ }
      } else {
        setLoginCooldownSeconds(remaining);
      }
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [loginCooldownUntil]);

  useEffect(() => {
    // Approval and OTP are alternative completion paths. Once the user starts
    // entering the OTP, stop approval polling so a late `expired` response
    // cannot overwrite the active OTP flow or its eventual success.
    if (!loginChallengeToken || !isLoginOtpStep || loginOtp.length > 0 || isSubmitting) return;
    let stopped = false;
    const poll = async () => {
      try {
        const status = await getLoginApprovalStatus(loginChallengeToken);
        if (stopped || status === 'pending' || status === 'otp_verified') return;
        if (status === 'approved') finishAuthentication(await completeApprovedLogin(loginChallengeToken, { addAccount: mode === 'account-modal' }));
        else if (status === 'denied') setErrorMessage('This login request was denied.');
        else setErrorMessage('This login request expired. Please try again.');
      } catch { /* The OTP path remains available if polling is unavailable. */ }
    };
    const interval = window.setInterval(() => void poll(), 2000);
    void poll();
    return () => { stopped = true; window.clearInterval(interval); };
  }, [loginChallengeToken, isLoginOtpStep, loginOtp.length, isSubmitting]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage('');

    if (isLoginEmailStep) {
      if (!loginIdentifier.trim()) {
        setErrorMessage('Please enter your email or username.');
        return;
      }
      setStep('login-password');
      return;
    }

    if (isProgressiveEmailStep) {
      if (!loginIdentifier.trim()) {
        setErrorMessage('Please enter your email or username.');
        return;
      }
      setIsSubmitting(true);
      try {
        const started = await startProgressiveLogin(loginIdentifier);
        setProgressiveFlowToken(started.flow_token);
        setStep('progressive-continue');
      } catch (error) {
        setErrorMessage(getAuthErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (isProgressiveContinueStep) {
      setIsSubmitting(true);
      try {
        const continued = await continueProgressiveLogin(progressiveFlowToken);
        if (continued.next_step === 'password') {
          setStep('login-password');
        } else {
          const signupStart = await startSignupEmail(loginIdentifier);
          if (!signupStart.verification_required || !signupStart.reservation_token) {
            setErrorMessage('If the signup details can be accepted, verification instructions will be sent.');
            return;
          }
          setEmail(loginIdentifier);
          setSignupReservationToken(signupStart.reservation_token);
          setSignupOtp('');
          setStep('signup-otp');
        }
      } catch (error) {
        setErrorMessage(getAuthErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (isForgotPasswordStep) {
      if (!validateEmail(email)) {
        setErrorMessage('Enter the email address associated with your Friink account.');
        return;
      }
      setIsSubmitting(true);
      try {
        await requestPasswordReset(email);
        setErrorMessage('If an account exists for that email, password-reset instructions have been sent.');
      } catch (error) {
        setErrorMessage(getAuthErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (isLoginPasswordStep) {
      setIsSubmitting(true);
      try {
        const result = await login(loginIdentifier, password, { addAccount: mode === 'account-modal' });
        if (isLoginChallenge(result)) {
          setLoginChallengeToken(result.challengeToken);
          setLifecycleStatus(result.lifecycleStatus ?? null);
          setLoginOtp('');
          setStep('login-otp');
        } else {
          finishAuthentication(result);
        }
      } catch (error) {
        setPassword('');
        if (error instanceof AuthApiError && error.cooldownSeconds) {
          const until = Date.now() + error.cooldownSeconds * 1000;
          setLoginCooldownUntil(until);
          setLoginCooldownSeconds(error.cooldownSeconds);
          try {
            window.localStorage.setItem(LOGIN_COOLDOWN_STORAGE_KEY, JSON.stringify({ identifier: loginIdentifier, until }));
          } catch { /* best effort; the server remains authoritative */ }
          setErrorMessage(formatLoginCooldown(error.cooldownSeconds));
        } else {
          setErrorMessage(getAuthErrorMessage(error));
        }
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
        if (!signupStart.verification_required && !signupStart.reservation_token) {
          setErrorMessage('If the signup details can be accepted, verification instructions will be sent.');
          setSignupReservationToken('');
          return;
        }
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

      if (!PASSWORD_PATTERN.test(password) || password.length < PASSWORD_MIN_LENGTH) {
        setErrorMessage('Password does not meet complexity requirements.');
        return;
      }

      setStep('signup-profile');
      return;
    }

    if (isSignupProfileStep) {
      setIsSubmitting(true);
      try {
        const normalizedName = fullName.trim();
        const normalizedUsername = username.trim();
        setFullName(normalizedName);
        setUsername(normalizedUsername);
        if (normalizedUsername.length < 2 || normalizedUsername.length > 32 || !USERNAME_PATTERN.test(normalizedUsername)) {
          setIsSubmitting(false);
          setErrorMessage('Username must be 2–32 characters using only letters, numbers, \'-\', \'_\', or \'.\'.');
          return;
        }

        const availability = await checkUsernameAvailability(normalizedUsername);
        if (!availability.available) {
          setIsSubmitting(false);
          setErrorMessage('Username is taken.');
          return;
        }

        const signupInput: SignupInput = { name: normalizedName, email, username: normalizedUsername, password, dateOfBirth };
        const session = signupReservationToken
          ? await completeSignup(signupReservationToken, signupInput, { addAccount: mode === 'account-modal' })
          : await signUp(signupInput, { addAccount: mode === 'account-modal' });
        if (!isLoginChallenge(session)) {
          finishAuthentication(session);
        } else {
          setLoginChallengeToken(session.challengeToken);
          setLifecycleStatus(session.lifecycleStatus ?? null);
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
        finishAuthentication(await verifyLoginChallenge(loginChallengeToken, loginOtp, { addAccount: mode === 'account-modal' }));
      } catch (error) {
        // OTP verification commits the login server-side before the response
        // reaches the browser. If that response times out, recover through
        // the newly issued refresh cookie before telling the user that login
        // failed; otherwise a successful login can be reported as an error.
        if (error instanceof AuthApiError && error.status === 0) {
          try {
            finishAuthentication(await refreshAuthSession());
            return;
          } catch {
            // Keep the original timeout/network message when recovery also
            // fails; invalid and expired OTP responses never enter this path.
          }
        }
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
    setStep('login-email');
  }

  function finishAuthentication(session: AuthSession) {
    saveAuthSession(session);
    onAuthenticated(session.user);
  }

  function validateEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  return (
    <div className={`login-screen${mode === 'account-modal' ? ' login-screen-account-modal' : ''}`}>
      {mode === 'page' ? <a className="auth-home-link" href="/" aria-label="Back to Friink home">
        <img src="/brand/logoBrand.svg" alt="" />
      </a> : null}
      <form className={`login-form${mode === 'account-modal' ? ' login-form-account-modal' : ''}`} onSubmit={handleSubmit}>
        {mode === 'page' ? <BrandLockup size="lg" /> : null}
        {errorMessage && <p className="login-error" role="alert" aria-live="assertive">{errorMessage}</p>}

        {(isLoginEmailStep || isProgressiveEmailStep) && (
          <>
            <div className="login-step-copy" aria-label={isProgressiveEmailStep ? 'Login or create account' : 'Login step 1 of 2'}>
              <p>{isProgressiveEmailStep ? 'Login or create account' : 'Welcome back'}</p>
              <span>Enter your email or username to continue.</span>
            </div>

            <InputField
              label="Email or username"
              type="text"
              value={loginIdentifier}
              onChange={(event) => setLoginIdentifier(event.target.value)}
              placeholder="Email or username"
              autoComplete="username"
              required
            />

            <div className={`signup-actions signup-actions-single${mode === 'account-modal' ? ' account-auth-actions' : ''}`}>
              {mode === 'page' ? <a className="button-secondary login-back-button" href="/">Back</a> : null}
              {mode === 'account-modal' ? <Button variant="secondary" type="button" onClick={handleStartSignup}>Sign up</Button> : null}
              <Button className="login-submit" type="submit">
                Continue
              </Button>
            </div>

            {mode === 'page' && !progressive ? <p className="login-switch">Don’t have an account?{' '}<button type="button" onClick={handleStartSignup}>Sign up</button></p> : null}
          </>
        )}

        {isProgressiveContinueStep && (
          <>
            <div className="login-step-copy" aria-label="Continue securely">
              <p>Continue securely</p>
              <span>We’ll take you to the next step.</span>
            </div>
            <button className="login-identifier-summary" type="button" onClick={() => { setErrorMessage(''); setStep('progressive-email'); }}>
              {loginIdentifier}
              <span>Change</span>
            </button>
            <div className="signup-actions signup-actions-single">
              <button className="button-secondary" type="button" onClick={() => { setErrorMessage(''); setStep('progressive-email'); }}>Back</button>
              <Button className="login-submit" type="submit">{isSubmitting ? 'Please wait...' : 'Continue'}</Button>
            </div>
          </>
        )}

        {isLoginPasswordStep && (
          <>
            <div className="login-step-copy" aria-label="Login step 2 of 2">
              <p>Enter your password</p>
              <button className="login-identifier-summary" type="button" onClick={() => { setErrorMessage(''); setStep(progressive ? 'progressive-email' : 'login-email'); }}>
                {loginIdentifier}
                <span>Change</span>
              </button>
            </div>

            <InputField
              label="Password"
              name="password"
              id="signup-password"
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

            <button className="forgot-password" type="button" onClick={() => { setEmail(validateEmail(loginIdentifier) ? loginIdentifier : ''); setErrorMessage(''); setStep('forgot-password'); }}>
              Forgot password?
            </button>

            <div className={`signup-actions signup-actions-single${mode === 'account-modal' ? ' account-auth-actions' : ''}`}>
              <button className="button-secondary" type="button" onClick={() => { setErrorMessage(''); setStep(progressive ? 'progressive-email' : 'login-email'); }}>
                Back
              </button>
              <Button className="login-submit" type="submit" disabled={isSubmitting || loginCooldownSeconds > 0}>
                {isSubmitting ? 'Please wait...' : loginCooldownSeconds > 0 ? `Try again in ${formatCountdown(loginCooldownSeconds)}` : 'Login'}
              </Button>
            </div>
          </>
        )}

        {isForgotPasswordStep && (
          <>
            <div className="login-step-copy"><p>Reset your password</p><span>Enter your account email and we’ll send a single-use reset link.</span></div>
            <InputField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" autoComplete="email" required />
            <div className="signup-actions signup-actions-single">
              <button className="button-secondary" type="button" onClick={() => { setErrorMessage(''); setStep('login-password'); }}>Back</button>
              <Button className="login-submit" type="submit">{isSubmitting ? 'Please wait...' : 'Send reset link'}</Button>
            </div>
          </>
        )}

        {isLoginOtpStep && (
          <>
            <div className="signup-step-copy" aria-label="Login verification">
              <p>{lifecycleStatus === 'pending_deletion' ? 'Cancel account deletion' : lifecycleStatus === 'deactivated' ? 'Reactivate your account' : 'Verify this login'}</p>
              <span>{lifecycleStatus === 'pending_deletion' ? 'Verify with the code we sent to cancel deletion and restore your account.' : lifecycleStatus === 'deactivated' ? 'Verify with the code we sent to restore your account.' : 'We sent a 6-character verification code to your email.'}</span>
            </div>

            <InputField
              label="Verification code"
              type="text"
              value={loginOtp}
              onChange={(event) => {
                setErrorMessage('');
                setLoginOtp(event.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase());
              }}
              placeholder="Verification code"
              autoComplete="one-time-code"
              inputMode="text"
              minLength={6}
              maxLength={6}
              pattern="[A-Za-z0-9]{6}"
              required
            />

            <div className="signup-actions signup-actions-single">
              <button className="button-secondary" type="button" onClick={() => { setErrorMessage(''); setStep('login-password'); }}>
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
              onChange={(event) => {
                setEmail(event.target.value);
                setErrorMessage('');
              }}
              placeholder="Email"
              autoComplete="email"
              required
            />

            <div className="signup-actions signup-actions-single">
              <button
                className="button-secondary"
                type="button"
                onClick={() => {
                  setErrorMessage('');
                  setStep('login-email');
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
              name="password"
              id="signup-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
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
              name="confirm-password"
              id="signup-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm Password"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
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
                className="button-secondary"
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
              maxLength={124}
            />

            <InputField
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="username"
              prefix={'@'}
              autoComplete="off"
              minLength={2}
              maxLength={32}
              pattern={USERNAME_PATTERN.source}
              title="Use 2–32 characters: letters, numbers, '.', '_', or '-'."
              aria-describedby="signup-username-criteria"
              required
            />
            <p className="username-criteria" id="signup-username-criteria">2–32 characters · letters, numbers, '.', '_', and '-'</p>

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
              <button className="button-secondary" type="button" onClick={() => setStep('signup-password')}>
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
              <button className="button-secondary" type="button" onClick={() => { setErrorMessage(''); setStep('signup-email'); }}>
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

function formatCountdown(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.ceil(seconds / 60)} min`;
}

function formatLoginCooldown(seconds: number) {
  return `Too many sign-in attempts. Try again in about ${formatCountdown(seconds)}.`;
}
