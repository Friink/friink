import { ListRow } from '@/components/list-row';
import { Modal } from '@/components/modal';
import { PageSurface } from '@/components/page-surface';
import { useEffect, useState } from 'react';
import { listStaffUsers, staffMe, staffStepUp, type AuthSession, type StaffUser } from '@/lib/auth';

export type ControlPanelTab = 'overview' | 'staff' | 'users' | 'security' | 'audit' | 'public-site';

const tabContent: Record<ControlPanelTab, { title: string; items: Array<{ icon: string; title: string; description: string; meta: string }> }> = {
  overview: {
    title: 'Overview',
    items: [{ icon: 'fa-solid fa-chart-simple', title: 'Control Panel overview', description: 'A permission-aware summary will appear here as administrative areas become active.', meta: 'Placeholder' }],
  },
  staff: {
    title: 'Staff',
    items: [{ icon: 'fa-solid fa-user-shield', title: 'Staff administration', description: 'Staff users, roles, permissions, and promotions will be managed here.', meta: 'Placeholder' }],
  },
  users: {
    title: 'Users',
    items: [
      { icon: 'fa-solid fa-magnifying-glass', title: 'Search users', description: 'Find an account by email, username, or display name.', meta: 'Planned' },
      { icon: 'fa-solid fa-user-check', title: 'Account status', description: 'Review lifecycle, verification, and staff status.', meta: 'Planned' },
      { icon: 'fa-solid fa-key', title: 'Access assignments', description: 'Review each user’s role and direct permission grants.', meta: 'Planned' },
    ],
  },
  security: {
    title: 'Security & sessions',
    items: [{ icon: 'fa-solid fa-shield-halved', title: 'Security & sessions', description: 'Privileged sessions, account locks, and session revocation will be managed here.', meta: 'Placeholder' }],
  },
  audit: {
    title: 'Audit log',
    items: [{ icon: 'fa-solid fa-clock-rotate-left', title: 'Audit activity', description: 'Immutable staff and security activity will appear here.', meta: 'Placeholder' }],
  },
  'public-site': {
    title: 'Public site',
    items: [{ icon: 'fa-solid fa-globe', title: 'Public-site administration', description: 'Public content and marketing controls will be managed here.', meta: 'Placeholder' }],
  },
};

export function ControlPanelScreen({ activeTab = 'overview', session }: { activeTab?: ControlPanelTab; session?: AuthSession | null }) {
  const content = tabContent[activeTab];
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [permissions, setPermissions] = useState<string[]>([]); const [users, setUsers] = useState<StaffUser[]>([]); const [password, setPassword] = useState(''); const [showPassword, setShowPassword] = useState(false); const [needsStepUp, setNeedsStepUp] = useState(false); const [verifyBusy, setVerifyBusy] = useState(false);
  useEffect(() => { if (!session) return; staffMe(session.accessToken).then((value) => { setPermissions(value.permissions); setNeedsStepUp(false); }).catch((err) => { setNeedsStepUp(err?.status === 401); setError(err?.message ?? 'Could not load staff access.'); }).finally(() => setLoading(false)); }, [session]);
  useEffect(() => { if (!session || needsStepUp) return; if (activeTab === 'users') listStaffUsers(session.accessToken).then(setUsers).catch((err) => setError(err.message)); }, [activeTab, needsStepUp, session]);
  async function verify() { if (!session || verifyBusy) return; setVerifyBusy(true); setError(null); try { const value = await staffStepUp(session.accessToken, password); setPermissions(value.permissions); setNeedsStepUp(false); setPassword(''); } catch (err: any) { setError(err.message); } finally { setVerifyBusy(false); } }
  if (loading) return <PageSurface className="simple-screen settings-screen" aria-label="Control panel loading"><div className="settings-panel"><p className="settings-field-message" role="status">Loading Control panel…</p></div></PageSurface>;
  if (needsStepUp) return <Modal title="Verify staff access" onClose={() => window.history.back()} closeLabel="Close staff verification" actions={<><button className="button-secondary" type="button" onClick={() => window.history.back()} disabled={verifyBusy}>Cancel</button><button className="button-primary" type="submit" form="staff-verification-form" disabled={verifyBusy || !password}>{verifyBusy ? 'Verifying…' : 'Verify'}</button></>}><form id="staff-verification-form" onSubmit={(event) => { event.preventDefault(); void verify(); }}><p className="settings-field-message">Your ordinary Friink session stays active. Verify again to open protected staff tools.</p><div className="settings-password-input"><input className="settings-field-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete="current-password" autoFocus aria-label="Staff password" /><button className="password-toggle" type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}><i className={`fa-regular ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" /></button></div>{error ? <p className="settings-field-message" role="alert">{error}</p> : null}</form></Modal>;
  if (error && !permissions.length) return <PageSurface className="simple-screen settings-screen" aria-label="Control panel unavailable"><div className="settings-panel"><p className="settings-field-message" role="alert">{error}</p><button className="button-secondary" type="button" onClick={() => window.location.reload()}>Retry</button></div></PageSurface>;
  const allowed = (permission: string) => permissions.includes(permission);
  if (!permissions.length) return <PageSurface className="simple-screen settings-screen" aria-label="No staff access"><div className="settings-panel"><p className="settings-field-message">Staff access has not yet been assigned to this account.</p></div></PageSurface>;

  return (
    <PageSurface className="simple-screen settings-screen" aria-label="Control panel content">
      <div className="settings-panel">
        <div className="settings-section" role="tabpanel" id={`control-panel-${activeTab}`} aria-label={content.title}>
          {activeTab === 'users' && allowed('users.view') ? users.map((user) => <ListRow key={user.id} title={`@${user.username}`} subtitle={user.email} meta={user.account_locked ? 'Locked' : user.permissions.join(', ') || 'No permissions'} className="settings-row settings-row-expanded" />) : null}
          {(activeTab === 'overview' || activeTab === 'staff' || activeTab === 'security' || activeTab === 'audit' || activeTab === 'public-site') ? content.items.map((item) => (
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
