import { ListRow } from '@/components/list-row';
import { Modal } from '@/components/modal';
import { PageSurface } from '@/components/page-surface';
import { useEffect, useState } from 'react';
import { grantSubscription, listStaffUsers, listSubscriptionAssignments, listSubscriptionPlans, revokeSubscription, staffMe, staffStepUp, type AuthSession, type StaffUser, type SubscriptionAssignment } from '@/lib/auth';

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

function formatDate(value: string | null) {
  if (!value) return 'No expiration';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}

function SubscriptionAdmin({ accessToken, users, canManage }: { accessToken: string; users: StaffUser[]; canManage: boolean }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(users);
  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [assignments, setAssignments] = useState<SubscriptionAssignment[]>([]);
  const [plans, setPlans] = useState<Array<{ code: string; name: string; description: string; active: boolean }>>([]);
  const [planCode, setPlanCode] = useState('friink_pro');
  const [duration, setDuration] = useState('30');
  const [customDate, setCustomDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState<'adjust' | 'revoke' | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      listStaffUsers(accessToken, query).then(setResults).catch((err) => setError(err.message));
    }, query.trim() ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [accessToken, query]);

  useEffect(() => {
    if (!canManage) return;
    listSubscriptionPlans(accessToken).then(setPlans).catch((err) => setError(err.message));
  }, [accessToken, canManage]);

  async function chooseUser(user: StaffUser) {
    setSelected(user); setStatus(''); setError('');
    try { setAssignments(await listSubscriptionAssignments(accessToken, user.id)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load subscription history.'); }
  }

  async function submitAdjust() {
    if (!selected || !reason.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const payload: { plan_code: string; duration_days?: number; expires_at?: string; reason: string } = { plan_code: planCode, reason: reason.trim() };
      if (duration === 'custom') payload.expires_at = new Date(`${customDate}T23:59:59`).toISOString();
      else if (duration !== 'none') payload.duration_days = Number(duration);
      await grantSubscription(accessToken, selected.id, payload);
      setAssignments(await listSubscriptionAssignments(accessToken, selected.id));
      setStatus(`${selected.username} is now on ${plans.find((plan) => plan.code === planCode)?.name ?? planCode}.`);
      setReason(''); setModal(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update the plan.'); }
    finally { setBusy(false); }
  }

  async function submitRevoke() {
    if (!selected || !reason.trim() || busy) return;
    setBusy(true); setError('');
    try {
      await revokeSubscription(accessToken, selected.id, reason.trim());
      setAssignments(await listSubscriptionAssignments(accessToken, selected.id));
      setStatus(`${selected.username} has returned to Friink Free.`);
      setReason(''); setModal(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not revoke the plan.'); }
    finally { setBusy(false); }
  }

  const latest = assignments[0];
  const inactive = selected && selected.lifecycle_status !== 'active';
  return <div className="subscription-admin">
    <label className="settings-field-label" htmlFor="staff-user-search">Find a user</label>
    <input id="staff-user-search" className="settings-field-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search username or email" autoComplete="off" />
    <div className="subscription-admin-results" aria-live="polite">
      {results.length === 0 ? <p className="settings-field-message">{query.trim().length < 2 ? 'Type at least 2 characters to search.' : 'No users found.'}</p> : results.map((user) => <ListRow key={user.id} title={`@${user.username}`} subtitle={user.display_name ? `${user.display_name} · ${user.email}` : user.email} meta={user.lifecycle_status === 'pending_deletion' ? `Scheduled for deletion${user.deletion_deadline ? ` on ${formatDate(user.deletion_deadline)}` : ''}` : user.lifecycle_status === 'deactivated' ? 'Deactivated' : user.account_locked ? 'Locked' : 'Active'} trailing={<button className="button-secondary" type="button" onClick={() => void chooseUser(user)}>View</button>} className={`settings-row settings-row-expanded${selected?.id === user.id ? ' active' : ''}`} />)}
    </div>
    {selected ? <div className="subscription-admin-detail">
      <div className="subscription-admin-detail-heading"><div><h3>@{selected.username}</h3><p>{selected.email}</p></div><span className="subscription-status-pill">{latest ? latest.status : 'Free default'}</span></div>
      <p className="settings-field-message">{latest ? `${latest.plan_name} · ${latest.status} · ${formatDate(latest.expires_at)}` : 'Friink Free · No expiration'}</p>
      {inactive ? <p className="settings-field-message" role="status">Plan actions are unavailable while this account is {selected.lifecycle_status.replace('_', ' ')}.</p> : null}
      {canManage && !inactive ? <div className="subscription-admin-actions"><button className="button-primary" type="button" onClick={() => { setPlanCode(latest?.plan_code ?? 'friink_pro'); setModal('adjust'); }}>Adjust plan</button>{latest?.status === 'active' && latest.plan_code !== 'friink_free' ? <button className="button-secondary" type="button" onClick={() => setModal('revoke')}>Return to Free</button> : null}</div> : null}
      {assignments.length > 0 ? <div className="subscription-assignment-history"><h4>Assignment history</h4>{assignments.map((assignment) => <p key={assignment.assignment_id}><strong>{assignment.plan_name}</strong> · {assignment.status} · {formatDate(assignment.starts_at)}–{formatDate(assignment.expires_at)}<br /><small>{assignment.reason || 'No reason recorded'}</small></p>)}</div> : null}
    </div> : null}
    {status ? <p className="settings-field-message" role="status">{status}</p> : null}
    {error ? <p className="settings-field-message" role="alert">{error}</p> : null}
    {modal === 'adjust' ? <Modal title="Adjust plan" onClose={() => setModal(null)} closeLabel="Close plan adjustment" actions={<><button className="button-secondary" type="button" onClick={() => setModal(null)} disabled={busy}>Cancel</button><button className="button-primary" type="button" onClick={() => void submitAdjust()} disabled={busy || !reason.trim() || (duration === 'custom' && !customDate)}>{busy ? 'Saving…' : 'Confirm change'}</button></>}><p className="settings-field-message">This change takes effect immediately. Manual access is not a payment.</p><label className="settings-field-label" htmlFor="subscription-plan">Plan</label><select id="subscription-plan" className="settings-field-input" value={planCode} onChange={(event) => setPlanCode(event.target.value)}>{plans.filter((plan) => plan.active).map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}</select><label className="settings-field-label" htmlFor="subscription-duration">Access duration</label><select id="subscription-duration" className="settings-field-input" value={duration} onChange={(event) => setDuration(event.target.value)}><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option><option value="custom">Custom expiry date</option><option value="none">No expiration</option></select>{duration === 'custom' ? <input id="subscription-custom-date" className="settings-field-input" type="date" min={new Date().toISOString().slice(0, 10)} value={customDate} onChange={(event) => setCustomDate(event.target.value)} /> : null}<label className="settings-field-label" htmlFor="subscription-reason">Reason</label><textarea id="subscription-reason" className="settings-field-input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this access changing?" rows={3} /></Modal> : null}
    {modal === 'revoke' ? <Modal title="Return user to Free" onClose={() => setModal(null)} closeLabel="Close revoke confirmation" actions={<><button className="button-secondary" type="button" onClick={() => setModal(null)} disabled={busy}>Cancel</button><button className="button-primary" type="button" onClick={() => void submitRevoke()} disabled={busy || !reason.trim()}>{busy ? 'Saving…' : 'Confirm revoke'}</button></>}><p className="settings-field-message">Paid access ends immediately and the user returns to Friink Free.</p><label className="settings-field-label" htmlFor="revoke-reason">Reason</label><textarea id="revoke-reason" className="settings-field-input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is access being revoked?" rows={3} /></Modal> : null}
  </div>;
}

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
          {activeTab === 'users' && allowed('users.view') && session ? <SubscriptionAdmin accessToken={session.accessToken} users={users} canManage={allowed('subscriptions.manage')} /> : null}
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
