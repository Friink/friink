export type AuthUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  status: 'pending_email_verification' | 'active' | 'locked';
  emailVerifiedAt: string | null;
};

export type AuthSession = {
  accessToken: string;
  tokenType: 'Bearer';
  user: AuthUser;
};

const AUTH_SESSION_KEY = 'friink-auth-session';
const DEFAULT_DEMO_EMAIL = 'demo@friink.local';

export function createDemoSession(overrides: Partial<AuthUser> = {}): AuthSession {
  const demoUser: AuthUser = {
    id: 'demo-user',
    name: 'Demo User',
    email: DEFAULT_DEMO_EMAIL,
    username: 'demouser',
    status: 'active',
    emailVerifiedAt: new Date().toISOString(),
    ...overrides,
  };

  return {
    accessToken: 'demo-access-token',
    tokenType: 'Bearer',
    user: demoUser,
  };
}

export async function signUp(input: {
  name: string;
  email: string;
  username: string;
  password: string;
  dateOfBirth: string;
}): Promise<AuthSession> {
  return createDemoSession({
    id: `demo-${input.username || 'user'}`,
    name: input.name || 'Demo User',
    email: input.email || DEFAULT_DEMO_EMAIL,
    username: input.username || 'demouser',
    status: 'active',
    emailVerifiedAt: new Date().toISOString(),
  });
}

export function saveAuthSession(session: AuthSession) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function loadAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return createDemoSession();

  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return createDemoSession();

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return createDemoSession();
  }
}

export function loadPersistedAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as AuthSession;
    return session.user.email === DEFAULT_DEMO_EMAIL ? null : session;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_SESSION_KEY);
}

export async function login(email: string, password: string): Promise<AuthSession> {
  return createDemoSession({
    email: email || DEFAULT_DEMO_EMAIL,
    username: email ? email.split('@')[0] || 'demouser' : 'demouser',
    name: 'Demo User',
  });
}
