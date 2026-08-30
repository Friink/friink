import { fetchApi } from '@/lib/api-origin';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  about: string;
  profilePictureUrl: string | null;
  profilePictureUpdatedAt: string | null;
  isPrivate: boolean;
  status: 'pending_email_verification' | 'active' | 'locked';
  emailVerifiedAt: string | null;
};

export type AuthSession = {
  accessToken: string;
  tokenType: 'Bearer';
  user: AuthUser;
  accessTokenExpiresAt?: number;
};

const AUTH_SESSION_KEY = 'friink-auth-session';
const DEFAULT_DEMO_EMAIL = 'demo@friink.local';
const TOKEN_REFRESH_LIFETIME_FRACTION = 0.8;
let refreshPromise: Promise<AuthSession> | null = null;

type ApiUser = {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  about: string | null;
  is_private: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  profile_picture_url: string | null;
  profile_picture_updated_at: string | null;
};

type ApiPublicUser = {
  id: string;
  username: string;
  display_name: string | null;
  about: string | null;
  profile_picture_url: string | null;
  profile_picture_updated_at: string | null;
  is_private: boolean;
};

type ApiTokenResponse = {
  access_token: string;
  token_type: string;
  user: ApiUser;
};

type AuthErrorCode =
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'TOKEN_MALFORMED'
  | 'TOKEN_SIGNATURE_MISMATCH'
  | 'TOKEN_SCHEMA_INVALID'
  | 'SESSION_NOT_FOUND'
  | 'REFRESH_TOKEN_MISSING'
  | 'REFRESH_TOKEN_INVALID';

type ApiErrorBody = {
  detail?: string | { message?: string; code?: AuthErrorCode } | Array<{ msg?: string }>;
};

type AuthRequestContext = 'fresh_login' | 'refresh_exchange' | 'authenticated_request';

export class AuthApiError extends Error {
  status: number;
  code?: AuthErrorCode;

  constructor(message: string, status: number, code?: AuthErrorCode) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.code = code;
  }
}

export function createDemoSession(overrides: Partial<AuthUser> = {}): AuthSession {
  const demoUser: AuthUser = {
    id: 'demo-user',
    name: 'Demo User',
    email: DEFAULT_DEMO_EMAIL,
    username: 'demouser',
    about: '',
    profilePictureUrl: null,
    profilePictureUpdatedAt: null,
    isPrivate: false,
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
      display_name: input.name,
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
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(withAccessTokenExpiry(session)));
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

export async function refreshAuthSession(): Promise<AuthSession> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const currentSession = loadPersistedAuthSession();
    const response = await requestApi<{ access_token: string; token_type: string }>('/auth/refresh', {
      method: 'POST',
      authContext: 'refresh_exchange',
      skipAuthRefresh: true,
    });
    if (!currentSession) {
      throw new AuthApiError('Please log in again.', 401, 'SESSION_NOT_FOUND');
    }

    const nextSession = withAccessTokenExpiry({
      ...currentSession,
      accessToken: response.access_token,
      tokenType: 'Bearer',
    });
    saveAuthSession(nextSession);
    return nextSession;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function updateCurrentUser(
  accessToken: string,
  input: { username?: string; email?: string; displayName?: string; about?: string; isPrivate?: boolean },
): Promise<AuthUser> {
  const response = await requestApi<ApiUser>('/auth/me', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
    body: JSON.stringify({
      username: input.username,
      email: input.email,
      display_name: input.displayName,
      about: input.about,
      is_private: input.isPrivate,
    }),
  });

  return mapApiUser(response);
}

export async function getCurrentUser(accessToken: string): Promise<AuthUser> {
  const response = await requestApi<ApiUser>('/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
  });

  return mapApiUser(response);
}

export async function getPublicUser(username: string): Promise<Pick<AuthUser, 'id' | 'name' | 'username' | 'about' | 'isPrivate' | 'profilePictureUrl' | 'profilePictureUpdatedAt'>> {
  const response = await requestApi<ApiPublicUser>(`/auth/users/${encodeURIComponent(username)}`, {
    method: 'GET',
  });

  return {
    id: response.id,
    name: response.display_name || response.username,
    username: response.username,
    about: response.about ?? '',
    isPrivate: response.is_private,
    profilePictureUrl: response.profile_picture_url,
    profilePictureUpdatedAt: response.profile_picture_updated_at,
  };
}

export type ProfilePictureUpload = {
  upload_url: string;
  public_url: string;
  object_key: string;
};

