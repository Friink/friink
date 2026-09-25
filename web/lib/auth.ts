import { fetchApi } from '@/lib/api-origin';
import { compressImage } from '@/lib/image-compression';
import { PresignedMediaUploadError, uploadPresignedMedia, type PresignedMediaUpload } from '@/lib/media-upload';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  about: string;
  dateOfBirth: string;
  createdAt: string;
  accountRegion: string | null;
  location: string | null;
  useIntent: 'professional' | 'personal' | null;
  showProfessionalBadge: boolean;
  profilePictureUrl: string | null;
  profilePictureUpdatedAt: string | null;
  isPrivate: boolean;
  likesVisible: boolean;
  isStaff: boolean;
  setupStep: 1 | 2 | 3;
  setupCompleted: boolean;
  status: 'pending_email_verification' | 'active' | 'locked';
  emailVerifiedAt: string | null;
};

export type AuthSession = {
  accessToken: string;
  tokenType: 'Bearer';
  user: AuthUser;
  accountSlot?: string;
};

export type AccountSummary = { accountSlot: string; username: string; displayName: string | null; profilePictureUrl: string | null; active: boolean; available: boolean; lastUsedAt: string; showProfessionalBadge: boolean };
export type PendingLoginApproval = { challengeId: string; deviceLabel: string; browser: string | null; createdAt: string; expiresAt: string };

export type LoginChallenge = {
  challengeRequired: true;
  challengeToken: string;
  message: string;
  lifecycleStatus?: 'deactivated' | 'pending_deletion';
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
const ACCOUNT_SLOT_KEY = 'friink-active-account-slot';
const ACCOUNT_SLOT_SESSION_KEY = 'friink-active-account-slot-session';
const ACCOUNT_SUMMARIES_KEY = 'friink-account-summaries';
const AUTH_SESSION_SLOT_PREFIX = 'friink-auth-session-slot:';
const AUTH_SESSION_USER_PREFIX = 'friink-auth-session-user:';
const DEACTIVATION_FALLBACK_SLOT_KEY = 'friink-deactivation-fallback-slot';
const REFRESH_COORDINATION_KEY = 'friink-auth-refresh-coordination';
const REFRESH_LOCK_NAME = 'friink-auth-refresh-lock';
const DEFAULT_DEMO_EMAIL = 'demo@friink.local';
const REFRESH_LEASE_MS = 20000;
const REFRESH_RESULT_TTL_MS = 3000;
const refreshPromises = new Map<string, Promise<AuthSession>>();
let authSessionGeneration = 0;
const tabId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
let coordinationListenerInstalled = false;
let inMemoryAuthSession: AuthSession | null = null;
let authBroadcastChannel: BroadcastChannel | null = null;

type ApiUser = {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  about: string | null;
  date_of_birth: string;
  is_private: boolean;
  likes_visible: boolean;
  setup_step: 1 | 2 | 3;
  setup_completed: boolean;
  is_verified: boolean;
  is_staff: boolean;
  created_at: string;
  account_region: string | null;
  location: string | null;
  use_intent: 'professional' | 'personal' | null;
  show_professional_badge: boolean;
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
  likes_visible: boolean;
  show_professional_badge: boolean;
};

export async function requestPasswordReset(email: string): Promise<void> {
  await requestApi<{ message: string }>('/auth/password-reset/start', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  await requestApi<void>('/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token, new_password: newPassword }) });
}

export type StaffRole = { key: string; display_name: string; system: boolean; permissions: string[] };
export type StaffUser = { id: string; username: string; display_name: string | null; email: string; is_staff: boolean; account_locked: boolean; lifecycle_status: 'active' | 'deactivated' | 'pending_deletion' | 'deleted'; deletion_deadline: string | null; permissions: string[] };
export type SubscriptionSummary = { plan_code: string; plan_name: string; expires_at: string | null; status: 'active' | 'expired' | 'revoked'; assignment_status: 'active' | 'expired' | 'revoked' | null; assignment_id: string | null };
export type SubscriptionAssignment = SubscriptionSummary & { user_id: string; starts_at: string | null; reason: string | null; created_at: string | null; revoked_at: string | null };
export type PushSubscription = {
  id: string;
  endpoint: string;
  device_label: string | null;
  active: boolean;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
};
export type ProfessionalRegistration = {
  user_id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  profile_picture_url: string | null;
  id: string | null;
  status: 'pending' | 'registered' | 'rejected' | 'cancelled' | 'revoked' | null;
  institute: string | null;
  credential_id: string | null;
  decision_message: string | null;
  show_registered_badge: boolean;
  show_in_directory: boolean;
  professional: boolean;
  directory_eligible: boolean;
  created_at: string | null;
  decided_at: string | null;
};

export async function listPushSubscriptions(accessToken: string): Promise<PushSubscription[]> {
  return requestApi<PushSubscription[]>('/notifications/push-subscriptions', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}

export async function savePushSubscription(accessToken: string, subscription: PushSubscriptionJSON, deviceLabel?: string): Promise<PushSubscription> {
  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) {
    throw new AuthApiError('This browser did not provide a complete notification subscription.', 0);
  }
  return requestApi<PushSubscription>('/notifications/push-subscriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      ...(deviceLabel ? { device_label: deviceLabel } : {}),
    }),
  });
}

