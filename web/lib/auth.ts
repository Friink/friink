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
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

type ApiUser = {
  id: string;
  email: string;
  username: string;
  date_of_birth: string;
  location: string | null;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
};

type ApiTokenResponse = {
  access_token: string;
  token_type: string;
  user: ApiUser;
};

async function requestApi<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Friink API request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function mapApiUser(user: ApiUser, nameFallback?: string): AuthUser {
  return {
    id: user.id,
    name: nameFallback || user.username,
    email: user.email,
    username: user.username,
    status: 'active',
    emailVerifiedAt: user.is_verified ? user.created_at : null,
  };
}

function mapTokenResponse(response: ApiTokenResponse, nameFallback?: string): AuthSession {
  return {
    accessToken: response.access_token,
    tokenType: 'Bearer',
    user: mapApiUser(response.user, nameFallback),
  };
}

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
  const user = await requestApi<ApiUser>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      username: input.username,
      password: input.password,
      date_of_birth: input.dateOfBirth,
      location: null,
    }),
  });

  const loginSession = await login(input.email, input.password);
  return {
    ...loginSession,
    user: {
      ...mapApiUser(user, input.name || user.username),
      emailVerifiedAt: loginSession.user.emailVerifiedAt,
    },
  };
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
  const response = await requestApi<ApiTokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  return mapTokenResponse(response);
}
