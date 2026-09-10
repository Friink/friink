import { ListRow } from '@/components/list-row';
import { Modal } from '@/components/modal';
import { PageSurface } from '@/components/page-surface';
import { useEffect, useState } from 'react';
import { listStaffRoles, listStaffUsers, staffMe, staffStepUp, staffLogout, type AuthSession, type StaffRole, type StaffUser } from '@/lib/auth';

export type ControlPanelTab = 'overview' | 'users' | 'roles' | 'security' | 'audit';

const tabContent: Record<ControlPanelTab, { title: string; items: Array<{ icon: string; title: string; description: string; meta: string }> }> = {
  overview: {
    title: 'Overview',
    items: [
      { icon: 'fa-solid fa-users', title: 'Users & accounts', description: 'Review account status, staff access, roles, and direct permissions.', meta: 'Phase 5b' },
      { icon: 'fa-solid fa-user-shield', title: 'Roles & permissions', description: 'Manage role capabilities and narrowly scoped individual grants.', meta: 'Phase 5b' },
      { icon: 'fa-solid fa-shield-halved', title: 'Security & sessions', description: 'Review privileged sessions, locks, and session revocation.', meta: 'Phase 5c–5d' },
    ],
  },
  users: {
    title: 'Users & accounts',
    items: [
      { icon: 'fa-solid fa-magnifying-glass', title: 'Search users', description: 'Find an account by email, username, or display name.', meta: 'Planned' },
      { icon: 'fa-solid fa-user-check', title: 'Account status', description: 'Review lifecycle, verification, and staff status.', meta: 'Planned' },
      { icon: 'fa-solid fa-key', title: 'Access assignments', description: 'Review each user’s role and direct permission grants.', meta: 'Planned' },
    ],
  },
  roles: {
    title: 'Roles & permissions',
    items: [
      { icon: 'fa-solid fa-layer-group', title: 'Roles', description: 'Create and edit role names and their permission sets.', meta: 'Planned' },
      { icon: 'fa-solid fa-list-check', title: 'Permission catalog', description: 'Review the permissions available to staff roles.', meta: 'Planned' },
      { icon: 'fa-solid fa-user-plus', title: 'Individual grants', description: 'Add or revoke one permission for a single user.', meta: 'Planned' },
    ],
  },
  security: {
    title: 'Security & sessions',
    items: [
      { icon: 'fa-solid fa-laptop', title: 'Privileged sessions', description: 'Review and revoke active staff sessions.', meta: 'Phase 5c' },
      { icon: 'fa-solid fa-lock', title: 'Account locks', description: 'Review lock state and apply authorized account actions.', meta: 'Phase 5d' },
      { icon: 'fa-solid fa-right-from-bracket', title: 'Session revocation', description: 'End sessions without changing account credentials.', meta: 'Phase 5c–5d' },
    ],
  },
  audit: {
    title: 'Audit log',
    items: [
      { icon: 'fa-solid fa-user-gear', title: 'Access changes', description: 'Role and individual permission changes.', meta: 'Phase 5b' },
      { icon: 'fa-solid fa-user-lock', title: 'Account actions', description: 'Staff account, lock, and session actions.', meta: 'Phase 5d' },
      { icon: 'fa-solid fa-clock-rotate-left', title: 'Recent activity', description: 'Immutable events with sensitive values redacted.', meta: 'Phase 5b–5d' },
    ],
  },
};