export async function revokePushSubscription(accessToken: string, subscriptionId: string): Promise<void> {
  await requestApi<void>(`/notifications/push-subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}
export async function getProfessionalRegistration(accessToken: string): Promise<ProfessionalRegistration> {
  return requestApi<ProfessionalRegistration>('/professional-registration', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}
export async function submitProfessionalRegistration(accessToken: string, payload: { institute: string; credential_id: string }): Promise<ProfessionalRegistration> {
  return requestApi<ProfessionalRegistration>('/professional-registration', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
    body: JSON.stringify(payload),
  });
}
export async function cancelProfessionalRegistration(accessToken: string): Promise<ProfessionalRegistration> {
  return requestApi<ProfessionalRegistration>('/professional-registration/cancel', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}
export async function staffStepUp(accessToken: string, password: string): Promise<{ permissions: string[]; privileged_expires_at: string }> {
  return requestApi('/staff/step-up', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ password }), skipAuthRefresh: true });
}
export async function staffMe(accessToken: string): Promise<{ permissions: string[]; privileged_expires_at: string }> {
  return requestApi('/staff/me', { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, skipAuthRefresh: true });
}
export type StaffOverview = { total_users: number; staff_users: number };
export async function getStaffOverview(accessToken: string): Promise<StaffOverview> {
  return requestApi('/staff/overview', { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, skipAuthRefresh: true });
}
export async function listStaffUsers(accessToken: string, query = ''): Promise<StaffUser[]> {
  const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  return requestApi(`/staff/users${suffix}`, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, skipAuthRefresh: true });
}
export async function listProfessionalRegistrations(accessToken: string, status = 'pending', query = ''): Promise<ProfessionalRegistration[]> {
  const params = new URLSearchParams({ status });
  if (query.trim()) params.set('q', query.trim());
  return requestApi(`/staff/professional-registrations?${params.toString()}`, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, skipAuthRefresh: true });
}
export async function decideProfessionalRegistration(accessToken: string, registrationId: string, action: 'approve' | 'reject' | 'revoke', message?: string): Promise<ProfessionalRegistration> {
  return requestApi(`/staff/professional-registrations/${encodeURIComponent(registrationId)}/decision`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ action, message: message?.trim() || null }), skipAuthRefresh: true });
}
export async function listSubscriptionAssignments(accessToken: string, publicId: string): Promise<SubscriptionAssignment[]> {
  return requestApi(`/subscriptions/admin/users/${encodeURIComponent(publicId)}/assignments`, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, skipAuthRefresh: true });
}
export async function listSubscriptionPlans(accessToken: string): Promise<Array<{ code: string; name: string; description: string; active: boolean }>> {
  return requestApi('/subscriptions/admin/plans', { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, skipAuthRefresh: true });
}
export async function grantSubscription(accessToken: string, publicId: string, payload: { plan_code: string; duration_days?: number; expires_at?: string; reason: string }): Promise<SubscriptionAssignment> {
  return requestApi(`/subscriptions/admin/users/${encodeURIComponent(publicId)}/grant`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(payload), skipAuthRefresh: true });
}
export async function revokeSubscription(accessToken: string, publicId: string, reason: string): Promise<SubscriptionAssignment> {
  return requestApi(`/subscriptions/admin/users/${encodeURIComponent(publicId)}/revoke`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ reason }), skipAuthRefresh: true });
}
export async function getMySubscription(accessToken: string): Promise<SubscriptionSummary> {
  return requestApi('/subscriptions/me', { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, authContext: 'authenticated_request' });
}
export async function listStaffRoles(accessToken: string): Promise<StaffRole[]> {
  return requestApi('/staff/roles', { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, skipAuthRefresh: true });
}
export async function staffLogout(accessToken: string): Promise<void> {
  await requestApi('/staff/logout', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, skipAuthRefresh: true });
}

export type BlockedUser = { id: string; username: string; displayName: string; profilePictureUrl: string | null; blockedAt: string; showProfessionalBadge: boolean };
export type BlockedUserPage = { items: BlockedUser[]; next_cursor: string | null };
type ApiBlockedUserPage = { items: Array<{ id: string; username: string; display_name: string | null; profile_picture_url: string | null; blocked_at: string; show_professional_badge: boolean }>; next_cursor: string | null };

type ApiTokenResponse = {
  access_token: string;
  token_type: string;
  user?: ApiUser;
  account_slot?: string | null;
};

type ApiLoginChallengeResponse = {
  challenge_required: true;
  challenge_token: string;
  message: string;
  lifecycle_status?: 'deactivated' | 'pending_deletion';
};

type AuthErrorCode =
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'TOKEN_MALFORMED'
  | 'TOKEN_SIGNATURE_MISMATCH'
  | 'TOKEN_SCHEMA_INVALID'
  | 'SESSION_NOT_FOUND'
  | 'REFRESH_TOKEN_MISSING'
  | 'REFRESH_TOKEN_INVALID'
  | 'SESSION_REVOKED_SECURITY';

type ApiErrorBody = {
  detail?: string | { message?: string; code?: AuthErrorCode; cooldown_seconds?: number } | Array<{ msg?: string }>;
};

type AuthRequestContext = 'fresh_login' | 'refresh_exchange' | 'authenticated_request';
type AuthFlowOptions = { addAccount?: boolean };

export class AuthApiError extends Error {
  status: number;
  code?: AuthErrorCode;
  displayCode?: string;
  detail: string;
  cooldownSeconds?: number;

  constructor(message: string, status: number, code?: AuthErrorCode, options?: { displayCode?: string; detail?: string; cooldownSeconds?: number }) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.code = code;
    this.displayCode = options?.displayCode ?? code ?? (status > 0 ? `HTTP_${status}` : 'CLIENT_ERROR');
    this.detail = options?.detail ?? message;
    this.cooldownSeconds = options?.cooldownSeconds;
  }
}

export function createDemoSession(overrides: Partial<AuthUser> = {}): AuthSession {
  const demoUser: AuthUser = {
    id: 'demo-user',
    name: 'Demo User',
    email: DEFAULT_DEMO_EMAIL,
    username: 'demouser',
    about: '',
    dateOfBirth: '1990-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    accountRegion: null,
    location: null,
    useIntent: null,
    showProfessionalBadge: false,
    profilePictureUrl: null,
    profilePictureUpdatedAt: null,
    isPrivate: false,
    likesVisible: true,
    isStaff: false,
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

export type SignupInput = {
  name: string;
  email: string;
  username: string;
  password: string;
  dateOfBirth: string;
};

export type SignupStartResponse = {
  accepted: boolean;
  verification_required: boolean;
  reservation_token: string;
  message: string;
  existing_account: boolean;
};

export type ProgressiveStartResponse = {
  accepted: boolean;
  flow_token: string;
  message: string;
};

export type ProgressiveContinueResponse = {
  next_step: 'password' | 'email_verification';
  message: string;
};

export async function startProgressiveLogin(identifier: string): Promise<ProgressiveStartResponse> {
  return requestApi<ProgressiveStartResponse>('/auth/progressive/start', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
    skipAuthRefresh: true,
  });
}

export async function continueProgressiveLogin(flowToken: string): Promise<ProgressiveContinueResponse> {
  return requestApi<ProgressiveContinueResponse>('/auth/progressive/continue', {
    method: 'POST',
    body: JSON.stringify({ flow_token: flowToken }),
    skipAuthRefresh: true,
  });
}

type ApiEmailChangeStartResponse = {
  accepted: boolean;
  verification_required: boolean;
  challenge_token: string | null;
  message: string;
};

export async function startSignupEmail(email: string): Promise<SignupStartResponse> {
  return requestApi<SignupStartResponse>('/auth/signup/email/start', {
    method: 'POST',
    body: JSON.stringify({ email }),
    skipAuthRefresh: true,
  });
}

export async function verifySignupEmail(reservationToken: string, otp: string): Promise<void> {
  await requestApi<{ verified: boolean }>('/auth/signup/email/verify', {
    method: 'POST',
    body: JSON.stringify({ reservation_token: reservationToken, otp }),
    skipAuthRefresh: true,
  });
}

export async function completeSignup(reservationToken: string, input: SignupInput, options: AuthFlowOptions = {}): Promise<AuthSession | LoginChallenge> {
  const response = await requestApi<ApiTokenResponse>('/auth/signup/complete', {
    method: 'POST',
    headers: options.addAccount ? { 'X-Friink-Account-Flow': 'add-account' } : undefined,
    body: JSON.stringify({
      reservation_token: reservationToken,
      email: input.email,
      username: input.username,
      display_name: input.name,
      password: input.password,
      date_of_birth: input.dateOfBirth,
    }),
    skipAuthRefresh: true,
  });

  return mapTokenResponse(response);
}

export async function startSignup(input: SignupInput): Promise<SignupStartResponse> {
  return requestApi<SignupStartResponse>('/auth/signup/start', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      username: input.username,
      display_name: input.name,
      password: input.password,
      date_of_birth: input.dateOfBirth,
    }),
    skipAuthRefresh: true,
  });
}

export async function verifySignup(reservationToken: string, otp: string): Promise<void> {
  await requestApi<ApiUser>('/auth/signup/verify', {
    method: 'POST',
    body: JSON.stringify({ reservation_token: reservationToken, otp }),
    skipAuthRefresh: true,
  });
}

export async function signUp(input: SignupInput, options: AuthFlowOptions = {}): Promise<AuthSession | LoginChallenge> {
  const response = await requestApi<ApiTokenResponse>('/auth/signup', {
    method: 'POST',
    headers: options.addAccount ? { 'X-Friink-Account-Flow': 'add-account' } : undefined,
    body: JSON.stringify({
      email: input.email,
      username: input.username,
      display_name: input.name,
      password: input.password,
      date_of_birth: input.dateOfBirth,
    }),
  });

  return mapTokenResponse(response);
}

export async function checkUsernameAvailability(username: string): Promise<{ username: string; available: boolean }> {
  return requestApi<{ username: string; available: boolean }>(`/auth/username-availability?username=${encodeURIComponent(username)}`, {
    method: 'GET',
    skipAuthRefresh: true,
  });
}

export async function startEmailChange(accessToken: string, email: string, currentPassword: string): Promise<ApiEmailChangeStartResponse> {
  return requestApi<ApiEmailChangeStartResponse>('/auth/me/email/change/start', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
    body: JSON.stringify({ email, current_password: currentPassword }),
  });
}

export async function verifyEmailChange(accessToken: string, challengeToken: string, otp: string): Promise<AuthUser> {
  const response = await requestApi<ApiUser>('/auth/me/email/change/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
    body: JSON.stringify({ challenge_token: challengeToken, otp }),
  });
  return mapApiUser(response);
}

export async function deactivateAccount(accessToken: string, currentPassword: string): Promise<void> {
  await requestApi<void>('/auth/me/deactivate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
    body: JSON.stringify({ current_password: currentPassword }),
  });
}

export async function startAccountDeletion(accessToken: string, currentPassword: string): Promise<{ challenge_required: boolean; challenge_token: string | null; message: string }> {
  return requestApi<{ challenge_required: boolean; challenge_token: string | null; message: string }>('/auth/me/delete/start', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
    body: JSON.stringify({ current_password: currentPassword }),
  });
}

export async function confirmAccountDeletion(accessToken: string, challengeToken: string, otp: string): Promise<void> {
  await requestApi<void>('/auth/me/delete/confirm', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
    body: JSON.stringify({ challenge_token: challengeToken, otp }),
  });
}

export function saveAuthSession(session: AuthSession) {
  if (typeof window === 'undefined') return;
  installAuthCoordinationListener();
  const previousAccountSlot = inMemoryAuthSession?.accountSlot;
  inMemoryAuthSession = session;
  cacheSafeSessionUser(session);
  touchCachedActiveAccount(session);
  window.localStorage.removeItem(AUTH_SESSION_KEY);
  setActiveAccountSlot(session.accountSlot ?? null);
  authBroadcastChannel?.postMessage({ type: 'session-updated', accountSlot: session.accountSlot ?? null });
  if (previousAccountSlot && session.accountSlot && previousAccountSlot !== session.accountSlot) {
    window.dispatchEvent(new CustomEvent('friink-account-switched'));
  }
}

export function loadAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  installAuthCoordinationListener();
  return inMemoryAuthSession;
}

export function loadCachedAuthUser(): AuthUser | null {
  return loadCachedUserForSlot(activeAccountSlot());
}

export function loadPersistedAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  installAuthCoordinationListener();
  return inMemoryAuthSession?.user.email !== DEFAULT_DEMO_EMAIL ? inMemoryAuthSession : null;
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return;
  installAuthCoordinationListener();
  authSessionGeneration += 1;
  const accountSlot = inMemoryAuthSession?.accountSlot ?? activeAccountSlot();
  inMemoryAuthSession = null;
  if (accountSlot) window.localStorage.removeItem(`${AUTH_SESSION_SLOT_PREFIX}${encodeURIComponent(accountSlot)}`);
  window.localStorage.removeItem(AUTH_SESSION_KEY);
  setActiveAccountSlot(null);
  authBroadcastChannel?.postMessage({ type: 'session-cleared', accountSlot: accountSlot ?? null });
}

function preserveFailedAuthContext(error: unknown) {
  if (typeof window === 'undefined') return;
  const accountSlot = inMemoryAuthSession?.accountSlot ?? activeAccountSlot();
  authSessionGeneration += 1;
  inMemoryAuthSession = null;
  window.localStorage.removeItem(AUTH_SESSION_KEY);
  // Keep the selected slot and safe cached profile metadata for recovery UI;
  // no credential is retained after terminal refresh failure.
  const status = error instanceof AuthApiError && error.code === 'SESSION_REVOKED_SECURITY' ? 'security' : 'expired';
  authBroadcastChannel?.postMessage({ type: 'session-expired', accountSlot: accountSlot ?? null, status });
  window.dispatchEvent(new CustomEvent('friink-session-expired', { detail: { accountSlot, status } }));
}

export function clearAuthSessionForRecovery(error: unknown) {
  preserveFailedAuthContext(error);
}

export function setDeactivationFallbackSlot(accountSlot: string | null) {
  setDeactivationFallbackSlots(accountSlot ? [accountSlot] : []);
}

export function setDeactivationFallbackSlots(accountSlots: string[]) {
  if (typeof window === 'undefined') return;
  try {
    if (accountSlots.length > 0) window.sessionStorage.setItem(DEACTIVATION_FALLBACK_SLOT_KEY, JSON.stringify(accountSlots));
    else window.sessionStorage.removeItem(DEACTIVATION_FALLBACK_SLOT_KEY);
  } catch {
    // Storage may be unavailable; the deactivation flow still falls back to
    // the public site when no recoverable slot can be retained.
  }
}

export function getDeactivationFallbackSlot(): string | null {
  return getDeactivationFallbackSlots()[0] ?? null;
}

export function getDeactivationFallbackSlots(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = window.sessionStorage.getItem(DEACTIVATION_FALLBACK_SLOT_KEY);
    if (!value) return [];
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
    } catch {
      return [value];
    }
    return [];
  } catch {
    return [];
  }
}

export function clearDeactivationFallbackSlot() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(DEACTIVATION_FALLBACK_SLOT_KEY);
  } catch {
    // Ignore unavailable session storage.
  }
}

export async function restoreAccountSession(accountSlot: string): Promise<AuthSession> {
  try {
    const user = await getCurrentUser('', accountSlot, true);
    return { accessToken: '', tokenType: 'Bearer', user, accountSlot };
  } catch (error) {
    if (!(error instanceof AuthApiError) || error.status !== 401 || !['TOKEN_EXPIRED', 'REFRESH_TOKEN_MISSING'].includes(error.code ?? '')) {
      throw error;
    }
    return coordinateRefresh(accountSlot, false, true);
  }
}

export async function logout(accessToken: string, accountSlot?: string): Promise<void> {
  await requestApi<void>('/auth/logout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(accountSlot ? { 'X-Friink-Account-Slot': accountSlot } : {}),
    },
    skipAuthRefresh: true,
  });
}

export async function login(identifier: string, password: string, options: AuthFlowOptions = {}): Promise<AuthSession | LoginChallenge> {
  const response = await requestApi<ApiTokenResponse | ApiLoginChallengeResponse>('/auth/login', {
    method: 'POST',
    headers: options.addAccount ? { 'X-Friink-Account-Flow': 'add-account' } : undefined,
    body: JSON.stringify({ identifier, password }),
  });

  if ('challenge_required' in response && response.challenge_required) {
    return {
      challengeRequired: true,
      challengeToken: response.challenge_token,
      message: response.message,
      lifecycleStatus: response.lifecycle_status,
    };
  }
  return mapTokenResponse(response as ApiTokenResponse);
}

export async function consumeLoginLink(token: string): Promise<AuthSession> {
  const response = await requestApi<ApiTokenResponse>('/auth/login/link/consume', {
    method: 'POST',
    body: JSON.stringify({ token }),
    skipAuthRefresh: true,
  });
  return mapTokenResponse(response);
}

export async function verifyLoginChallenge(challengeToken: string, otp: string, options: AuthFlowOptions = {}): Promise<AuthSession> {
  const response = await requestApi<ApiTokenResponse>('/auth/login/verify', {
    method: 'POST',
    headers: options.addAccount ? { 'X-Friink-Account-Flow': 'add-account' } : undefined,
    body: JSON.stringify({ challenge_token: challengeToken, otp }),
    skipAuthRefresh: true,
  });
  return mapTokenResponse(response);
}

export function isLoginChallenge(value: AuthSession | LoginChallenge): value is LoginChallenge {
  return 'challengeRequired' in value && value.challengeRequired === true;
}

export async function refreshAuthSession(accountSlot: string | null = activeAccountSlot()): Promise<AuthSession> {
  const key = accountSlot ?? 'unassigned';
  const existing = refreshPromises.get(key);
  if (existing) return existing;

  installAuthCoordinationListener();
  const refreshPromise = coordinateRefresh(accountSlot, true, true)
    .catch((error) => {
      if (!isTerminalRefreshFailure(error)) throw error;
      preserveFailedAuthContext(error);
      throw error;
    })
    .finally(() => {
      refreshPromises.delete(key);
    });
  refreshPromises.set(key, refreshPromise);

  return refreshPromise;
}

/** Restore the in-memory session required by any authenticated route entry. */
export async function restoreAuthSessionForEntry(): Promise<AuthSession> {
  const currentSession = loadAuthSession();
  if (currentSession) return currentSession;
  const accountSlot = activeAccountSlot();
  try {
    const user = await getCurrentUser('', accountSlot ?? undefined, true);
    const restoredSession = { accessToken: '', tokenType: 'Bearer' as const, user, accountSlot: accountSlot ?? undefined };
    saveAuthSession(restoredSession);
    return restoredSession;
  } catch (error) {
    const refreshedSession = loadAuthSession();
    if (refreshedSession && refreshedSession.accountSlot === accountSlot) return refreshedSession;
    if (!isTerminalRefreshFailure(error)) throw error;

    let terminalFailure = error;
    if (error instanceof AuthApiError && ['TOKEN_EXPIRED', 'REFRESH_TOKEN_MISSING'].includes(error.code ?? '')) {
      try {
        const restoredSession = await coordinateRefresh(accountSlot, true, true);
        saveAuthSession(restoredSession);
        return restoredSession;
      } catch (refreshError) {
        if (!isTerminalRefreshFailure(refreshError)) throw refreshError;
        terminalFailure = refreshError;
      }
    }

    const fallback = await restoreRememberedAccountWithFallback(accountSlot ? [accountSlot] : []);
    if (fallback) {
      saveAuthSession(fallback);
      return fallback;
    }
    throw terminalFailure;
  }
}

export async function restoreRememberedAccountWithFallback(
  excludedSlots: string[] = [],
  preferredSlot?: string,
): Promise<AuthSession | null> {
  const excluded = new Set(excludedSlots);
  const accounts = getRememberedAccountSummaries()
    .filter((account) => !excluded.has(account.accountSlot))
    .sort((a, b) => {
      if (a.accountSlot === preferredSlot) return -1;
      if (b.accountSlot === preferredSlot) return 1;
      return b.lastUsedAt.localeCompare(a.lastUsedAt);
    });

  for (const account of accounts) {
    try {
      return await restoreAccountSession(account.accountSlot);
    } catch (error) {
      if (!isTerminalRefreshFailure(error)) throw error;
    }
  }
  return null;
}

export async function hasSessionForEntry(): Promise<boolean> {
  const slot = activeAccountSlot();
  const response = await requestApi<{ session_available: boolean }>('/auth/entry-status', {
    method: 'GET',
    headers: slot ? { 'X-Friink-Account-Slot': slot } : undefined,
    skipAuthRefresh: true,
  });
  return response.session_available;
}

type RefreshCoordinationState = {
  operationId: string;
  ownerId: string;
  status: 'refreshing' | 'succeeded' | 'failed';
  expiresAt: number;
  error?: { message: string; status: number; code?: AuthErrorCode };
};

type CachedAccountSummary = Pick<AccountSummary, 'accountSlot' | 'username' | 'displayName' | 'profilePictureUrl' | 'lastUsedAt' | 'showProfessionalBadge'>;

function activeAccountSlot(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(ACCOUNT_SLOT_SESSION_KEY) || window.localStorage.getItem(ACCOUNT_SLOT_KEY);
  } catch {
    return window.localStorage.getItem(ACCOUNT_SLOT_KEY);
  }
}

function setActiveAccountSlot(accountSlot: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (accountSlot) window.sessionStorage.setItem(ACCOUNT_SLOT_SESSION_KEY, accountSlot);
    else window.sessionStorage.removeItem(ACCOUNT_SLOT_SESSION_KEY);
  } catch {
    // Continue with the in-memory session when session storage is unavailable.
  }
  if (accountSlot) window.localStorage.setItem(ACCOUNT_SLOT_KEY, accountSlot);
  else window.localStorage.removeItem(ACCOUNT_SLOT_KEY);
}

function authSessionCacheKey(session: Pick<AuthSession, 'accountSlot' | 'user'>): string {
  return session.accountSlot
    ? `${AUTH_SESSION_SLOT_PREFIX}${encodeURIComponent(session.accountSlot)}`
    : `${AUTH_SESSION_USER_PREFIX}${encodeURIComponent(session.user.id)}`;
}

function cacheSafeSessionUser(session: AuthSession) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(authSessionCacheKey(session), JSON.stringify({ user: session.user }));
}

function loadCachedUserForSlot(accountSlot: string | null): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const key = accountSlot
    ? `${AUTH_SESSION_SLOT_PREFIX}${encodeURIComponent(accountSlot)}`
    : null;
  try {
    const raw = key ? window.localStorage.getItem(key) : null;
    const legacy = raw || window.localStorage.getItem(AUTH_SESSION_KEY);
    if (!legacy) return null;
    const parsed = JSON.parse(legacy) as { user?: Partial<AuthUser> };
    const user = parsed.user;
    if (!user || typeof user.id !== 'string' || typeof user.name !== 'string' || typeof user.email !== 'string' || typeof user.username !== 'string') return null;
    return user as AuthUser;
  } catch {
    return null;
  }
}

function cacheAccountSummaries(accounts: AccountSummary[]) {
  if (typeof window === 'undefined') return;
  try {
    const cached: Record<string, CachedAccountSummary> = {};
    for (const account of accounts) {
      if (!account.accountSlot) continue;
      cached[account.accountSlot] = {
        accountSlot: account.accountSlot,
        username: account.username,
        displayName: account.displayName,
        profilePictureUrl: account.profilePictureUrl,
        lastUsedAt: account.lastUsedAt,
        showProfessionalBadge: account.showProfessionalBadge,
      };
    }
    window.localStorage.setItem(ACCOUNT_SUMMARIES_KEY, JSON.stringify(cached));
  } catch {
    // The server remains authoritative when browser storage is unavailable.
  }
}

export function getRememberedAccountSummaries(): AccountSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ACCOUNT_SUMMARIES_KEY) || '{}') as Record<string, CachedAccountSummary>;
    return Object.values(parsed)
      .filter((account) => typeof account.accountSlot === 'string' && account.accountSlot.length > 0 && typeof account.username === 'string')
      .map((account) => ({ ...account, active: account.accountSlot === activeAccountSlot(), available: true }))
      .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
  } catch {
    return [];
  }
}

export function getMostRecentRememberedAccount(): AccountSummary | null {
  return getRememberedAccountSummaries().sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))[0] ?? null;
}

export function getLoginRecoveryPath(reason: 'expired' | 'security-revocation' = 'expired'): string {
  const params = new URLSearchParams({ reason });
  const recent = reason === 'expired' ? getMostRecentRememberedAccount() : null;
  if (recent?.username) params.set('account', recent.username);
  return `/login?${params.toString()}`;
}

function scopedRefreshKey(prefix: string, slot: string | null = activeAccountSlot()): string {
  const scope = slot || (inMemoryAuthSession ? `user:${inMemoryAuthSession.user.id}` : 'unassigned');
  return `${prefix}:${encodeURIComponent(scope)}`;
}

function installAuthCoordinationListener() {
  if (typeof window === 'undefined' || coordinationListenerInstalled) return;
  coordinationListenerInstalled = true;
  if (typeof BroadcastChannel !== 'undefined') {
    authBroadcastChannel = new BroadcastChannel('friink-auth-session');
    authBroadcastChannel.addEventListener('message', (event: MessageEvent) => {
      const message = event.data as { type?: string; accountSlot?: string | null; status?: 'expired' | 'security' } | null;
      if (message?.accountSlot !== (activeAccountSlot() ?? null)) return;
      if (message?.type === 'session-cleared') {
        authSessionGeneration += 1;
        inMemoryAuthSession = null;
      } else if (message?.type === 'session-expired') {
        authSessionGeneration += 1;
        inMemoryAuthSession = null;
        window.dispatchEvent(new CustomEvent('friink-session-expired', { detail: { accountSlot: message.accountSlot ?? null, status: message.status ?? 'expired' } }));
      } else if (message?.type === 'session-updated') {
        inMemoryAuthSession = null;
        window.dispatchEvent(new CustomEvent('friink-session-updated', { detail: { accountSlot: message.accountSlot ?? null } }));
      }
    });
  }
  window.addEventListener('storage', (event) => {
    const accountSlot = activeAccountSlot();
    if ((accountSlot && event.key === `${AUTH_SESSION_SLOT_PREFIX}${encodeURIComponent(accountSlot)}` && event.newValue === null) || (!accountSlot && event.key === AUTH_SESSION_KEY && event.newValue === null)) {
      authSessionGeneration += 1;
      inMemoryAuthSession = null;
    }
  });
}

function readRefreshCoordination(slot: string | null): RefreshCoordinationState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(scopedRefreshKey(REFRESH_COORDINATION_KEY, slot));
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as RefreshCoordinationState;
    if (!state.operationId || !state.ownerId || !state.status || typeof state.expiresAt !== 'number') return null;
    return state;
  } catch {
    return null;
  }
}

function publishRefreshCoordination(state: RefreshCoordinationState, slot: string | null) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(scopedRefreshKey(REFRESH_COORDINATION_KEY, slot), JSON.stringify(state));
}

function touchCachedActiveAccount(session: AuthSession) {
  if (typeof window === 'undefined' || !session.accountSlot) return;
  try {
    const cached = JSON.parse(window.localStorage.getItem(ACCOUNT_SUMMARIES_KEY) || '{}') as Record<string, CachedAccountSummary>;
    cached[session.accountSlot] = {
      accountSlot: session.accountSlot,
      username: session.user.username,
      displayName: session.user.name,
      profilePictureUrl: session.user.profilePictureUrl,
      lastUsedAt: new Date().toISOString(),
      showProfessionalBadge: session.user.showProfessionalBadge,
    };
    window.localStorage.setItem(ACCOUNT_SUMMARIES_KEY, JSON.stringify(cached));
  } catch {
    // Server-side slot timestamps remain authoritative if browser storage is unavailable.
  }
}

async function coordinateRefresh(slot: string | null = activeAccountSlot(), persist = true, retryFailed = false): Promise<AuthSession> {
  if (supportsCrossTabLock()) {
    const lockManager = (navigator as Navigator & { locks: { request<T>(name: string, options: { mode: 'exclusive' }, callback: () => Promise<T>): Promise<T> } }).locks;
    return lockManager.request(scopedRefreshKey(REFRESH_LOCK_NAME, slot), { mode: 'exclusive' }, () => coordinateRefreshWithStorageLease(slot, persist, retryFailed));
  }
  return coordinateRefreshWithStorageLease(slot, persist, retryFailed);
}

function supportsCrossTabLock() {
  return typeof navigator !== 'undefined' && 'locks' in navigator;
}

async function coordinateRefreshWithStorageLease(slot: string | null, persist: boolean, retryFailed: boolean): Promise<AuthSession> {
  const generation = authSessionGeneration;

  while (true) {
    const existing = readRefreshCoordination(slot);
    if (existing && existing.expiresAt > Date.now()) {
      if (existing.status === 'succeeded') {
        const sharedSession = loadPersistedAuthSession();
        if (sharedSession?.accountSlot === slot) return sharedSession;
        // Access credentials never cross tabs. Rehydrate the just-refreshed
        // slot through its HttpOnly cookie so a waiting tab does not replay
        // the same refresh cookie and rotate the family again.
        const user = await getCurrentUser('', slot ?? undefined, true);
        const restoredSession: AuthSession = {
          accessToken: '',
          tokenType: 'Bearer',
          user,
          accountSlot: slot ?? undefined,
        };
        if (persist) {
          if (activeAccountSlot() !== slot) {
            throw new AuthApiError('The active account changed while it was restoring.', 0);
          }
          saveAuthSession(restoredSession);
        }
        return restoredSession;
      } else if (existing.status === 'failed' && !retryFailed) {
        throw refreshErrorFromState(existing);
      } else if (existing.ownerId !== tabId) {
        await waitForRefreshCoordination(existing.operationId, slot);
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
    publishRefreshCoordination(started, slot);
    const winner = readRefreshCoordination(slot);
    if (!winner || winner.operationId !== operationId || winner.ownerId !== tabId) {
      continue;
    }

    try {
      const session = await performRefresh(generation, operationId, slot, persist);
      publishRefreshCoordination({
        ...started,
        status: 'succeeded',
        expiresAt: Date.now() + REFRESH_RESULT_TTL_MS,
      }, slot);
      return session;
    } catch (error) {
      const refreshError = error instanceof AuthApiError ? error : new AuthApiError(error instanceof Error ? error.message : 'Refresh failed.', 0);
      publishRefreshCoordination({
        ...started,
        status: 'failed',
        expiresAt: Date.now() + REFRESH_RESULT_TTL_MS,
        error: { message: refreshError.message, status: refreshError.status, code: refreshError.code },
      }, slot);
      throw refreshError;
    }
  }
}

async function performRefresh(generation: number, operationId: string, slot: string | null, persist: boolean): Promise<AuthSession> {
  const loadedSession = loadPersistedAuthSession();
  const currentSession = loadedSession?.accountSlot === slot ? loadedSession : null;
  const response = await requestApi<{ access_token: string; token_type: string; account_slot?: string }>('/auth/refresh', {
    method: 'POST',
    headers: slot ? { 'X-Friink-Account-Slot': slot } : undefined,
    authContext: 'refresh_exchange',
    skipAuthRefresh: true,
  });

  if (persist && generation !== authSessionGeneration) {
    throw new AuthApiError('The session was cleared while it was refreshing.', 0);
  }

  // A different tab may have switched accounts while this refresh was in
  // flight. Do not let the stale tab commit its old slot back into shared
  // localStorage/BroadcastChannel state.
  const latestSlot = activeAccountSlot();
  if (persist && latestSlot !== slot) {
    throw new AuthApiError('The active account changed while the session was refreshing.', 0);
  }
  if (slot && response.account_slot !== slot) {
    throw new AuthApiError('The API returned a different account slot while refreshing.', 0);
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
      accountSlot: response.account_slot ?? undefined,
    };
    if (persist) {
      saveAuthSession(nextSession);
    }
    return nextSession;
  }

  const restoredUser = await requestApi<ApiUser>('/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${response.access_token}`,
      ...(slot ? { 'X-Friink-Account-Slot': slot } : {}),
    },
    authContext: 'authenticated_request',
    skipAuthRefresh: true,
  });
  if ((persist && generation !== authSessionGeneration) || (persist && loadPersistedAuthSession())) {
    throw new AuthApiError('The session changed while it was refreshing.', 0);
  }
  const restoredSession: AuthSession = {
      accessToken: response.access_token,
      tokenType: 'Bearer',
      accountSlot: response.account_slot ?? undefined,
      user: mapApiUser(restoredUser),
  };
  if (persist) {
    saveAuthSession(restoredSession);
  }
  return restoredSession;
}

