import type { ReactNode } from "react";
import AccountActions from "@/components/auth/account-actions";
import AccountSwitcherElement from "@/components/auth/account-switcher-element";
import { config } from "@/lib/config";

type AccountShellProps = {
  username?: string | null;
  currentToken: string;
  activePath: "profile" | "settings" | "security" | "status";
  children: ReactNode;
};

export default function AccountShell({ username, currentToken, activePath, children }: AccountShellProps) {
  const profileHref = username ? `/${encodeURIComponent(username)}` : "/me";
  return (
    <div className="account-shell">
      <header className="account-topbar">
        <a className="brand" href="/" aria-label="Friink home">m</a>
        <AccountSwitcherElement authUrl={config.authUrl} variant="icon" />
      </header>
      <main className="account-content">{children}</main>
      <aside className="account-rail" aria-label="Account navigation">
        <nav className="account-rail-nav">
          <a className={activePath === "profile" ? "active" : ""} href={profileHref} aria-label="Profile" aria-current={activePath === "profile" ? "page" : undefined}><i className="fa-solid fa-house" aria-hidden="true" /></a>
          <a className={activePath === "settings" ? "active" : ""} href="/settings" aria-label="Settings" aria-current={activePath === "settings" ? "page" : undefined}><i className="fa-solid fa-gear" aria-hidden="true" /></a>
          <a className={activePath === "security" ? "active" : ""} href="/security" aria-label="Security" aria-current={activePath === "security" ? "page" : undefined}><i className="fa-solid fa-shield-halved" aria-hidden="true" /></a>
          <a className={activePath === "status" ? "active" : ""} href="/account-status" aria-label="Account status" aria-current={activePath === "status" ? "page" : undefined}><i className="fa-solid fa-circle-user" aria-hidden="true" /></a>
        </nav>
        <AccountActions currentToken={currentToken} />
      </aside>
    </div>
  );
}
