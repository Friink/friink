'use client';

import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react';
import { useState } from 'react';

export const authBrandAssets = {
  full: new URL('./assets/logoFullBrand.svg', import.meta.url).toString(),
  mark: new URL('./assets/logoBrand.svg', import.meta.url).toString(),
};

export type AuthShellProps = {
  children: ReactNode;
  brandSrc?: string;
  brandAlt?: string;
  homeHref?: string;
  className?: string;
};

export function AuthShell({ children, brandSrc = authBrandAssets.full, brandAlt = 'Friink', homeHref = '/', className = '' }: AuthShellProps) {
  return (
    <main className={`friink-auth-shell ${className}`.trim()}>
      <a className="friink-auth-home-link" href={homeHref} aria-label="Back to Friink home">
        <img src={brandSrc === authBrandAssets.full ? authBrandAssets.mark : brandSrc} alt="" />
      </a>
      <section className="friink-auth-form" aria-label={`${brandAlt} authentication`}>
        <img className="friink-auth-brand" src={brandSrc} alt={brandAlt} />
        {children}
      </section>
    </main>
  );
}

export type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  trailing?: ReactNode;
  prefix?: ReactNode;
};

export function AuthField({ label, trailing, prefix, ...props }: AuthFieldProps) {
  return (
    <label className={`friink-auth-field${prefix ? ' has-prefix' : ''}`}>
      <span className="friink-sr-only">{label}</span>
      {prefix ? <span className="friink-auth-field-prefix">{prefix}</span> : null}
      <input {...props} aria-label={label} />
      {trailing}
    </label>
  );
}

function PasswordToggle({ visible, onToggle, label }: { visible: boolean; onToggle: () => void; label: string }) {
  return (
    <button className="friink-auth-password-toggle" type="button" onClick={onToggle} aria-label={label} aria-pressed={visible}>
      {visible ? 'Hide' : 'Show'}
    </button>
  );
}

export function PasswordCriteria({ value, id }: { value: string; id: string }) {
  const hasLettersNumbersAndSymbols = /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9\s]/.test(value);
  return (
    <ul id={id} className="friink-auth-password-criteria" aria-label="Password requirements">
      <li className={value.length >= 8 ? 'met' : ''}><span aria-hidden="true">✓</span>At least 8 characters</li>
      <li className={hasLettersNumbersAndSymbols ? 'met' : ''}><span aria-hidden="true">✓</span>Mix of letters, numbers, and symbols</li>
      <li className={!/\s/.test(value) ? 'met' : ''}><span aria-hidden="true">✓</span>No spaces</li>
    </ul>
  );
}

export type LoginSubmit = { identifier: string; password: string };
export type LoginFormProps = {
  initialIdentifier?: string;
  busy?: boolean;
  error?: string;
  onSubmit: (value: LoginSubmit) => void | Promise<void>;
  onForgotPassword?: () => void;
  onSignup?: () => void;
  onBack?: () => void;
};

export function LoginForm({ initialIdentifier = '', busy = false, error = '', onSubmit, onForgotPassword, onSignup, onBack }: LoginFormProps) {
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const submit = (event: FormEvent) => { event.preventDefault(); void onSubmit({ identifier: identifier.trim(), password }); };

  return (
    <form className="friink-auth-fields" onSubmit={submit}>
      {error ? <p className="friink-auth-error" role="alert" aria-live="assertive">{error}</p> : null}
      <div className="friink-auth-step-copy"><p>Welcome back</p><span>Enter your email or username to continue.</span></div>
      <AuthField label="Email or username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Email or username" autoComplete="username" required />
      <AuthField label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete="current-password" required trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((value) => !value)} label={showPassword ? 'Hide password' : 'Show password'} />} />
      {onForgotPassword ? <button className="friink-auth-link-button" type="button" onClick={onForgotPassword}>Forgot password?</button> : null}
      <div className="friink-auth-actions"><button className="friink-auth-secondary" type="button" onClick={onBack}>Back</button><button className="friink-auth-primary" type="submit" disabled={busy}>{busy ? 'Please wait...' : 'Login'}</button></div>
      {onSignup ? <p className="friink-auth-switch">Don’t have an account? <button type="button" onClick={onSignup}>Sign up</button></p> : null}
    </form>
  );
}