function waitForRefreshCoordination(operationId: string, slot: string | null): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      window.removeEventListener('storage', onStorage);
      window.clearInterval(pollId);
      resolve();
    };
    const check = () => {
      const state = readRefreshCoordination(slot);
      if (!state || state.operationId !== operationId || state.status !== 'refreshing' || state.expiresAt <= Date.now()) finish();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === scopedRefreshKey(REFRESH_COORDINATION_KEY, slot)) check();
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
  input: { username?: string; email?: string; displayName?: string; about?: string; location?: string; useIntent?: 'professional' | 'personal' | null; showProfessionalBadge?: boolean; dateOfBirth?: string; isPrivate?: boolean; likesVisible?: boolean },
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
      location: input.location,
      use_intent: input.useIntent,
      show_professional_badge: input.showProfessionalBadge,
      date_of_birth: input.dateOfBirth,
      is_private: input.isPrivate,
      likes_visible: input.likesVisible,
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

export async function listAccounts(accessToken: string): Promise<AccountSummary[]> {
  const activeSlot = activeAccountSlot();
  const response = await requestApi<Array<{ account_slot: string; username: string; display_name: string | null; profile_picture_url: string | null; active: boolean; available: boolean; last_used_at: string; show_professional_badge: boolean }>>('/auth/accounts', { method: 'GET', headers: { Authorization: `Bearer ${accessToken}`, ...(activeSlot ? { 'X-Friink-Account-Slot': activeSlot } : {}) }, authContext: 'authenticated_request' });
  const accounts = response.map((item) => ({ accountSlot: item.account_slot, username: item.username, displayName: item.display_name, profilePictureUrl: item.profile_picture_url, active: item.active, available: item.available, lastUsedAt: item.last_used_at, showProfessionalBadge: item.show_professional_badge ?? false }));
  cacheAccountSummaries(accounts);
  const currentUser = loadPersistedAuthSession()?.user;
  const currentAccount = currentUser
    ? accounts.find((account) => account.username.trim().toLowerCase() === currentUser.username.trim().toLowerCase())
    : undefined;
  if (currentAccount && typeof window !== 'undefined') {
    setActiveAccountSlot(currentAccount.accountSlot);
    return accounts.map((account) => ({ ...account, active: account.accountSlot === currentAccount.accountSlot }));
  }
  if (currentUser) {
    // A normal login may be valid without a remembered account slot when the
    // device is already at its slot cap. Keep that active account visible in
    // the switcher without inventing a switchable slot for it.
    return [{
      accountSlot: '',
      username: currentUser.username,
      displayName: currentUser.name,
      profilePictureUrl: currentUser.profilePictureUrl,
      active: true,
      available: true,
      showProfessionalBadge: currentUser.showProfessionalBadge,
      lastUsedAt: '',
    }, ...accounts.map((account) => ({ ...account, active: false }))];
  }
  return accounts;
}

