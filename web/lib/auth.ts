import { fetchApi } from '@/lib/api-origin';
import { compressImage } from '@/lib/image-compression';
import { PresignedMediaUploadError, uploadPresignedMedia, type PresignedMediaUpload } from '@/lib/media-upload';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  about: string;
  profilePictureUrl: string | null;
  profilePictureUpdatedAt: string | null;
  isPrivate: boolean;
  setupStep: 1 | 2;
  setupCompleted: boolean;
  status: 'pending_email_verification' | 'active' | 'locked';
  emailVerifiedAt: string | null;
};

export type AuthSession = {
  accessToken: string;
  tokenType: 'Bearer';
  user: AuthUser;
};

export type ManagedAuthSession = {
  id: string;
  device_label: string;
  browser: string | null;
  operating_system: string | null;
  created_at: string;
  last_active_at: string;
  current: boolean;
};

const AUTH_SESSION_KEY = 'friink-auth-session';
const REFRESH_COORDINATION_KEY = 'friink-auth-refresh-coordination';
const REFRESH_LOCK_NAME = 'friink-auth-refresh-lock';
const DEFAULT_DEMO_EMAIL = 'demo@friink.local';
const REFRESH_LEASE_MS = 20000;
const REFRESH_RESULT_TTL_MS = 3000;
let refreshPromise: Promise<AuthSession> | null = null;
let authSessionGeneration = 0;
const tabId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
let coordinationListenerInstalled = false;

type ApiUser = {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  about: string | null;
  is_private: boolean;
  setup_step: 1 | 2;
  setup_completed: boolean;
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
  displayCode?: string;
  detail: string;

  constructor(message: string, status: number, code?: AuthErrorCode, options?: { displayCode?: string; detail?: string }) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.code = code;
    this.displayCode = options?.displayCode ?? code ?? (status > 0 ? `HTTP_${status}` : 'CLIENT_ERROR');
    this.detail = options?.detail ?? message;
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
    setupStep: 1,
    setupCompleted: true,
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
      setupStep: 1,
      setupCompleted: false,
    },
  };
}

export async function checkUsernameAvailability(username: string): Promise<{ username: string; available: boolean }> {
  return requestApi<{ username: string; available: boolean }>(`/auth/username-availability?username=${encodeURIComponent(username)}`, {
    method: 'GET',
    skipAuthRefresh: true,
  });
}

export function saveAuthSession(session: AuthSession) {
  if (typeof window === 'undefined') return;
  installAuthCoordinationListener();
  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function loadAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  installAuthCoordinationListener();

  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as Partial<AuthSession>;
    return isStoredAuthSession(session) ? session : null;
  } catch {
    return null;
  }
}

export function loadPersistedAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  installAuthCoordinationListener();

  const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as Partial<AuthSession>;
    return isStoredAuthSession(session) && session.user.email !== DEFAULT_DEMO_EMAIL ? session : null;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  installAuthCoordinationListener();
  authSessionGeneration += 1;
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

  installAuthCoordinationListener();
  refreshPromise = coordinateRefresh().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

type RefreshCoordinationState = {
  operationId: string;
  ownerId: string;
  status: 'refreshing' | 'succeeded' | 'failed';
  expiresAt: number;
  error?: { message: string; status: number; code?: AuthErrorCode };
};

function installAuthCoordinationListener() {
  if (typeof window === 'undefined' || coordinationListenerInstalled) return;
  coordinationListenerInstalled = true;
  window.addEventListener('storage', (event) => {
    if (event.key === AUTH_SESSION_KEY && event.newValue === null) {
      authSessionGeneration += 1;
    }
  });
}

function readRefreshCoordination(): RefreshCoordinationState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(REFRESH_COORDINATION_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as RefreshCoordinationState;
    if (!state.operationId || !state.ownerId || !state.status || typeof state.expiresAt !== 'number') return null;
    return state;
  } catch {
    return null;
  }
}

