'use client';

import { useState } from 'react';
import { BrandLockup } from '@/components/design/brand-lockup';
import { PillButton } from '@/components/design/pill-button';
import { PillField } from '@/components/design/pill-field';

type LoginScreenProps = {
  onLogin: () => void;
};

type AuthStep = 'login' | 'signup' | 'otp' | 'details';

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [location, setLocation] = useState('');
  const [step, setStep] = useState<AuthStep>('login');
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (step === 'login') {
      onLogin();
    } else if (step === 'signup') {
      setStep('otp');
    } else if (step === 'otp') {
      setStep('details');
    } else {
      onLogin();
    }
  }

  const isPasswordStep = step === 'login' || step === 'signup';

  return (
    <div className="login-screen">
      <form className="login-form" onSubmit={handleSubmit}>
        <BrandLockup size="lg" />

        {isPasswordStep && (
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
              autoComplete={step === 'signup' ? 'new-password' : 'current-password'}
              required
              trailing={
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <i className={`fa-regular ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
                </button>
              }
            />

            {step === 'signup' && (
              <PillField
                label="Confirm Password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Confirm Password"
                autoComplete="new-password"
                required
                trailing={
                  <i className="password-status fa-regular fa-eye-slash" aria-hidden="true" />
                }
              />
            )}

            {step === 'login' && (
              <button className="forgot-password" type="button">
                Forgot password?
              </button>
            )}

            <PillButton className="login-submit" type="submit">
              {step === 'signup' ? 'Create account' : 'Login'}
            </PillButton>

            <p className="login-switch">
              {step === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button type="button" onClick={() => setStep(step === 'signup' ? 'login' : 'signup')}>
                {step === 'signup' ? 'Login' : 'Sign up'}
              </button>
            </p>
          </>
        )}

        {step === 'otp' && (
          <>
            <PillField
              label="OTP"
              inputMode="numeric"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="OTP"
              required
            />
            <div className="auth-help-copy">
              <p>We have sent an OTP to your email address.</p>
              <p>OTP will expire in <span>120s.</span></p>
            </div>
            <PillButton className="login-submit auth-next-button" type="submit">
              Next
            </PillButton>
          </>
        )}

        {step === 'details' && (
          <>
            <PillField label="Name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" required />
            <PillField
              label="Username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="@username"
              required
            />
            <PillField
              label="Date of birth"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
              placeholder="Date of birth"
              required
            />
            <PillField
              label="Location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Location"
              required
            />
            <PillButton className="login-submit auth-next-button" type="submit">
              Next
            </PillButton>
          </>
        )}
      </form>
    </div>
  );
}