export async function canAddAccount(accessToken: string): Promise<boolean> {
  const activeSlot = activeAccountSlot();
  const response = await requestApi<{ allowed: boolean }>('/auth/accounts/add-availability', { method: 'GET', headers: { Authorization: `Bearer ${accessToken}`, ...(activeSlot ? { 'X-Friink-Account-Slot': activeSlot } : {}) }, authContext: 'authenticated_request' });
  return response.allowed;
}

export async function switchAccount(accessToken: string, accountSlot: string): Promise<AuthSession> {
  const response = await requestApi<ApiTokenResponse>('/auth/accounts/switch', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'X-Friink-Account-Slot': accountSlot }, authContext: 'authenticated_request', body: JSON.stringify({ account_slot: accountSlot }) });
  return mapTokenResponse(response);
}

export async function removeAccount(accessToken: string, accountSlot: string): Promise<void> {
  await requestApi<void>(`/auth/accounts/${encodeURIComponent(accountSlot)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}`, 'X-Friink-Account-Slot': accountSlot }, authContext: 'authenticated_request' });
}

export async function listPendingLoginApprovals(accessToken: string): Promise<PendingLoginApproval[]> {
  const response = await requestApi<Array<{ challenge_id: string; device_label: string; browser: string | null; created_at: string; expires_at: string }>>('/auth/login/pending', { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, authContext: 'authenticated_request' });
  return response.map((item) => ({ challengeId: item.challenge_id, deviceLabel: item.device_label, browser: item.browser, createdAt: item.created_at, expiresAt: item.expires_at }));
}

