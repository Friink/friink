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

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';
}

export async function signUp(input: {
  name: string;
  email: string;
  username: string;
  password: string;
  dateOfBirth: string;
}): Promise<AuthSession> {
  const response = await fetch(`${getApiBaseUrl()}/auth/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  return handleAuthResponse(response, true);
}

export function saveAuthSession(session: AuthSession) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function loadAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_SESSION_KEY);
}

async function handleAuthResponse(response: Response, allowSignupUserResponse = false): Promise<AuthSession> {
  const payload = await safeJson(response);

  if (!response.ok) {
    const message = extractMessage(payload);
    throw new Error(message && message !== 'Invalid email or password.' ? message : 'Sorry, that didn’t work.');
  }

  if (isAuthSession(payload)) {
    return payload;
  }

  if (allowSignupUserResponse && isSignupUser(payload)) {
    return {
      accessToken: '',
      tokenType: 'Bearer',
      user: payload,
    };
  }

  throw new Error('Unexpected authentication response.');
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<AuthSession> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    return handleAuthResponse(response);
  } catch {
    throw new Error('Sorry, that didn’t work.');
  }
}

function extractMessage(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  if (!('message' in payload)) return undefined;

  const message = (payload as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
}

function isAuthSession(payload: unknown): payload is AuthSession {
  if (typeof payload !== 'object' || payload === null) return false;
  const value = payload as Partial<AuthSession>;
  return typeof value.accessToken === 'string' && value.tokenType === 'Bearer' && isAuthUser(value.user);
}

function isSignupUser(payload: unknown): payload is AuthUser {
  return isAuthUser(payload);
}

function isAuthUser(payload: unknown): payload is AuthUser {
  if (typeof payload !== 'object' || payload === null) return false;
  const value = payload as Partial<AuthUser>;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    typeof value.username === 'string' &&
    typeof value.status === 'string'
  );
}