export function ControlPanelScreen({ activeTab = 'overview', session }: { activeTab?: ControlPanelTab; session?: AuthSession | null }) {
  const content = tabContent[activeTab];
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [permissions, setPermissions] = useState<string[]>([]); const [users, setUsers] = useState<StaffUser[]>([]); const [roles, setRoles] = useState<StaffRole[]>([]); const [password, setPassword] = useState(''); const [needsStepUp, setNeedsStepUp] = useState(false); const [verifyBusy, setVerifyBusy] = useState(false);
  useEffect(() => { if (!session) return; staffMe(session.accessToken).then((value) => { setPermissions(value.permissions); setNeedsStepUp(false); }).catch((err) => { setNeedsStepUp(err?.status === 401); setError(err?.message ?? 'Could not load staff access.'); }).finally(() => setLoading(false)); }, [session]);
  useEffect(() => { if (!session || needsStepUp) return; if (activeTab === 'users') listStaffUsers(session.accessToken).then(setUsers).catch((err) => setError(err.message)); if (activeTab === 'roles') listStaffRoles(session.accessToken).then(setRoles).catch((err) => setError(err.message)); }, [activeTab, needsStepUp, session]);
  async function verify() { if (!session || verifyBusy) return; setVerifyBusy(true); setError(null); try { const value = await staffStepUp(session.accessToken, password); setPermissions(value.permissions); setNeedsStepUp(false); setPassword(''); } catch (err: any) { setError(err.message); } finally { setVerifyBusy(false); } }
  if (loading) return <PageSurface className="simple-screen settings-screen" aria-label="Control panel loading"><div className="settings-panel"><p className="settings-field-message" role="status">Loading Control panel…</p></div></PageSurface>;
  if (needsStepUp) return <Modal title="Verify staff access" onClose={() => window.history.back()} closeLabel="Close staff verification" actions={<><button className="button-secondary" type="button" onClick={() => window.history.back()} disabled={verifyBusy}>Cancel</button><button className="button-primary" type="submit" form="staff-verification-form" disabled={verifyBusy || !password}>{verifyBusy ? 'Verifying…' : 'Verify'}</button></>}><form id="staff-verification-form" onSubmit={(event) => { event.preventDefault(); void verify(); }}><p className="settings-field-message">Your ordinary Friink session stays active. Verify again to open protected staff tools.</p><input className="settings-field-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete="current-password" autoFocus aria-label="Staff password" />{error ? <p className="settings-field-message" role="alert">{error}</p> : null}</form></Modal>;
  if (error && !permissions.length) return <PageSurface className="simple-screen settings-screen" aria-label="Control panel unavailable"><div className="settings-panel"><p className="settings-field-message" role="alert">{error}</p><button className="button-secondary" type="button" onClick={() => window.location.reload()}>Retry</button></div></PageSurface>;
  const allowed = (permission: string) => permissions.includes(permission);
  if (!permissions.length) return <PageSurface className="simple-screen settings-screen" aria-label="No staff access"><div className="settings-panel"><p className="settings-field-message">Staff access has not yet been assigned to this account.</p></div></PageSurface>;

  return (
    <PageSurface className="simple-screen settings-screen" aria-label="Control panel content">
      <div className="settings-panel">
        <div className="settings-section" role="tabpanel" id={`control-panel-${activeTab}`} aria-label={content.title}>
          {activeTab === 'users' && allowed('users.view') ? users.map((user) => <ListRow key={user.id} title={`@${user.username}`} subtitle={user.email} meta={user.account_locked ? 'Locked' : user.permissions.join(', ') || 'No permissions'} className="settings-row settings-row-expanded" />) : null}
          {activeTab === 'roles' && allowed('roles.manage') ? roles.map((role) => <ListRow key={role.key} title={role.display_name} subtitle={`Stable key: ${role.key}`} meta={role.permissions.join(', ') || 'No permissions'} className="settings-row settings-row-expanded" />) : null}
          {(activeTab === 'overview' || activeTab === 'security' || activeTab === 'audit') ? content.items.map((item) => (
            <ListRow
              key={item.title}
              avatar={<span className="settings-icon"><i className={item.icon} aria-hidden="true" /></span>}
              title={item.title}
              subtitle={item.description}
              meta={item.meta}
              className="settings-row settings-row-expanded"
            />
          )) : null}
          {error ? <p className="settings-field-message" role="alert">{error}</p> : null}
        </div>
      </div>
    </PageSurface>
  );
}