export async function respondToLoginApproval(accessToken: string, challengeId: string, decision: 'approve' | 'deny'): Promise<void> {
  await requestApi<void>(`/auth/login/${decision}`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, authContext: 'authenticated_request', body: JSON.stringify({ challenge_id: challengeId }) });
}

export async function getLoginApprovalStatus(challengeToken: string): Promise<'pending' | 'approved' | 'otp_verified' | 'denied' | 'expired'> {
  const response = await requestApi<{ status: 'pending' | 'approved' | 'otp_verified' | 'denied' | 'expired' }>(`/auth/login/status/${encodeURIComponent(challengeToken)}`, { method: 'GET', skipAuthRefresh: true });
  return response.status;
}

export async function completeApprovedLogin(challengeToken: string, options: AuthFlowOptions = {}): Promise<AuthSession> {
  const response = await requestApi<ApiTokenResponse>('/auth/login/complete-approved', { method: 'POST', headers: options.addAccount ? { 'X-Friink-Account-Flow': 'add-account' } : undefined, body: JSON.stringify({ challenge_token: challengeToken, otp: '000000' }), skipAuthRefresh: true });
  return mapTokenResponse(response);
}

export async function getCurrentUser(accessToken: string, accountSlot?: string, skipAuthRefresh = false): Promise<AuthUser> {
  const response = await requestApi<ApiUser>('/auth/me', {
    method: 'GET',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(accountSlot ? { 'X-Friink-Account-Slot': accountSlot } : {}),
    },
    authContext: 'authenticated_request',
    skipAuthRefresh,
  });

  return mapApiUser(response);
}