export async function uploadProfilePicture(accessToken: string, file: File): Promise<AuthUser> {
  const upload = await requestApi<ProfilePictureUpload>('/auth/me/profile-picture/upload-url', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
    body: JSON.stringify({ content_type: file.type }),
  });

  const uploadResponse = await fetch(upload.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new AuthApiError(`Profile picture upload failed with ${uploadResponse.status}.`, uploadResponse.status);
  }

  const confirmed = await requestApi<{ profile_picture_url: string; profile_picture_updated_at: string }>(
    '/auth/me/profile-picture/confirm',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      authContext: 'authenticated_request',
      body: JSON.stringify({ object_key: upload.object_key }),
    },
  );
  const session = loadAuthSession();
  if (!session) throw new AuthApiError('Please log in again.', 401);
  return {
    ...session.user,
    profilePictureUrl: confirmed.profile_picture_url,
    profilePictureUpdatedAt: confirmed.profile_picture_updated_at,
  };
}

export type ApiPost = {
  id: string;
  public_id: string;
  slug: string;
  user_id: string;
  kind: 'post' | 'quote' | 'reply';
  author_username: string;
  author_display_name: string | null;
  content: string;
  media_count: number;
  parent_post_id: string | null;
  quoted_post_id: string | null;
  reply_count: number;
  quote_count: number;
  quoted_post: {
    id: string | null;
    author_username: string | null;
    author_display_name: string | null;
    content: string;
    media_count: number;
    unavailable: boolean;
  } | null;
  created_at: string;
  updated_at: string;
};

export type ApiFeedPage = {
  items: ApiPost[];
  next_cursor: string | null;
  has_more: boolean;
};

export type ApiFeedContext = {
  items: ApiPost[];
  anchor_post_id: string;
  next_cursor: string | null;
  has_more: boolean;
};

export type ApiConnectionUser = {
  id: string;
  username: string;
  is_private: boolean;
};

export type ApiFollowRequest = {
  id: string;
  requester: ApiConnectionUser;
  recipient: ApiConnectionUser;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
  created_at: string;
  responded_at: string | null;
};

export type ApiConnectionStatus = {
  user: ApiConnectionUser;
  state: 'self' | 'none' | 'requested' | 'following';
  request: ApiFollowRequest | null;
};

export type ApiConnectionList = {
  users: ApiConnectionUser[];
  count: number;
};

export type ApiNotification = {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  type: 'follow_sent_public' | 'new_follower' | 'request_sent' | 'request_received' | 'unfollow_confirmed' | 'request_accepted';
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
};

export type ApiNotificationPage = {
  items: ApiNotification[];
  next_cursor: string | null;
  has_more: boolean;
};

export async function listPosts(input: { cursor?: string; limit?: number } = {}): Promise<ApiFeedPage> {
  const search = new URLSearchParams();
  if (input.cursor) {
    search.set('cursor', input.cursor);
  }
  if (input.limit) {
    search.set('limit', String(input.limit));
  }

  const suffix = search.size > 0 ? `?${search.toString()}` : '';
  const session = loadAuthSession();
  return requestApi<ApiFeedPage>(`/posts${suffix}`, {
    method: 'GET',
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
    authContext: session ? 'authenticated_request' : undefined,
  });
}

export async function listNewerPosts(input: { afterCreatedAt: string; afterId: string; limit?: number }): Promise<ApiPost[]> {
  const search = new URLSearchParams({
    after_created_at: input.afterCreatedAt,
    after_id: input.afterId,
  });
  if (input.limit) {
    search.set('limit', String(input.limit));
  }

  const session = loadAuthSession();
  return requestApi<ApiPost[]>(`/posts/updates?${search.toString()}`, {
    method: 'GET',
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
    authContext: session ? 'authenticated_request' : undefined,
  });
}

export async function getFeedContext(postId: string, input: { beforeLimit?: number; afterLimit?: number } = {}): Promise<ApiFeedContext> {
  const search = new URLSearchParams();
  if (input.beforeLimit) {
    search.set('before_limit', String(input.beforeLimit));
  }
  if (input.afterLimit) {
    search.set('after_limit', String(input.afterLimit));
  }

  const suffix = search.size > 0 ? `?${search.toString()}` : '';
  const session = loadAuthSession();
  return requestApi<ApiFeedContext>(`/posts/context/${encodeURIComponent(postId)}${suffix}`, {
    method: 'GET',
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
    authContext: session ? 'authenticated_request' : undefined,
  });
}

export async function getPost(postId: string): Promise<ApiPost> {
  const session = loadAuthSession();
  return requestApi<ApiPost>(`/posts/${encodeURIComponent(postId)}`, {
    method: 'GET',
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
    authContext: session ? 'authenticated_request' : undefined,
  });
}

export async function getPostByPublicId(publicId: string): Promise<ApiPost> {
  const session = loadAuthSession();
  return requestApi<ApiPost>(`/posts/public/${encodeURIComponent(publicId)}`, {
    method: 'GET',
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
    authContext: session ? 'authenticated_request' : undefined,
  });
}

