import { sidebarNavItems, type Screen } from '@/lib/data';
import { DEFAULT_PROFILE_IMAGE, ProfileCard } from '@/components/profile-card';
import { Modal } from '@/components/modal';
import { LoginScreen } from '@/components/login-screen';
import { ActionMenu, type ActionMenuItem } from '@/components/action-menu';
import type { AuthUser } from '@/lib/auth';
import { useCallback, useEffect, useRef, useState } from 'react';
import { canAddAccount, listAccounts, loadAuthSession, removeAccount, saveAuthSession, switchAccount, type AccountSummary } from '@/lib/auth';

type SideDrawerProps = {
  user: AuthUser;
  activeScreen: Screen;
  collapsed: boolean;
  onNavigate: (screen: Screen) => void;
  onToggleCollapsed: () => void;
  onLogout: () => void;
  onAccountChange?: (user: AuthUser) => void;
};

function getInitials(value: string) {
  return (
    value
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'FR'
  );
}

export function SideDrawer({ user, activeScreen, collapsed, onNavigate, onToggleCollapsed, onLogout, onAccountChange }: SideDrawerProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountSwitchingUsername, setAccountSwitchingUsername] = useState<string | null>(null);
  const [accountModal, setAccountModal] = useState<'add' | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AccountSummary | null>(null);
  const [accountNotice, setAccountNotice] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountLoadError, setAccountLoadError] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const accountRefreshId = useRef(0);
  const accountRefreshPromise = useRef<Promise<void> | null>(null);

  const refreshAccounts = useCallback(() => {
    if (accountRefreshPromise.current) return accountRefreshPromise.current;

    const request = (async () => {
      let session = loadAuthSession();
      if (!session) return;
      const refreshId = ++accountRefreshId.current;
      setAccountLoading(true);
      setAccountLoadError(false);
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const nextAccounts = await listAccounts(session.accessToken);
            if (refreshId !== accountRefreshId.current) return;
            setAccounts(nextAccounts);
            setAccountNotice('');
            return;
          } catch {
            if (attempt === 0) {
              await new Promise((resolve) => window.setTimeout(resolve, 250));
              session = loadAuthSession() ?? session;
              continue;
            }
            if (refreshId !== accountRefreshId.current) return;
            setAccountLoadError(true);
          }
        }
      } finally {
        setAccountLoading(false);
      }
    })();

    const trackedRequest = request.finally(() => {
      if (accountRefreshPromise.current === trackedRequest) accountRefreshPromise.current = null;
    });
    accountRefreshPromise.current = trackedRequest;
    return trackedRequest;
  }, []);

  useEffect(() => {
    function handleOutside(e: Event) {
      if (collapsed) return;
      try {
        const isMobile = window.matchMedia('(max-width: 767px)').matches;
        if (!isMobile) return;
        const target = e.target as Node | null;
        if (ref.current && target && !ref.current.contains(target)) {
          onToggleCollapsed();
        }
      } catch (err) {
        // ignore
      }
    }

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('focusin', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('focusin', handleOutside);
    };
  }, [collapsed, onToggleCollapsed]);

  useEffect(() => {
    void refreshAccounts();
  }, [refreshAccounts, user.id]);

  async function handleAccountSwitch(account: AccountSummary) {
    const session = loadAuthSession();
    if (!session || account.active) return;
    setAccountBusy(true);
    setAccountSwitchingUsername(account.username);
    try {
      const next = await switchAccount(session.accessToken, account.accountSlot);
      saveAuthSession(next);
      onAccountChange?.(next.user);
    } catch {
      setAccountNotice('We could not switch accounts. Please try again.');
    } finally {
      setAccountBusy(false);
      setAccountSwitchingUsername(null);
    }
  }

  async function confirmRemoveAccount() {
    const session = loadAuthSession();
    if (!session || !removeTarget) return;
    setAccountBusy(true);
    try {
      await removeAccount(session.accessToken, removeTarget.accountSlot);
      if (removeTarget.active) {
        const remaining = accounts.filter((item) => item.accountSlot !== removeTarget.accountSlot).sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
        if (remaining[0]) {
          const next = await switchAccount(session.accessToken, remaining[0].accountSlot);
          saveAuthSession(next);
          onAccountChange?.(next.user);
          window.location.reload();
          return;
        }
        onLogout();
        return;
      }
      setAccounts((items) => items.filter((item) => item.accountSlot !== removeTarget.accountSlot));
      setRemoveTarget(null);
      await refreshAccounts();
    } catch {
      // Keep the current account usable on recoverable failures and expose a
      // retryable notice instead of silently losing the user's action.
      setAccountNotice('We could not log out that account. Please try again.');
    } finally {
      setAccountBusy(false);
    }
  }

  async function handleAddAccount() {
    const session = loadAuthSession();
    if (!session) return;
    setAccountBusy(true);
    try {
      if (!(await canAddAccount(session.accessToken))) {
        setAccountNotice('');
        setAccountModal('add');
        return;
      }
      setAccountNotice('');
      setAccountModal('add');
    } catch {
      // Availability is a best-effort preflight. Keep the add-account flow
      // usable when the check is unavailable; the API still enforces the
      // remembered-account limit during the authenticated add-account login.
      setAccountNotice('');
      setAccountModal('add');
    } finally {
      setAccountBusy(false);
    }
  }

  function handleNavigate(screen: Screen) {
    onNavigate(screen);

    try {
      const isMobile = window.matchMedia('(max-width: 767px)').matches;
      if (isMobile && !collapsed) {
        onToggleCollapsed();
      }
    } catch (err) {
      // ignore
    }
  }

  function getNavigationHref(screen: Screen) {
    switch (screen) {
      case 'home':
        return '/home/explore';
      case 'profile':
        return `/${encodeURIComponent(user.username)}`;
      case 'connections':
        return `/${encodeURIComponent(user.username)}/connections`;
      case 'saved':
        return '/saved/posts';
      case 'directory':
        return '/directory';
      case 'settings':
        return '/settings/general';
      default:
        return '/home';
    }
  }

  const menuAccounts = accounts.length > 0 ? accounts : [{
    accountSlot: '',
    username: user.username,
    displayName: user.name,
    profilePictureUrl: user.profilePictureUrl,
    active: true,
    available: true,
    lastUsedAt: '',
  } satisfies AccountSummary];
  const accountMenuItems: ActionMenuItem[] = [
    ...menuAccounts.map((account) => ({
      label: `@${account.username}${account.active ? ' (current)' : ''}`,
      icon: 'fa-circle-user',
      imageUrl: account.profilePictureUrl || DEFAULT_PROFILE_IMAGE,
      trailingIcon: accountSwitchingUsername === account.username ? 'fa-spinner fa-spin' : account.active ? 'fa-check' : 'fa-right-from-bracket',
      trailingAction: account.active ? undefined : () => setRemoveTarget(account),
      trailingAriaLabel: account.active ? undefined : `Log out @${account.username}`,
      disabled: account.active || accountBusy,
      closeOnClick: !account.active,
      onClick: () => void handleAccountSwitch(account),
    })),
    {
      label: 'Add account',
      icon: 'fa-user-plus',
      disabled: accountBusy,
      onClick: () => void handleAddAccount(),
    },
  ];

  return (
    <aside ref={ref} className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`} aria-label="Main navigation">
      <div className="sidebar-profile">
        <ProfileCard name={user.name} handle={`@${user.username}`} tone="mint" initials={getInitials(user.name)} imageUrl={user.profilePictureUrl} />
        <button
          ref={accountMenuButtonRef}
          className="sidebar-account-menu-button"
          type="button"
          aria-label="Switch account"
          aria-expanded={accountMenuOpen}
          aria-busy={accountLoading}
          onClick={() => {
            if (accountMenuOpen) {
              setAccountMenuOpen(false);
              return;
            }
            setAccountMenuOpen(true);
            void refreshAccounts();
          }}
        >
          <i className="fa-solid fa-caret-down" aria-hidden="true" />
        </button>
        <ActionMenu
          open={accountMenuOpen}
          anchorRef={accountMenuButtonRef}
          onClose={() => setAccountMenuOpen(false)}
          ariaLabel="Account switcher"
          className="account-switcher-menu"
          header={
            <div className="account-switcher-header" role="status" aria-live="polite">
              <span>Switch Account</span>
              <span className="account-switcher-header-status">
                {accountLoading ? <i className="fa-solid fa-spinner fa-spin" aria-label="Updating accounts" /> : null}
                {!accountLoading && accountLoadError ? <button type="button" onClick={() => void refreshAccounts()}>Retry</button> : null}
              </span>
            </div>
          }
          items={accountMenuItems}
        />
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {sidebarNavItems.map((item) => (
          <a
            className={`nav-item${activeScreen === item.id ? ' active' : ''}`}
            key={item.id}
            href={getNavigationHref(item.id)}
            aria-current={activeScreen === item.id ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              handleNavigate(item.id);
            }}
          >
            <span className="nav-item-icon" aria-hidden="true">
              <i className={item.icon} />
            </span>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user.isStaff ? <a className="sidebar-action" href="/cp">
          <span className="nav-item-icon" aria-hidden="true"><i className="fa-solid fa-shield-halved" /></span>
          <span>Control panel</span>
        </a> : null}
        <a
          className="sidebar-action"
          href={getNavigationHref('settings')}
          onClick={(event) => {
            event.preventDefault();
            handleNavigate('settings');
          }}
        >
          <span className="nav-item-icon" aria-hidden="true">
            <i className="fa-solid fa-gear" />
          </span>
          <span>Settings</span>
        </a>
        <button className="sidebar-action" type="button" onClick={() => { const active = accounts.find((item) => item.active); if (active) setRemoveTarget(active); else onLogout(); }}>
          <span className="nav-item-icon" aria-hidden="true">
            <i className="fa-solid fa-right-from-bracket" />
          </span>
          <span>Log out</span>
        </button>
      </div>
      {accountModal === 'add' ? <Modal title="Add account" className="account-auth-modal" onClose={() => setAccountModal(null)}><LoginScreen mode="account-modal" onAuthenticated={(nextUser) => { onAccountChange?.(nextUser); setAccountModal(null); }} /></Modal> : null}
      {removeTarget ? <Modal title="Log out account" onClose={() => setRemoveTarget(null)} actions={<><button className="button-secondary" type="button" onClick={() => setRemoveTarget(null)}>Cancel</button><button className="button-primary" type="button" disabled={accountBusy} onClick={() => void confirmRemoveAccount()}>Log out</button></>}><div className="logout-confirm-account"><ProfileCard name={removeTarget.displayName || removeTarget.username} handle={`@${removeTarget.username}`} tone="mint" initials={getInitials(removeTarget.displayName || removeTarget.username)} imageUrl={removeTarget.profilePictureUrl || DEFAULT_PROFILE_IMAGE} /></div><p>{removeTarget.active ? 'You will be switched to your most recently used account.' : `Log out @${removeTarget.username} on this device?`}</p></Modal> : null}
    </aside>
  );
}