function publishRefreshCoordination(state: RefreshCoordinationState) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(REFRESH_COORDINATION_KEY, JSON.stringify(state));
}

async function coordinateRefresh(): Promise<AuthSession> {
  if (supportsCrossTabLock()) {
    const lockManager = (navigator as Navigator & { locks: { request<T>(name: string, options: { mode: 'exclusive' }, callback: () => Promise<T>): Promise<T> } }).locks;
    return lockManager.request(REFRESH_LOCK_NAME, { mode: 'exclusive' }, () => coordinateRefreshWithStorageLease());
  }
  return coordinateRefreshWithStorageLease();
}

function supportsCrossTabLock() {
  return typeof navigator !== 'undefined' && 'locks' in navigator;
}

async function coordinateRefreshWithStorageLease(): Promise<AuthSession> {
  const generation = authSessionGeneration;

  while (true) {
    const existing = readRefreshCoordination();
    if (existing && existing.expiresAt > Date.now()) {
      if (existing.status === 'succeeded') {
        const sharedSession = loadPersistedAuthSession();
        if (sharedSession) return sharedSession;
      } else if (existing.status === 'failed') {
        throw refreshErrorFromState(existing);
      } else if (existing.ownerId !== tabId) {
        await waitForRefreshCoordination(existing.operationId);
        continue;
      }
    }

    const operationId = `${tabId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const started: RefreshCoordinationState = {
      operationId,
      ownerId: tabId,
      status: 'refreshing',
      expiresAt: Date.now() + REFRESH_LEASE_MS,
    };
    publishRefreshCoordination(started);
    const winner = readRefreshCoordination();
    if (!winner || winner.operationId !== operationId || winner.ownerId !== tabId) {
      continue;
    }

    try {
      const session = await performRefresh(generation);
      publishRefreshCoordination({
        ...started,
        status: 'succeeded',
        expiresAt: Date.now() + REFRESH_RESULT_TTL_MS,
      });
      return session;
    } catch (error) {
      const refreshError = error instanceof AuthApiError ? error : new AuthApiError(error instanceof Error ? error.message : 'Refresh failed.', 0);
      if (isExplicitUnauthorized(refreshError)) {
        clearAuthSession();
      }
      publishRefreshCoordination({
        ...started,
        status: 'failed',
        expiresAt: Date.now() + REFRESH_RESULT_TTL_MS,
        error: { message: refreshError.message, status: refreshError.status, code: refreshError.code },
      });
      throw refreshError;
    }
  }
}

async function performRefresh(generation: number): Promise<AuthSession> {
  const currentSession = loadPersistedAuthSession();
  const response = await requestApi<{ access_token: string; token_type: string }>('/auth/refresh', {
    method: 'POST',
    authContext: 'refresh_exchange',
    skipAuthRefresh: true,
  });

  if (generation !== authSessionGeneration) {
    throw new AuthApiError('The session was cleared while it was refreshing.', 0);
  }

  if (currentSession) {
    const latestSession = loadPersistedAuthSession();
    if (latestSession?.accessToken !== currentSession.accessToken) {
      throw new AuthApiError('The session changed while it was refreshing.', 0);
    }
    const nextSession: AuthSession = {
      ...currentSession,
      accessToken: response.access_token,
      tokenType: 'Bearer',
    };
    saveAuthSession(nextSession);
    return nextSession;
  }

  const restoredUser = await requestApi<ApiUser>('/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${response.access_token}` },
    authContext: 'authenticated_request',
    skipAuthRefresh: true,
  });
  if (generation !== authSessionGeneration || loadPersistedAuthSession()) {
    throw new AuthApiError('The session changed while it was refreshing.', 0);
  }
  const restoredSession: AuthSession = {
    accessToken: response.access_token,
    tokenType: 'Bearer',
    user: mapApiUser(restoredUser),
  };
  saveAuthSession(restoredSession);
  return restoredSession;
}