export async function listPostReplies(postId: string): Promise<ApiPost[]> {
  const session = loadAuthSession();
  return requestApi<ApiPost[]>(`/posts/${encodeURIComponent(postId)}/replies`, {
    method: 'GET',
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
    authContext: session ? 'authenticated_request' : undefined,
  });
}

export async function createPost(accessToken: string, input: { content: string; kind?: 'post' | 'quote' | 'reply'; quotedPostId?: string | null; parentPostId?: string | null; media?: unknown[] }): Promise<ApiPost> {
  return requestApi<ApiPost>('/posts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
    body: JSON.stringify({
      kind: input.kind ?? 'post',
      content: input.content,
      quoted_post_id: input.quotedPostId ?? null,
      parent_post_id: input.parentPostId ?? null,
      media: input.media,
    }),
  });
}

export async function getConnectionStatus(accessToken: string, username: string): Promise<ApiConnectionStatus> {
  return requestApi<ApiConnectionStatus>(`/connections/status/${encodeURIComponent(username)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
  });
}

export async function sendFollowRequest(accessToken: string, recipientUsername: string): Promise<ApiFollowRequest> {
  return requestApi<ApiFollowRequest>('/connections/requests', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
    body: JSON.stringify({ recipient_username: recipientUsername }),
  });
}

export async function acceptFollowRequest(accessToken: string, requestId: string): Promise<ApiFollowRequest> {
  return requestApi<ApiFollowRequest>(`/connections/requests/${requestId}/accept`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
  });
}

export async function rejectFollowRequest(accessToken: string, requestId: string): Promise<ApiFollowRequest> {
  return requestApi<ApiFollowRequest>(`/connections/requests/${requestId}/reject`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
  });
}

export async function cancelFollowRequest(accessToken: string, requestId: string): Promise<ApiFollowRequest> {
  return requestApi<ApiFollowRequest>(`/connections/requests/${requestId}/cancel`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
  });
}

export async function removeConnection(accessToken: string, requestId: string): Promise<ApiFollowRequest> {
  return requestApi<ApiFollowRequest>(`/connections/${requestId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
  });
}

export async function listIncomingFollowRequests(accessToken: string): Promise<ApiFollowRequest[]> {
  return requestApi<ApiFollowRequest[]>('/connections/requests/incoming', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
  });
}

export async function listOutgoingFollowRequests(accessToken: string): Promise<ApiFollowRequest[]> {
  return requestApi<ApiFollowRequest[]>('/connections/requests/outgoing', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
  });
}

export async function listNotifications(accessToken: string, input: { cursor?: string; limit?: number } = {}): Promise<ApiNotificationPage> {
  const search = new URLSearchParams();
  if (input.cursor) {
    search.set('cursor', input.cursor);
  }
  if (input.limit) {
    search.set('limit', String(input.limit));
  }
  const suffix = search.size > 0 ? `?${search.toString()}` : '';
  return requestApi<ApiNotificationPage>(`/notifications${suffix}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
  });
}

export async function getUnreadNotificationCount(accessToken: string): Promise<{ count: number }> {
  return requestApi<{ count: number }>('/notifications/unread-count', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
  });
}

export async function markNotificationRead(accessToken: string, notificationId: string): Promise<ApiNotification> {
  return requestApi<ApiNotification>(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
  });
}

export async function markAllNotificationsRead(accessToken: string): Promise<void> {
  await requestApi<void>('/notifications/read-all', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
  });
}

export async function listFollowers(username: string): Promise<ApiConnectionList> {
  return requestApi<ApiConnectionList>(`/connections/users/${encodeURIComponent(username)}/followers`, {
    method: 'GET',
  });
}

export async function listFollowing(username: string): Promise<ApiConnectionList> {
  return requestApi<ApiConnectionList>(`/connections/users/${encodeURIComponent(username)}/following`, {
    method: 'GET',
  });
}

export async function removeFollower(accessToken: string, username: string): Promise<ApiFollowRequest> {
  return requestApi<ApiFollowRequest>(`/connections/followers/${encodeURIComponent(username)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
  });
}