export type SignupSubmit = { email: string; password: string; name: string; username: string; dateOfBirth: string };
export type SignupFormProps = {
  busy?: boolean;
  error?: string;
  onSubmit: (value: SignupSubmit) => void | Promise<void>;
  onLogin?: () => void;
  onBack?: () => void;
};

export function SignupForm({ busy = false, error = '', onSubmit, onLogin, onBack }: SignupFormProps) {
  const [form, setForm] = useState<SignupSubmit>({ email: '', password: '', name: '', username: '', dateOfBirth: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const update = (key: keyof SignupSubmit, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent) => { event.preventDefault(); void onSubmit(form); };

  return (
    <form className="friink-auth-fields" onSubmit={submit}>
      {error ? <p className="friink-auth-error" role="alert" aria-live="assertive">{error}</p> : null}
      <div className="friink-auth-step-copy"><p>Create your account</p><span>Join Friink with your email and a few details.</span></div>
      <AuthField label="Email" type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="Email" autoComplete="email" required />
      <AuthField label="Password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => update('password', event.target.value)} placeholder="Password" autoComplete="new-password" minLength={8} required aria-describedby="friink-signup-password-criteria" trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((value) => !value)} label={showPassword ? 'Hide password' : 'Show password'} />} />
      <PasswordCriteria value={form.password} id="friink-signup-password-criteria" />
      <AuthField label="Confirm password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" autoComplete="new-password" required trailing={<PasswordToggle visible={showConfirmPassword} onToggle={() => setShowConfirmPassword((value) => !value)} label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'} />} />
      <AuthField label="Name" value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Name" autoComplete="name" required />
      <AuthField label="Username" value={form.username} onChange={(event) => update('username', event.target.value)} placeholder="username" prefix="@" autoComplete="off" minLength={2} maxLength={32} required />
      <AuthField label="Date of birth" type="date" value={form.dateOfBirth} onChange={(event) => update('dateOfBirth', event.target.value)} autoComplete="bday" required />
      <div className="friink-auth-actions"><button className="friink-auth-secondary" type="button" onClick={onBack}>Back</button><button className="friink-auth-primary" type="submit" disabled={busy || form.password !== confirmPassword}>{busy ? 'Please wait...' : 'Create account'}</button></div>
      {onLogin ? <p className="friink-auth-switch">Already have an account? <button type="button" onClick={onLogin}>Log in</button></p> : null}
    </form>
  );
}

export type ForgotPasswordFormProps = { busy?: boolean; error?: string; success?: string; initialEmail?: string; onSubmit: (email: string) => void | Promise<void>; onBack?: () => void };

export function ForgotPasswordForm({ busy = false, error = '', success = '', initialEmail = '', onSubmit, onBack }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const submit = (event: FormEvent) => { event.preventDefault(); void onSubmit(email.trim()); };
  return (
    <form className="friink-auth-fields" onSubmit={submit}>
      {error ? <p className="friink-auth-error" role="alert">{error}</p> : null}
      {success ? <p className="friink-auth-success" role="status">{success}</p> : null}
      <div className="friink-auth-step-copy"><p>Reset your password</p><span>Enter your account email and we’ll send a single-use reset link.</span></div>
      <AuthField label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" autoComplete="email" required />
      <div className="friink-auth-actions"><button className="friink-auth-secondary" type="button" onClick={onBack}>Back</button><button className="friink-auth-primary" type="submit" disabled={busy}>{busy ? 'Please wait...' : 'Send reset link'}</button></div>
    </form>
  );
}