export async function updateProfileSetup(accessToken: string, input: { step: 1 | 2 | 3; completed?: boolean }): Promise<AuthUser> {
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

export async function getPublicUser(username: string, accessToken?: string): Promise<Pick<AuthUser, 'id' | 'name' | 'username' | 'about' | 'isPrivate' | 'likesVisible' | 'showProfessionalBadge' | 'profilePictureUrl' | 'profilePictureUpdatedAt'>> {
  const response = await requestApi<ApiPublicUser>(`/auth/users/${encodeURIComponent(username)}`, {
    method: 'GET',
    ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` }, authContext: 'authenticated_request' as const } : {}),
  });

  return {
    id: response.id,
    name: response.display_name || response.username,
    username: response.username,
    about: response.about ?? '',
    isPrivate: response.is_private,
    likesVisible: response.likes_visible,
    showProfessionalBadge: response.show_professional_badge ?? false,
    profilePictureUrl: response.profile_picture_url,
    profilePictureUpdatedAt: response.profile_picture_updated_at,
  };
}

export async function blockUser(accessToken: string, username: string): Promise<void> {
  await requestApi(`/users/${encodeURIComponent(username)}/block`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, authContext: 'authenticated_request' });
}

export async function unblockUser(accessToken: string, username: string): Promise<void> {
  await requestApi(`/users/${encodeURIComponent(username)}/block`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` }, authContext: 'authenticated_request' });
}

export async function listBlockedUsers(accessToken: string, query = '', cursor?: string | null): Promise<BlockedUserPage> {
  const params = new URLSearchParams({ query, limit: '24' });
  if (cursor) params.set('cursor', cursor);
  const response = await requestApi<ApiBlockedUserPage>(`/users/blocked?${params.toString()}`, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, authContext: 'authenticated_request' });
  return { items: response.items.map((item) => ({ id: item.id, username: item.username, displayName: item.display_name || item.username, profilePictureUrl: item.profile_picture_url, blockedAt: item.blocked_at, showProfessionalBadge: item.show_professional_badge ?? false })), next_cursor: response.next_cursor };
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
  like_count: number;
  saved_count: number;
  liked: boolean | null;
  saved: boolean | null;
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
    show_professional_badge: boolean;
  } | null;
  created_at: string;
  updated_at: string;
  show_professional_badge: boolean;
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

export type ApiReaction = {
  post_id: string;
  like_count: number;
  saved_count: number;
  liked: boolean;
  saved: boolean;
};

export type LikeActor = {
  id: string;
  username: string;
  displayName: string;
  profilePictureUrl: string | null;
  showProfessionalBadge: boolean;
};

export type LikeActorPage = {
  items: LikeActor[];
  next_cursor: string | null;
  has_more: boolean;
};

function authenticatedRequest<T>(accessToken: string, path: string, method = 'GET'): Promise<T> {
  return requestApi<T>(path, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}

export async function setPostLike(accessToken: string, postId: string, liked: boolean): Promise<ApiReaction> {
  return authenticatedRequest<ApiReaction>(accessToken, `/posts/${encodeURIComponent(postId)}/like`, liked ? 'POST' : 'DELETE');
}

export async function setPostSave(accessToken: string, postId: string, saved: boolean): Promise<ApiReaction> {
  return authenticatedRequest<ApiReaction>(accessToken, `/posts/${encodeURIComponent(postId)}/save`, saved ? 'POST' : 'DELETE');
}

export async function deletePost(accessToken: string, postId: string): Promise<void> {
  await authenticatedRequest<void>(accessToken, `/posts/${encodeURIComponent(postId)}`, 'DELETE');
}

export async function listPostLikes(accessToken: string, postId: string, input: { query?: string; cursor?: string | null; limit?: number } = {}): Promise<LikeActorPage> {
  const params = new URLSearchParams({ query: input.query ?? '', limit: String(input.limit ?? 24) });
  if (input.cursor) params.set('cursor', input.cursor);
  const response = await authenticatedRequest<{ items: Array<{ id: string; username: string; display_name: string | null; profile_picture_url: string | null; show_professional_badge: boolean }>; next_cursor: string | null; has_more: boolean }>(accessToken, `/posts/${encodeURIComponent(postId)}/likes?${params.toString()}`);
  return {
    items: response.items.map((item) => ({ id: item.id, username: item.username, displayName: item.display_name || item.username, profilePictureUrl: item.profile_picture_url, showProfessionalBadge: item.show_professional_badge ?? false })),
    next_cursor: response.next_cursor,
    has_more: response.has_more,
  };
}

export async function listLikedPosts(accessToken: string, username: string, cursor?: string | null): Promise<ApiFeedPage> {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);
  return authenticatedRequest<ApiFeedPage>(accessToken, `/users/${encodeURIComponent(username)}/likes?${params.toString()}`);
}