function waitForRefreshCoordination(operationId: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(pollId);
      resolve();
    };
    const check = () => {
      const state = readRefreshCoordination();
      if (!state || state.operationId !== operationId || state.status !== 'refreshing' || state.expiresAt <= Date.now()) finish();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === REFRESH_COORDINATION_KEY) check();
    };
    const pollId = window.setInterval(check, 100);
    window.addEventListener('storage', onStorage);
    check();
  });
}

function refreshErrorFromState(state: RefreshCoordinationState): AuthApiError {
  const error = state.error;
  return new AuthApiError(error?.message ?? 'Refresh failed.', error?.status ?? 0, error?.code);
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

export async function changePassword(accessToken: string, currentPassword: string, newPassword: string, confirmPassword: string): Promise<void> {
  await requestApi<void>('/auth/me/password', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });
}

export async function listAuthSessions(accessToken: string): Promise<ManagedAuthSession[]> {
  return requestApi<ManagedAuthSession[]>('/auth/sessions', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}

export async function revokeAuthSession(accessToken: string, sessionId: string): Promise<void> {
  await requestApi<void>(`/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}

export async function revokeOtherAuthSessions(accessToken: string): Promise<void> {
  await requestApi<void>('/auth/sessions/revoke-others', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
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

export async function updateProfileSetup(accessToken: string, input: { step: 1 | 2; completed?: boolean }): Promise<AuthUser> {
  const response = await requestApi<ApiUser>('/auth/me/setup', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    authContext: 'authenticated_request',
    body: JSON.stringify({ step: input.step, completed: input.completed ?? false }),
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

function profilePictureUploadError(stage: 'start' | 'transfer' | 'confirm', error: unknown): AuthApiError {
  const apiError = error instanceof AuthApiError ? error : null;
  const status = apiError?.status ?? 0;

  if (stage === 'start') {
    if (status === 404) {
      return new AuthApiError('The staging API could not find the profile-picture upload endpoint (404). Redeploy the FastAPI staging project with the latest code.', status);
    }
    if (status === 503) {
      return new AuthApiError('The staging API is missing its R2 configuration. Check the five R2 variables in the FastAPI project’s Preview environment, then redeploy.', status);
    }
    if (status === 401) {
      return new AuthApiError('Your login session is no longer valid. Please log in again before uploading a profile picture.', status);
    }
    if (status === 0) {
      return new AuthApiError('The staging API could not be reached while starting the profile-picture upload. Check that NEXT_PUBLIC_API_BASE_URL points to https://staging-api.friink.com.', status);
    }
    return new AuthApiError(`The staging API could not start the profile-picture upload (${status}). ${apiError?.message || 'Check the FastAPI deployment logs.'}`, status);
  }

  if (stage === 'transfer') {
    if (status === 0) {
      return new AuthApiError('The image could not be sent to R2. The browser blocked the storage request; check that the R2 bucket CORS policy allows https://staging.friink.com to use PUT with the Content-Type header.', status);
    }
    if (status === 403) {
      return new AuthApiError('R2 rejected the image upload (403). Check the staging R2 access keys, bucket permissions, and CORS policy.', status);
    }
    if (status === 404) {
      return new AuthApiError('R2 could not find the staging upload target (404). Check the R2 account ID, bucket name, and generated upload URL.', status);
    }
    return new AuthApiError(`R2 could not accept the profile picture (${status}). Check the R2 bucket configuration and CORS policy.`, status);
  }

  if (status === 404) {
    return new AuthApiError('The image reached R2, but the staging API could not find the upload-confirmation endpoint (404). Redeploy the FastAPI staging project with the latest code.', status);
  }
  if (status === 502) {
    return new AuthApiError('The image was uploaded, but the API could not verify it in R2. Check the staging bucket, access keys, and object permissions.', status);
  }
  if (status === 503) {
    return new AuthApiError('The image was uploaded, but the staging API is missing its R2 configuration. Check the five R2 variables in the FastAPI project’s Preview environment, then redeploy.', status);
  }
  if (status === 401) {
    return new AuthApiError('The image was uploaded, but your login session expired before confirmation. Please log in again.', status);
  }
  if (status === 0) {
    return new AuthApiError('The image was uploaded to R2, but the staging API could not be reached to confirm it. Check https://staging-api.friink.com and its deployment status.', status);
  }
  return new AuthApiError(`The image was uploaded, but the API could not confirm it (${status}). ${apiError?.message || 'Check the FastAPI deployment logs.'}`, status);
}

export async function uploadProfilePicture(accessToken: string, file: File): Promise<AuthUser> {
  let upload: ProfilePictureUpload;
  try {
    upload = await requestApi<ProfilePictureUpload>('/auth/me/profile-picture/upload-url', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      authContext: 'authenticated_request',
      body: JSON.stringify({ content_type: file.type }),
    });
  } catch (error) {
    throw profilePictureUploadError('start', error);
  }

  try {
    const uploadResponse = await fetch(upload.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!uploadResponse.ok) {
      throw new AuthApiError(`R2 returned HTTP ${uploadResponse.status}.`, uploadResponse.status);
    }
  } catch (error) {
    throw profilePictureUploadError('transfer', error);
  }

  let confirmed: { profile_picture_url: string; profile_picture_updated_at: string };
  try {
    confirmed = await requestApi<{ profile_picture_url: string; profile_picture_updated_at: string }>(
      '/auth/me/profile-picture/confirm',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        authContext: 'authenticated_request',
        body: JSON.stringify({ object_key: upload.object_key }),
      },
    );
  } catch (error) {
    throw profilePictureUploadError('confirm', error);
  }
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
  profile_picture_url: string | null;
  content: string;
  media_count: number;
  media: { url: string }[];
  parent_post_id: string | null;
  quoted_post_id: string | null;
  reply_count: number;
  quote_count: number;
  quoted_post: {
    id: string | null;
    public_id: string | null;
    slug: string | null;
    author_username: string | null;
    author_display_name: string | null;
    profile_picture_url: string | null;
    content: string;
    media_count: number;
    media: { url: string }[];
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

export type ApiChatUser = {
  id: string;
  username: string;
  display_name: string | null;
  profile_picture_url: string | null;
};

export type ApiConversation = {
  id: string;
  participant: ApiChatUser;
  preview: string | null;
  updated_at: string;
  unread: boolean;
};

export type ApiMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export type ApiMessagePage = {
  items: ApiMessage[];
  next_cursor: string | null;
  has_more: boolean;
};

export type ApiNotification = {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  type: 'follow_sent_public' | 'new_follower' | 'request_sent' | 'request_received' | 'unfollow_confirmed' | 'request_accepted' | 'mention';
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
};

export type ApiNotificationPage = {
  items: ApiNotification[];
  next_cursor: string | null;
  has_more: boolean;
};

export async function listPosts(input: { cursor?: string; limit?: number; feed?: 'explore' | 'following' } = {}): Promise<ApiFeedPage> {
  const search = new URLSearchParams();
  if (input.cursor) {
    search.set('cursor', input.cursor);
  }
  if (input.limit) {
    search.set('limit', String(input.limit));
  }
  if (input.feed) {
    search.set('feed', input.feed);
  }

  const suffix = search.size > 0 ? `?${search.toString()}` : '';
  const session = loadAuthSession();
  return requestApi<ApiFeedPage>(`/posts${suffix}`, {
    method: 'GET',
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
    authContext: session ? 'authenticated_request' : undefined,
  });
}

export async function listNewerPosts(input: { afterCreatedAt: string; afterId: string; limit?: number; feed?: 'explore' | 'following' }): Promise<ApiPost[]> {
  const search = new URLSearchParams({
    after_created_at: input.afterCreatedAt,
    after_id: input.afterId,
  });
  if (input.limit) {
    search.set('limit', String(input.limit));
  }
  if (input.feed) {
    search.set('feed', input.feed);
  }

  const session = loadAuthSession();
  return requestApi<ApiPost[]>(`/posts/updates?${search.toString()}`, {
    method: 'GET',
    headers: session ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
    authContext: session ? 'authenticated_request' : undefined,
  });
}

export async function getFeedContext(postId: string, input: { beforeLimit?: number; afterLimit?: number; feed?: 'explore' | 'following' } = {}): Promise<ApiFeedContext> {
  const search = new URLSearchParams();
  if (input.beforeLimit) {
    search.set('before_limit', String(input.beforeLimit));
  }
  if (input.afterLimit) {
    search.set('after_limit', String(input.afterLimit));
  }
  if (input.feed) {
    search.set('feed', input.feed);
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

type PostMediaUploadUrls = { items: PresignedMediaUpload[] };
type PostMediaConfirmation = { object_key: string; public_url: string };

function postMediaUploadError(stage: 'start' | 'transfer' | 'confirm', error: unknown): AuthApiError {
  const apiError = error instanceof AuthApiError ? error : null;
  const transferError = error instanceof PresignedMediaUploadError ? error : null;
  const status = apiError?.status ?? transferError?.status ?? 0;

  if (stage === 'start') {
    if (status === 404) {
      return new AuthApiError('The API could not find the post-media upload endpoint (404). Redeploy the FastAPI project with the latest code.', status);
    }
    if (status === 503) {
      return new AuthApiError('Post-media uploads are unavailable because storage is not configured on the API.', status);
    }
    if (status === 401) {
      return new AuthApiError('Your login session is no longer valid. Please log in again before uploading images.', status);
    }
    if (status === 0) {
      return new AuthApiError('The API could not be reached while preparing the image upload. Check the API deployment and connection.', status);
    }
    return new AuthApiError(`The API could not prepare the image upload (${status}). ${apiError?.message || 'Check the API logs.'}`, status);
  }

  if (stage === 'confirm') {
    if (status === 404) {
      return new AuthApiError('The API could not find the post-media confirmation endpoint (404). Redeploy the FastAPI project with the latest code.', status);
    }
    if (status === 502) {
      return new AuthApiError('The image reached storage, but the API could not verify it. Check the R2 object and API logs.', status);
    }
    if (status === 503) {
      return new AuthApiError('The image reached storage, but post-media storage is not configured on the API.', status);
    }
    if (status === 401) {
      return new AuthApiError('The image reached storage, but your login session expired before confirmation. Please log in again.', status);
    }
    if (status === 0) {
      return new AuthApiError('The image reached storage, but the API could not confirm it. Check the API deployment and connection.', status);
    }
    return new AuthApiError(`The API could not confirm the image (${status}). ${apiError?.message || 'Check the API logs.'}`, status);
  }

  if (status === 0) {
    return new AuthApiError('The image could not be sent to storage. Check the storage bucket CORS policy and upload configuration.', status);
  }
  if (status === 403) {
    return new AuthApiError('Storage rejected the image upload (403). Check the bucket permissions and CORS policy.', status);
  }
  if (status === 404) {
    return new AuthApiError('Storage could not find the generated upload target (404). Check the R2 account, bucket, and upload URL configuration.', status);
  }
  return new AuthApiError(`Storage could not accept the image (${status}). Check the bucket configuration and CORS policy.`, status);
}

async function uploadPostMedia(accessToken: string, files: File[]): Promise<string[]> {
  const uploadedKeys: string[] = [];
  try {
    for (const file of files) {
      const compressedFile = await compressImage(file, 'postMedia');
      let uploadUrls: PostMediaUploadUrls;
      try {
        uploadUrls = await requestApi<PostMediaUploadUrls>('/posts/media/upload-url', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          authContext: 'authenticated_request',
          body: JSON.stringify({ count: 1 }),
        });
      } catch (error) {
        throw postMediaUploadError('start', error);
      }
      const item = uploadUrls.items[0];
      if (uploadUrls.items.length !== 1 || !item) {
        throw new AuthApiError('The server returned an invalid one-image post-media upload plan.', 502);
      }

      // Claim the key before PUT: storage may receive the body even when the
      // browser observes a failed or interrupted response.
      uploadedKeys.push(item.object_key);
      try {
        await uploadPresignedMedia(item, compressedFile);
      } catch (error) {
        throw postMediaUploadError('transfer', error);
      }

      try {
        await requestApi<PostMediaConfirmation>('/posts/media/confirm', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          authContext: 'authenticated_request',
          body: JSON.stringify({ object_key: item.object_key }),
        });
      } catch (error) {
        throw postMediaUploadError('confirm', error);
      }
    }
    return uploadedKeys;
  } catch (error) {
    if (uploadedKeys.length) {
      await requestApi<void>('/posts/media/cleanup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        authContext: 'authenticated_request',
        body: JSON.stringify({ storage_keys: uploadedKeys }),
      }).catch(() => undefined);
    }
    throw error;
  }
}

export async function createPost(accessToken: string, input: { content: string; kind?: 'post' | 'quote' | 'reply'; quotedPostId?: string | null; parentPostId?: string | null; media?: File[] }): Promise<ApiPost> {
  const mediaKeys = input.media?.length ? await uploadPostMedia(accessToken, input.media) : undefined;
  try {
    return await requestApi<ApiPost>('/posts', {
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
        media: mediaKeys?.map((storageKey) => ({ storage_key: storageKey })),
      }),
    });
  } catch (error) {
    if (mediaKeys?.length) {
      await requestApi<void>('/posts/media/cleanup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        authContext: 'authenticated_request',
        body: JSON.stringify({ storage_keys: mediaKeys }),
      }).catch(() => undefined);
    }
    throw error;
  }
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

export async function listConversations(accessToken: string): Promise<ApiConversation[]> {
  const response = await requestApi<{ items: ApiConversation[] }>('/chat/conversations', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
  return response.items;
}

export async function getConversationWithUser(accessToken: string, username: string): Promise<ApiConversation> {
  return requestApi<ApiConversation>(`/chat/conversations/with/${encodeURIComponent(username)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}

export async function listConversationMessages(accessToken: string, conversationId: string, after?: string | null): Promise<ApiMessagePage> {
  const query = after ? `?after=${encodeURIComponent(after)}` : '';
  return requestApi<ApiMessagePage>(`/chat/conversations/${conversationId}/messages${query}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}

export async function sendConversationMessage(accessToken: string, conversationId: string, content: string, clientMessageId: string): Promise<ApiMessage> {
  return requestApi<ApiMessage>(`/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
    body: JSON.stringify({ content, client_message_id: clientMessageId }),
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
  init: RequestInit & {
    authContext?: AuthRequestContext;
    skipAuthRefresh?: boolean;
    retryingAfterRefresh?: boolean;
  },
): Promise<T> {
  const requestInit = { ...init };

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
      const refreshedSession = await refreshAuthSession();
      return requestApi<T>(path, {
        ...requestInit,
        headers: withAuthorizationHeader(requestInit.headers, refreshedSession.accessToken),
        retryingAfterRefresh: true,
      });
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
  return {
    accessToken: response.access_token,
    tokenType: 'Bearer',
    user: mapApiUser(response.user),
  };
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
    setupStep: user.setup_step,
    setupCompleted: user.setup_completed,
    status: user.is_verified ? 'active' : 'pending_email_verification',
    emailVerifiedAt: user.is_verified ? user.updated_at : null,
  };
}

function isStoredAuthSession(session: Partial<AuthSession>): session is AuthSession {
  return Boolean(
    typeof session.accessToken === 'string' &&
      session.accessToken.split('.').length === 3 &&
      session.tokenType === 'Bearer' &&
      session.user &&
      typeof session.user === 'object' &&
      typeof session.user.email === 'string',
  );
}

function isExplicitUnauthorized(error: unknown): error is AuthApiError {
  return error instanceof AuthApiError && error.status === 401;
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
