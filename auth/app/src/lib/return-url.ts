export function getTrustedReturnTo() {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("returnTo");
  if (!value) return null;
  try {
    const target = new URL(value);
    const configured = (process.env.NEXT_PUBLIC_AUTH_TRUSTED_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
    const allowed = new Set([window.location.origin, ...configured]);
    return allowed.has(target.origin) ? target.toString() : null;
  } catch { return null; }
}

export function destinationAfterAuth(returnTo: string | null, fallback: string) {
  if (returnTo) return returnTo;
  return fallback;
}

export function onboardingUrl(returnTo: string | null) {
  return returnTo ? `/onboarding?returnTo=${encodeURIComponent(returnTo)}` : "/onboarding";
}