export async function listUserPosts(accessToken: string, username: string, cursor?: string | null): Promise<ApiFeedPage> {
  const params = new URLSearchParams({ limit: '100' });
  if (cursor) params.set('cursor', cursor);
  return authenticatedRequest<ApiFeedPage>(accessToken, `/users/${encodeURIComponent(username)}/posts?${params.toString()}`);
}

export async function listUserReplies(accessToken: string, username: string, cursor?: string | null): Promise<ApiFeedPage> {
  const params = new URLSearchParams({ limit: '100' });
  if (cursor) params.set('cursor', cursor);
  return authenticatedRequest<ApiFeedPage>(accessToken, `/users/${encodeURIComponent(username)}/replies?${params.toString()}`);
}

export async function listSavedPosts(accessToken: string, cursor?: string | null): Promise<ApiFeedPage> {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);
  return authenticatedRequest<ApiFeedPage>(accessToken, `/posts/saved?${params.toString()}`);
}

export type ApiProfileSaveStatus = { username: string; saved: boolean };
export type ApiSavedProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  profile_picture_url: string | null;
  show_professional_badge: boolean;
  available: boolean;
};
export type ApiSavedProfilePage = { items: ApiSavedProfile[]; next_cursor: string | null; has_more: boolean };

export async function getProfileSaveStatus(accessToken: string, username: string): Promise<ApiProfileSaveStatus> {
  return authenticatedRequest<ApiProfileSaveStatus>(accessToken, `/users/${encodeURIComponent(username)}/save`);
}

export async function setProfileSave(accessToken: string, username: string, saved: boolean): Promise<ApiProfileSaveStatus> {
  return authenticatedRequest<ApiProfileSaveStatus>(accessToken, `/users/${encodeURIComponent(username)}/save`, saved ? 'POST' : 'DELETE');
}

export async function listSavedProfiles(accessToken: string, cursor?: string | null): Promise<ApiSavedProfilePage> {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);
  return authenticatedRequest<ApiSavedProfilePage>(accessToken, `/users/saved?${params.toString()}`);
}

export async function removeSavedProfile(accessToken: string, profileId: string): Promise<void> {
  await authenticatedRequest<void>(accessToken, `/users/saved/${encodeURIComponent(profileId)}`, 'DELETE');
}

export type ApiConnectionUser = {
  id: string;
  username: string;
  is_private: boolean;
  show_professional_badge: boolean;
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
  show_professional_badge: boolean;
};

export type ApiConversation = {
  id: string;
  conversation_type?: 'direct' | 'group';
  participant: ApiChatUser;
  participants?: ApiChatUser[];
  preview: string | null;
  preview_sender_id: string | null;
  preview_receipt_status: 'sent' | 'delivered' | 'read' | null;
  updated_at: string;
  unread: boolean;
  status: 'pending' | 'accepted' | 'blocked' | string;
  requester_id: string | null;
  muted: boolean;
  archived: boolean;
  can_send: boolean;
  composer_placeholder: string;
  requester_message_count: number;
  unread_count: number;
};

export type ApiChatContext = {
  conversation: ApiConversation | null;
  participant: {
    id: string;
    username: string;
    display_name: string | null;
    profile_picture_url: string | null;
    show_professional_badge: boolean;
  };
  can_send: boolean;
  composer_placeholder: string;
  status: string;
  requester_message_count: number;
  unread_count: number;
  last_read_message_id: string | null;
};

export type ApiChatPerson = ApiChatContext['participant'];

export type ApiChatEligibility = {
  can_send: boolean;
  status: string;
};

export type ApiMessage = {
  id: string;
  conversation_id: string;
  client_message_id?: string;
  sender_id: string;
  content: string;
  created_at: string;
  receipt_status?: 'sent' | 'delivered' | 'read';
  media: { url: string }[];
};

export const CHAT_MESSAGE_MAX_LENGTH = 2048;

export type ApiMessagePage = {
  items: ApiMessage[];
  next_cursor: string | null;
  has_more: boolean;
  unread_count: number;
  first_unread_message_id: string | null;
  peer_delivered_message_id: string | null;
  peer_read_message_id: string | null;
  last_read_message_id: string | null;
};

export type ApiNotification = {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  type: 'follow_sent_public' | 'new_follower' | 'request_sent' | 'request_received' | 'unfollow_confirmed' | 'request_accepted' | 'mention' | 'like' | 'chat_request_received' | 'chat_message' | 'chat_request_accepted' | 'login_security' | 'professional_registration_submitted' | 'professional_registration_approved' | 'professional_registration_rejected' | 'professional_registration_revoked' | 'subscription_access_granted' | 'subscription_access_changed' | 'subscription_access_revoked';
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
  actor_show_professional_badge: boolean;
};

export type ApiNotificationPage = {
  items: ApiNotification[];
  next_cursor: string | null;
  has_more: boolean;
};

export type ApiSearchResult = {
  id: string;
  type: 'person' | 'post' | 'conversation';
  name: string;
  username: string | null;
  profile_picture_url: string | null;
  summary: string;
  href: string | null;
  created_at: string | null;
};

