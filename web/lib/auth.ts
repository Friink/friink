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
  is_verified: boolean;
  created_at: string;
  updated_at: string;
};

type ApiTokenResponse = {
  access_token: string;
  token_type: string;
  user: ApiUser;
};

type ApiErrorBody = {
  detail?: string | Array<{ msg?: string }>;
};

export class AuthApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
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
  await requestApi<ApiUser>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      username: input.username,
      password: input.password,
      date_of_birth: input.dateOfBirth,
    }),
  });

  const session = await login(input.email, input.password);
  return {
    ...session,
    user: {
      ...session.user,
      name: input.name || session.user.name,
    },
  };
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

export async function updateCurrentUser(accessToken: string, input: { username: string }): Promise<AuthUser> {
  const response = await requestApi<ApiUser>('/auth/me', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ username: input.username }),
  });

  return mapApiUser(response);
}

export async function getCurrentUser(accessToken: string): Promise<AuthUser> {
  const response = await requestApi<ApiUser>('/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return mapApiUser(response);
}

export type ApiPost = {
  id: string;
  user_id: string;
  author_username: string;
  content: string;
  media_count: number;
  quoted_post_id: string | null;
  quoted_post: {
    id: string | null;
    author_username: string | null;
    content: string;
    unavailable: boolean;
  } | null;
  created_at: string;
  updated_at: string;
};

export async function listPosts(): Promise<ApiPost[]> {
  return requestApi<ApiPost[]>('/posts', {
    method: 'GET',
  });
}

export async function createPost(accessToken: string, input: { content: string; quotedPostId?: string | null; media?: unknown[] }): Promise<ApiPost> {
  return requestApi<ApiPost>('/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      content: input.content,
      quoted_post_id: input.quotedPostId ?? null,
      media: input.media,
    }),
  });
}

async function requestApi<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new AuthApiError(await getApiErrorMessage(response), response.status);
  }

  return response.json() as Promise<T>;
}

async function getApiErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (typeof body.detail === 'string') {
      return body.detail;
    }
    if (Array.isArray(body.detail)) {
      const firstMessage = body.detail.find((item) => item.msg)?.msg;
      if (firstMessage) return firstMessage;
    }
  } catch {
    // Fall through to the generic status message below.
  }

  return `Friink API request failed with ${response.status}`;
}

function mapTokenResponse(response: ApiTokenResponse): AuthSession {
  return {
    accessToken: response.access_token,
    tokenType: 'Bearer',
    user: mapApiUser(response.user),
  };
}

function mapApiUser(user: ApiUser): AuthUser {
  return {
    id: user.id,
    name: user.username,
    email: user.email,
    username: user.username,
    status: user.is_verified ? 'active' : 'pending_email_verification',
    emailVerifiedAt: user.is_verified ? user.updated_at : null,
  };
}
