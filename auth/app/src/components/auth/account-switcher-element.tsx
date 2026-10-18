"use client";

import "@friink/account-switcher";

export default function AccountSwitcherElement({ authUrl }: { authUrl: string }) {
  return <account-switcher auth-url={authUrl} api-base="/api/auth" />;
}