export async function searchContent(accessToken: string, query: string, scope: 'global' | 'messages' = 'global', limit = 24, kind: 'all' | 'person' | 'post' = 'all', options: { sort?: 'relevance' | 'newest' | 'oldest'; date?: 'any' | 'day' | 'week' | 'month' | 'custom'; dateFrom?: string; dateTo?: string } = {}): Promise<{ items: ApiSearchResult[]; has_more: boolean }> {
  const params = new URLSearchParams({ query, scope, kind, limit: String(limit), sort: options.sort ?? 'relevance', date: options.date ?? 'any' });
  if (options.dateFrom) params.set('date_from', options.dateFrom);
  if (options.dateTo) params.set('date_to', options.dateTo);
  return requestApi(`/search?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}

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
type ChatMediaConfirmation = { object_key: string; public_url: string | null };

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

async function uploadChatMedia(accessToken: string, files: File[]): Promise<string[]> {
  const uploadedKeys: string[] = [];
  try {
    for (const file of files) {
      const compressedFile = await compressImage(file, 'postMedia');
      const uploadUrls = await requestApi<PostMediaUploadUrls>('/chat/media/upload-url', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        authContext: 'authenticated_request',
        body: JSON.stringify({ count: 1 }),
      });
      const item = uploadUrls.items[0];
      if (uploadUrls.items.length !== 1 || !item) throw new AuthApiError('The server returned an invalid chat-media upload plan.', 502);
      uploadedKeys.push(item.object_key);
      await uploadPresignedMedia(item, compressedFile);
      await requestApi<ChatMediaConfirmation>('/chat/media/confirm', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        authContext: 'authenticated_request',
        body: JSON.stringify({ object_key: item.object_key }),
      });
    }
    return uploadedKeys;
  } catch (error) {
    if (uploadedKeys.length) {
      await requestApi<void>('/chat/media/cleanup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        authContext: 'authenticated_request',
        body: JSON.stringify({ storage_keys: uploadedKeys }),
      }).catch(() => undefined);
    }
    throw error;
  }
}

async function sendChatMessage(accessToken: string, path: string, content: string, clientMessageId: string, media: File[] = []): Promise<ApiMessage> {
  const mediaKeys = media.length ? await uploadChatMedia(accessToken, media) : [];
  try {
    return await requestApi<ApiMessage>(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      authContext: 'authenticated_request',
      body: JSON.stringify({ content, client_message_id: clientMessageId, media: mediaKeys.map((storageKey) => ({ storage_key: storageKey })) }),
    });
  } catch (error) {
    if (mediaKeys.length) {
      await requestApi<void>('/chat/media/cleanup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        authContext: 'authenticated_request',
        body: JSON.stringify({ storage_keys: mediaKeys }),
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
  const context = await requestApi<ApiChatContext>(`/chat/conversations/with/${encodeURIComponent(username)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
  if (!context.conversation) throw new AuthApiError(context.composer_placeholder, 403);
  return context.conversation;
}

export async function getChatContext(accessToken: string, username: string): Promise<ApiChatContext> {
  return requestApi<ApiChatContext>(`/chat/conversations/with/${encodeURIComponent(username)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}

export async function searchChatPeople(accessToken: string, query: string): Promise<ApiChatPerson[]> {
  const params = new URLSearchParams({ query });
  const response = await requestApi<{ items: ApiChatPerson[] }>(`/chat/people?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
  return response.items;
}

export async function getChatEligibility(accessToken: string, username: string): Promise<ApiChatEligibility> {
  return requestApi<ApiChatEligibility>(`/chat/people/${encodeURIComponent(username)}/eligibility`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}

export async function getChatContextById(accessToken: string, conversationId: string): Promise<ApiChatContext> {
  return requestApi<ApiChatContext>(`/chat/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}

export async function sendMessageToUser(accessToken: string, username: string, content: string, clientMessageId: string, media: File[] = []): Promise<ApiMessage> {
  return sendChatMessage(accessToken, `/chat/conversations/with/${encodeURIComponent(username)}/messages`, content, clientMessageId, media);
}

export async function acceptChatRequest(accessToken: string, conversationId: string): Promise<ApiConversation> {
  return requestApi<ApiConversation>(`/chat/conversations/${conversationId}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}

export async function rejectChatRequest(accessToken: string, conversationId: string): Promise<ApiConversation> {
  return requestApi<ApiConversation>(`/chat/conversations/${conversationId}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}

export async function updateChatSettings(accessToken: string, conversationId: string, input: { muted?: boolean; archived?: boolean }): Promise<ApiConversation> {
  const params = new URLSearchParams();
  if (typeof input.muted === 'boolean') params.set('muted', String(input.muted));
  if (typeof input.archived === 'boolean') params.set('archived', String(input.archived));
  return requestApi<ApiConversation>(`/chat/conversations/${conversationId}/settings?${params.toString()}`, {
    method: 'PATCH',
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

export async function markConversationRead(accessToken: string, conversationId: string, messageId: string): Promise<{ conversation_id: string; last_read_message_id: string | null; unread_count: number }> {
  return requestApi(`/chat/conversations/${conversationId}/read?message_id=${encodeURIComponent(messageId)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}

export async function updateReadReceiptPreference(accessToken: string, enabled: boolean): Promise<{ read_receipts_enabled: boolean }> {
  return requestApi(`/chat/preferences/read-receipts?enabled=${String(enabled)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}

export async function getReadReceiptPreference(accessToken: string): Promise<{ read_receipts_enabled: boolean }> {
  return requestApi('/chat/preferences/read-receipts', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    authContext: 'authenticated_request',
  });
}

export async function sendConversationMessage(accessToken: string, conversationId: string, content: string, clientMessageId: string, media: File[] = []): Promise<ApiMessage> {
  return sendChatMessage(accessToken, `/chat/conversations/${conversationId}/messages`, content, clientMessageId, media);
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

export async function listFollowers(username: string, accessToken?: string): Promise<ApiConnectionList> {
  return requestApi<ApiConnectionList>(`/connections/users/${encodeURIComponent(username)}/followers`, {
    method: 'GET',
    ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` }, authContext: 'authenticated_request' as const } : {}),
  });
}

export async function listFollowing(username: string, accessToken?: string): Promise<ApiConnectionList> {
  return requestApi<ApiConnectionList>(`/connections/users/${encodeURIComponent(username)}/following`, {
    method: 'GET',
    ...(accessToken ? { headers: { Authorization: `Bearer ${accessToken}` }, authContext: 'authenticated_request' as const } : {}),
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
  const headers = new Headers(requestInit.headers);
  headers.set('Content-Type', 'application/json');
  if (requestInit.authContext) headers.set('X-Friink-Auth-Context', requestInit.authContext);
  if (!headers.has('X-Friink-Account-Slot')) {
    const slot = activeAccountSlot();
    if (slot) headers.set('X-Friink-Account-Slot', slot);
  }
  if (/^Bearer\s*$/i.test(headers.get('Authorization') ?? '')) headers.delete('Authorization');

  let response: Response;
  try {
    response = await fetchApi(path, {
      ...requestInit,
      headers,
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
      const requestSlot = headers.get('X-Friink-Account-Slot') || activeAccountSlot();
      const refreshedSession = await refreshAuthSession(requestSlot);
      return requestApi<T>(path, {
        ...requestInit,
        headers: withAuthorizationHeader(requestInit.headers, refreshedSession.accessToken),
        retryingAfterRefresh: true,
      });
    }
    const authError = new AuthApiError(apiError.message, response.status, apiError.code, { cooldownSeconds: apiError.cooldownSeconds });
    if (
      !requestInit.skipAuthRefresh &&
      requestInit.authContext === 'authenticated_request' &&
      isTerminalRefreshFailure(authError)
    ) {
      preserveFailedAuthContext(authError);
    }
    throw authError;
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

async function getApiError(response: Response): Promise<{ message: string; code?: AuthErrorCode; cooldownSeconds?: number }> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (typeof body.detail === 'string') {
      return { message: body.detail };
    }
    if (body.detail && !Array.isArray(body.detail) && typeof body.detail === 'object') {
      return {
        message: body.detail.message || `Friink API request failed with ${response.status}.`,
        code: body.detail.code,
        cooldownSeconds: body.detail.cooldown_seconds,
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

async function mapTokenResponse(response: ApiTokenResponse): Promise<AuthSession> {
  const user = response.user ?? await requestApi<ApiUser>('/auth/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${response.access_token}` },
    authContext: 'authenticated_request',
    skipAuthRefresh: true,
  });
  return {
    accessToken: response.access_token,
    tokenType: 'Bearer',
    user: mapApiUser(user),
    accountSlot: response.account_slot ?? undefined,
  };
}

function mapApiUser(user: ApiUser): AuthUser {
  return {
    id: user.id,
    name: user.display_name || user.username,
    email: user.email,
    username: user.username,
    about: user.about ?? '',
    dateOfBirth: user.date_of_birth,
    createdAt: user.created_at,
    accountRegion: user.account_region,
    location: user.location,
    useIntent: user.use_intent,
    showProfessionalBadge: user.show_professional_badge ?? false,
    profilePictureUrl: user.profile_picture_url,
    profilePictureUpdatedAt: user.profile_picture_updated_at,
    isPrivate: user.is_private,
    likesVisible: user.likes_visible ?? true,
    isStaff: user.is_staff ?? false,
    setupStep: user.setup_step,
    setupCompleted: user.setup_completed,
    status: user.is_verified ? 'active' : 'pending_email_verification',
    emailVerifiedAt: user.is_verified ? user.updated_at : null,
  };
}

export function isTerminalRefreshFailure(error: unknown): error is AuthApiError {
  return error instanceof AuthApiError && error.status === 401 && (
    error.code === 'TOKEN_EXPIRED' ||
    error.code === 'SESSION_NOT_FOUND' ||
    error.code === 'REFRESH_TOKEN_MISSING' ||
    error.code === 'REFRESH_TOKEN_INVALID'
    || error.code === 'SESSION_REVOKED_SECURITY'
  );
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