async function requestApi<T>(
  path: string,
  init: RequestInit & { authContext?: AuthRequestContext; skipAuthRefresh?: boolean; retryingAfterRefresh?: boolean },
): Promise<T> {
  const requestInit = { ...init };
  if (!requestInit.skipAuthRefresh && requestInit.authContext === 'authenticated_request') {
    const refreshedToken = await getProactivelyRefreshedAccessToken(requestInit.headers);
    if (refreshedToken) {
      requestInit.headers = withAuthorizationHeader(requestInit.headers, refreshedToken);
    }
  }

  let response: Response;
  try {
    response = await fetchApi(path, {
      ...requestInit,
      headers: {
        'Content-Type': 'application/json',
        ...(requestInit.authContext ? { 'X-Friink-Auth-Context': requestInit.authContext } : {}),
        ...requestInit.headers,
      },
      credentials: 'include',
    });
  } catch (error) {
    const message = error instanceof Error ? ensureTerminalPeriod(error.message) : 'Failed to fetch.';
    throw new AuthApiError(message, 0);
  }

  if (!response.ok) {
    const apiError = await getApiError(response);
    if (
      !requestInit.skipAuthRefresh &&
      !requestInit.retryingAfterRefresh &&
      response.status === 401 &&
      apiError.code === 'TOKEN_EXPIRED' &&
      requestInit.authContext === 'authenticated_request'
    ) {
      try {
        const refreshedSession = await refreshAuthSession();
        return requestApi<T>(path, {
          ...requestInit,
          headers: withAuthorizationHeader(requestInit.headers, refreshedSession.accessToken),
          retryingAfterRefresh: true,
        });
      } catch {
        clearAuthSession();
        throw new AuthApiError('Please log in again.', 401, 'REFRESH_TOKEN_INVALID');
      }
    }
    throw new AuthApiError(apiError.message, response.status, apiError.code);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function ensureTerminalPeriod(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return 'Friink API request failed.';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

async function getApiError(response: Response): Promise<{ message: string; code?: AuthErrorCode }> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (typeof body.detail === 'string') {
      return { message: body.detail };
    }
    if (body.detail && !Array.isArray(body.detail) && typeof body.detail === 'object') {
      return {
        message: body.detail.message || `Friink API request failed with ${response.status}.`,
        code: body.detail.code,
      };
    }
    if (Array.isArray(body.detail)) {
      const firstMessage = body.detail.find((item) => item.msg)?.msg;
      if (firstMessage) return { message: firstMessage };
    }
  } catch {
    // Fall through to the generic status message below.
  }

  return { message: `Friink API request failed with ${response.status}.` };
}

function mapTokenResponse(response: ApiTokenResponse): AuthSession {
  return withAccessTokenExpiry({
    accessToken: response.access_token,
    tokenType: 'Bearer',
    user: mapApiUser(response.user),
  });
}

function mapApiUser(user: ApiUser): AuthUser {
  return {
    id: user.id,
    name: user.display_name || user.username,
    email: user.email,
    username: user.username,
    about: user.about ?? '',
    profilePictureUrl: user.profile_picture_url,
    profilePictureUpdatedAt: user.profile_picture_updated_at,
    isPrivate: user.is_private,
    status: user.is_verified ? 'active' : 'pending_email_verification',
    emailVerifiedAt: user.is_verified ? user.updated_at : null,
  };
}

function withAccessTokenExpiry(session: AuthSession): AuthSession {
  return {
    ...session,
    accessTokenExpiresAt: getJwtTimestampMs(session.accessToken, 'exp') ?? session.accessTokenExpiresAt,
  };
}

function getJwtTimestampMs(token: string, claim: 'iat' | 'exp'): number | undefined {
  if (typeof window === 'undefined') return undefined;
  const [, payload] = token.split('.');
  if (!payload) return undefined;
  try {
    const decoded = JSON.parse(window.atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    return typeof decoded[claim] === 'number' ? decoded[claim] * 1000 : undefined;
  } catch {
    return undefined;
  }
}

async function getProactivelyRefreshedAccessToken(headers: HeadersInit | undefined): Promise<string | null> {
  const session = loadPersistedAuthSession();
  if (!session?.accessTokenExpiresAt) return null;
  const authorization = getAuthorizationHeader(headers);
  if (!authorization || authorization !== `Bearer ${session.accessToken}`) return null;

  const issuedAt = getJwtTimestampMs(session.accessToken, 'iat');
  if (!issuedAt) return null;
  const refreshAt = issuedAt + (session.accessTokenExpiresAt - issuedAt) * TOKEN_REFRESH_LIFETIME_FRACTION;
  if (Date.now() < refreshAt) return null;

  const refreshedSession = await refreshAuthSession();
  return refreshedSession.accessToken;
}

function getAuthorizationHeader(headers: HeadersInit | undefined): string | null {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get('Authorization') || headers.get('authorization');
  if (Array.isArray(headers)) {
    return headers.find(([key]) => key.toLowerCase() === 'authorization')?.[1] ?? null;
  }
  return headers.Authorization ?? headers.authorization ?? null;
}

function withAuthorizationHeader(headers: HeadersInit | undefined, accessToken: string): HeadersInit {
  if (headers instanceof Headers) {
    const next = new Headers(headers);
    next.set('Authorization', `Bearer ${accessToken}`);
    return next;
  }
  if (Array.isArray(headers)) {
    return [...headers.filter(([key]) => key.toLowerCase() !== 'authorization'), ['Authorization', `Bearer ${accessToken}`]];
  }
  return { ...headers, Authorization: `Bearer ${accessToken}` };
}
