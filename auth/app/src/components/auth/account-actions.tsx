"use client";

import { useState } from "react";
import { publishSessionEvent } from "@friink/account-switcher";

export default function AccountActions({ currentToken }: { currentToken: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setBusy(true);
    setError("");
    try {
      const revokeResponse = await fetch("/api/auth/multi-session/revoke", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ sessionToken: currentToken }),
        cache: "no-store",
      });
      if (!revokeResponse.ok) throw new Error("Unable to sign out this account. Please try again.");
      publishSessionEvent("account-logged-out");
      window.location.replace("/");
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Unable to sign out. Please try again.");
      setBusy(false);
    }
  }

  return <div className="account-logout-wrap"><button className="account-logout" type="button" aria-label={busy ? "Signing out" : "Log out"} title={busy ? "Signing out" : "Log out"} disabled={busy} onClick={signOut}>{busy ? "…" : "↥"}</button>{error && <span className="account-logout-error" role="alert">{error}</span>}</div>;
}
