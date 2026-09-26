export const SESSION_ENTRY_HINT_COOKIE = 'friink_session_hint';

const SESSION_ENTRY_HINT_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function setSessionEntryHint(): void {
  if (typeof window === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_ENTRY_HINT_COOKIE}=1; Max-Age=${SESSION_ENTRY_HINT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

export function clearSessionEntryHint(): void {
  if (typeof window === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_ENTRY_HINT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
}
