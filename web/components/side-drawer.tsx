import { sidebarNavItems, type Screen } from '@/lib/data';
import { ProfileCard } from '@/components/profile-card';
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
  const [accountModal, setAccountModal] = useState<'add' | 'manage' | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AccountSummary | null>(null);
  const [accountNotice, setAccountNotice] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const accountRefreshId = useRef(0);

  const refreshAccounts = useCallback(async () => {
    const session = loadAuthSession();
    if (!session) return;
    const refreshId = ++accountRefreshId.current;
    try {
      const nextAccounts = await listAccounts(session.accessToken);
      if (refreshId !== accountRefreshId.current) return;
      setAccounts(nextAccounts);
      setAccountNotice('');
    } catch {
      if (refreshId !== accountRefreshId.current) return;
      setAccountNotice('We could not load your saved accounts. Please try again.');
    }
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
    try {
      const next = await switchAccount(session.accessToken, account.accountSlot);
      saveAuthSession(next);
      onAccountChange?.(next.user);
      window.location.reload();
    } catch {
      setAccountNotice('We could not switch accounts. Please try again.');
    } finally {
      setAccountBusy(false);
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
    } catch {
      // Keep the current account usable on recoverable failures.
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
        setAccountNotice('Remove an account before adding another.');
        setAccountModal('manage');
        return;
      }
      setAccountNotice('');
      setAccountModal('add');
    } catch {
      setAccountNotice('We could not check account availability. Please try again.');
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
      icon: account.active ? 'fa-check' : 'fa-circle-user',
      disabled: account.active || accountBusy,
      onClick: () => void handleAccountSwitch(account),
    })),
    {
      label: 'Add account',
      icon: 'fa-user-plus',
      onClick: () => void handleAddAccount(),
    },
    {
      label: 'Manage accounts',
      icon: 'fa-users-gear',
      dividerBefore: true,
      onClick: () => {
        setAccountMenuOpen(false);
        setAccountModal('manage');
      },
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
          onClick={() => {
            setAccountMenuOpen((open) => !open);
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
      {accountModal === 'add' ? <Modal title="Add account" className="account-auth-modal" onClose={() => setAccountModal(null)}><LoginScreen mode="account-modal" onAuthenticated={async (nextUser) => { onAccountChange?.(nextUser); await refreshAccounts(); setAccountModal(null); }} /></Modal> : null}
      {accountModal === 'manage' ? <Modal title="Manage accounts" onClose={() => { setAccountModal(null); setAccountNotice(''); }}>{accountNotice ? <p className="settings-field-message" role="status">{accountNotice}</p> : null}<div className="sidebar-managed-accounts">{accounts.map((account) => <div className="sidebar-managed-account" key={account.accountSlot}><ProfileCard name={account.displayName || account.username} handle={`@${account.username}`} tone="mint" initials={getInitials(account.displayName || account.username)} imageUrl={account.profilePictureUrl} /><button className="settings-secondary-button" type="button" disabled={account.active || accountBusy} onClick={() => setRemoveTarget(account)}>Log out</button></div>)}</div></Modal> : null}
      {removeTarget ? <Modal title="Log out account" onClose={() => setRemoveTarget(null)} actions={<><button className="button-secondary" type="button" onClick={() => setRemoveTarget(null)}>Cancel</button><button className="button-primary" type="button" disabled={accountBusy} onClick={() => void confirmRemoveAccount()}>Log out</button></>}><p>{removeTarget.active ? 'You will be switched to your most recently used account.' : `Log out @${removeTarget.username} on this device?`}</p></Modal> : null}
    </aside>
  );
}
