"use client";

import "@friink/account-switcher";

export default function AccountSwitcherElement({ authUrl, variant = "full" }: { authUrl: string; variant?: "icon" | "compact" | "full" }) {
  return <account-switcher auth-url={authUrl} api-base="/api/auth" variant={variant} />;
}
