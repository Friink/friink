import { ListRow } from '@/components/list-row';
import { Modal } from '@/components/modal';
import { PageSurface } from '@/components/page-surface';
import { ProfileCard } from '@/components/profile-card';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { decideProfessionalRegistration, getStaffOverview, grantSubscription, listProfessionalRegistrations, listStaffUsers, listSubscriptionAssignments, listSubscriptionPlans, revokeSubscription, staffMe, staffStepUp, type AuthSession, type ProfessionalRegistration, type StaffOverview, type StaffUser, type SubscriptionAssignment } from '@/lib/auth';

export type ControlPanelTab = 'overview' | 'staff' | 'users' | 'professional-registration' | 'security' | 'audit' | 'public-site';

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
  'professional-registration': {
    title: 'Professional Registration',
    items: [],
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

function ProfessionalRegistrationAdmin({ accessToken, canManage }: { accessToken: string; canManage: boolean }) {
  const [status, setStatus] = useState<'pending' | 'registered' | 'rejected' | 'cancelled' | 'revoked' | 'all'>('pending');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ProfessionalRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ProfessionalRegistration | null>(null);
  const [action, setAction] = useState<'approve' | 'reject' | 'revoke' | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try { setRows(await listProfessionalRegistrations(accessToken, status, query)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load registration requests.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (canManage) void load(); }, [accessToken, canManage, status, query]);

  async function submitDecision() {
    if (!selected || !action || (action !== 'approve' && !message.trim()) || busy) return;
    setBusy(true); setError('');
    try { await decideProfessionalRegistration(accessToken, selected.id!, action, message); setAction(null); setSelected(null); setMessage(''); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save the registration decision.'); }
    finally { setBusy(false); }
  }

  const visibleRows = rows.filter((row) => status === 'all' || row.status === status);
  return <div className="professional-registration-admin">
    <div className="professional-registration-toolbar">
      <label className="settings-field-label" htmlFor="professional-registration-search">Search registrations</label>
      <input id="professional-registration-search" className="settings-field-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Username, email, institute, or credential ID" autoComplete="off" />
      <label className="settings-field-label" htmlFor="professional-registration-status">Status</label>
      <select id="professional-registration-status" className="settings-field-input" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
        {['pending', 'registered', 'rejected', 'cancelled', 'revoked', 'all'].map((value) => <option key={value} value={value}>{value === 'all' ? 'All statuses' : value.charAt(0).toUpperCase() + value.slice(1)}</option>)}
      </select>
    </div>
    {loading ? <p className="settings-field-message" role="status">Loading registration requests…</p> : null}
    {!loading && visibleRows.length === 0 ? <p className="settings-field-message">No registration requests found.</p> : null}
    <div className="professional-registration-list" aria-live="polite">
      {visibleRows.map((row) => <ListRow key={row.id} avatar={<ProfileCard href={`/${encodeURIComponent(row.username)}/posts`} name={row.display_name || row.username} handle={`@${row.username}`} imageUrl={row.profile_picture_url} />} title={<span>{row.institute} · {row.credential_id}</span>} subtitle={`${row.email || 'No email'} · ${row.status}`} meta={row.created_at ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(row.created_at)) : 'Date unavailable'} trailing={row.status === 'pending' ? <span className="professional-registration-actions"><button className="button-primary" type="button" onClick={() => { setSelected(row); setAction('approve'); }}>Approve</button><button className="button-secondary" type="button" onClick={() => { setSelected(row); setAction('reject'); }}>Reject</button></span> : row.status === 'registered' ? <button className="button-secondary" type="button" onClick={() => { setSelected(row); setAction('revoke'); }}>Revoke</button> : null} className="settings-row settings-row-expanded professional-registration-row" />)}
    </div>
    {error ? <p className="settings-field-message" role="alert">{error}</p> : null}
    {selected && action ? <Modal title={`${action.charAt(0).toUpperCase() + action.slice(1)} registration`} onClose={() => { if (!busy) { setSelected(null); setAction(null); setMessage(''); } }} closeLabel="Close registration decision" actions={<><button className="button-secondary" type="button" onClick={() => { setSelected(null); setAction(null); setMessage(''); }} disabled={busy}>Cancel</button><button className="button-primary" type="button" onClick={() => void submitDecision()} disabled={busy || (action !== 'approve' && !message.trim())}>{busy ? 'Saving…' : `Confirm ${action}`}</button></>}><p className="settings-field-message">This decision takes effect immediately for the user.</p>{action !== 'approve' ? <><label className="settings-field-label" htmlFor="registration-decision-message">Message</label><textarea id="registration-decision-message" className="settings-field-input" value={message} onChange={(event) => setMessage(event.target.value)} placeholder={action === 'reject' ? 'Explain what the user should correct.' : 'Explain why registration is being revoked.'} rows={4} autoFocus /></> : <p className="settings-field-message">Approve {selected.display_name || selected.username} as a Friink Registered professional?</p>}</Modal> : null}
  </div>;
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
    let active = true;
    const timer = window.setTimeout(() => {
      listStaffUsers(accessToken, query).then((nextResults) => { if (active) setResults(nextResults); }).catch((err) => { if (active) setError(err.message); });
    }, query.trim() ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); };
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
  const selectedPlanName = plans.find((plan) => plan.code === planCode)?.name ?? planCode;
  const durationLabel = duration === 'none' ? 'No expiration' : duration === 'custom' ? 'Custom expiry' : `${duration} days`;
  const isRenewal = latest?.status === 'active' && latest.plan_code === planCode && duration !== 'none' && duration !== 'custom';
  const expiryLabel = duration === 'none' ? 'No expiration' : duration === 'custom' ? (customDate ? formatDate(new Date(`${customDate}T12:00:00`).toISOString()) : 'Choose a date') : isRenewal ? `${durationLabel} added to current expiry` : `${durationLabel} from today`;
  const currentAssignmentLabel = latest ? `${latest.plan_name} · ${latest.status} · ${formatDate(latest.expires_at)}` : 'Friink Free · No active assignment';
  const changeEffectLabel = isRenewal ? `Extends ${latest.plan_name} from its current expiry.` : latest?.status === 'active' ? `Replaces ${latest.plan_name} immediately.` : 'Creates a new manual assignment.';
  return <div className="subscription-admin control-panel-users">
    <div className="control-panel-users-intro">
      <div>
        <p className="control-panel-eyebrow">User access</p>
        <h2>Find a user</h2>
        <p>Search by username, email, or display name to review and manage plan access.</p>
      </div>
      <span className="control-panel-count" aria-live="polite">{results.length} result{results.length === 1 ? '' : 's'}</span>
    </div>
    <div className="control-panel-search">
      <label className="sr-only" htmlFor="staff-user-search">Search users</label>
      <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
      <input id="staff-user-search" type="text" value={query} onChange={(event) => { setSelected(null); setAssignments([]); setQuery(event.target.value); }} placeholder="Search username, email, or display name" autoComplete="off" />
      {query ? <button className="control-panel-search-clear" type="button" onClick={() => setQuery('')} aria-label="Clear user search"><i className="fa-solid fa-xmark" aria-hidden="true" /></button> : null}
    </div>
    <div className="subscription-admin-results" aria-live="polite">
      {results.length === 0 ? <div className="control-panel-empty"><i className="fa-solid fa-user-slash" aria-hidden="true" /><p>{query.trim().length < 2 ? 'Type at least 2 characters to search.' : 'No users found.'}</p></div> : results.map((user) => <ListRow key={user.id} title={`@${user.username}`} subtitle={user.display_name ? `${user.display_name} · ${user.email}` : user.email} meta={user.lifecycle_status === 'pending_deletion' ? `Scheduled for deletion${user.deletion_deadline ? ` on ${formatDate(user.deletion_deadline)}` : ''}` : user.lifecycle_status === 'deactivated' ? 'Deactivated' : user.account_locked ? 'Locked' : 'Active'} trailing={<button className="button-secondary" type="button" onClick={() => void chooseUser(user)}>Review</button>} className={`settings-row settings-row-expanded${selected?.id === user.id ? ' active' : ''}`} />)}
    </div>
    {selected ? <div className="subscription-admin-detail">
      <div className="subscription-admin-detail-heading"><div><p className="control-panel-eyebrow">Selected user</p><h3>@{selected.username}</h3><p>{selected.display_name ? `${selected.display_name} · ` : ''}{selected.email}</p></div><div className="subscription-admin-detail-actions"><span className="subscription-status-pill">{latest ? latest.status : 'Free default'}</span><Link className="button-secondary" href={`/${encodeURIComponent(selected.username)}/posts`}>Open profile</Link></div></div>
      <p className="settings-field-message">{latest ? `${latest.plan_name} · ${latest.status} · ${formatDate(latest.expires_at)}` : 'Friink Free · No expiration'}</p>
      {inactive ? <p className="settings-field-message" role="status">Plan actions are unavailable while this account is {selected.lifecycle_status.replace('_', ' ')}.</p> : null}
      {canManage && !inactive ? <div className="subscription-admin-actions"><button className="button-primary" type="button" onClick={() => { setPlanCode(latest?.plan_code ?? 'friink_pro'); setModal('adjust'); }}>Adjust plan</button>{latest?.status === 'active' && latest.plan_code !== 'friink_free' ? <button className="button-secondary" type="button" onClick={() => setModal('revoke')}>Return to Free</button> : null}</div> : null}
      {assignments.length > 0 ? <div className="subscription-assignment-history"><h4>Assignment history</h4>{assignments.map((assignment) => <p key={assignment.assignment_id}><strong>{assignment.plan_name}</strong> · {assignment.status} · {formatDate(assignment.starts_at)}–{formatDate(assignment.expires_at)}<br /><small>{assignment.reason || 'No reason recorded'}</small></p>)}</div> : null}
    </div> : null}
    {status ? <p className="settings-field-message" role="status">{status}</p> : null}
    {error ? <p className="settings-field-message" role="alert">{error}</p> : null}
    {modal === 'adjust' ? <Modal title="Adjust plan" onClose={() => setModal(null)} closeLabel="Close plan adjustment" actions={<><button className="button-secondary" type="button" onClick={() => setModal(null)} disabled={busy}>Cancel</button><button className="button-primary" type="button" onClick={() => void submitAdjust()} disabled={busy || !reason.trim() || (duration === 'custom' && !customDate)}>{busy ? 'Saving…' : 'Confirm change'}</button></>}><p className="settings-field-message">This change takes effect immediately. Manual access is not a payment.</p><div className="subscription-change-summary" aria-live="polite"><strong>Review access change</strong><span><b>User</b> @{selected?.username}</span><span><b>Plan</b> {selectedPlanName}</span><span><b>Access</b> {expiryLabel}</span><span><b>Current</b> {currentAssignmentLabel}</span><span><b>Effect</b> {changeEffectLabel}</span></div><label className="settings-field-label" htmlFor="subscription-plan">Plan</label><select id="subscription-plan" className="settings-field-input" value={planCode} onChange={(event) => setPlanCode(event.target.value)}>{plans.filter((plan) => plan.active).map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}</select><label className="settings-field-label" htmlFor="subscription-duration">Access duration</label><select id="subscription-duration" className="settings-field-input" value={duration} onChange={(event) => setDuration(event.target.value)}><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option><option value="custom">Custom expiry date</option><option value="none">No expiration</option></select>{duration === 'custom' ? <input id="subscription-custom-date" className="settings-field-input" type="date" min={new Date().toISOString().slice(0, 10)} value={customDate} onChange={(event) => setCustomDate(event.target.value)} /> : null}<label className="settings-field-label" htmlFor="subscription-reason">Reason</label><textarea id="subscription-reason" className="settings-field-input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is this access changing?" rows={3} /></Modal> : null}
    {modal === 'revoke' ? <Modal title="Return user to Free" onClose={() => setModal(null)} closeLabel="Close revoke confirmation" actions={<><button className="button-secondary" type="button" onClick={() => setModal(null)} disabled={busy}>Cancel</button><button className="button-primary" type="button" onClick={() => void submitRevoke()} disabled={busy || !reason.trim()}>{busy ? 'Saving…' : 'Confirm revoke'}</button></>}><p className="settings-field-message">Paid access ends immediately and the user returns to Friink Free.</p><label className="settings-field-label" htmlFor="revoke-reason">Reason</label><textarea id="revoke-reason" className="settings-field-input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why is access being revoked?" rows={3} /></Modal> : null}
  </div>;
}

export function ControlPanelScreen({ activeTab = 'overview', session }: { activeTab?: ControlPanelTab; session?: AuthSession | null }) {
  const content = tabContent[activeTab];
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [permissions, setPermissions] = useState<string[]>([]); const [overview, setOverview] = useState<StaffOverview | null>(null); const [overviewLoading, setOverviewLoading] = useState(false); const [password, setPassword] = useState(''); const [showPassword, setShowPassword] = useState(false); const [needsStepUp, setNeedsStepUp] = useState(false); const [staffReady, setStaffReady] = useState(false); const [verifyBusy, setVerifyBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setStaffReady(false); setError(null);
    if (!session) return () => { active = false; };
    staffMe(session.accessToken).then((value) => {
      if (!active) return;
      setPermissions(value.permissions); setNeedsStepUp(false); setStaffReady(true);
    }).catch((err) => {
      if (!active) return;
      setNeedsStepUp(err?.status === 401); setError(err?.message ?? 'Could not load staff access.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session]);
  useEffect(() => {
    let active = true;
    if (!session || !staffReady || needsStepUp || activeTab !== 'overview') return () => { active = false; };
    setOverviewLoading(true); setError(null);
    getStaffOverview(session.accessToken).then((value) => { if (active) setOverview(value); }).catch((err) => {
      if (!active) return;
      if (err?.status === 401) { setStaffReady(false); setNeedsStepUp(true); }
      else setError(err?.message ?? 'Could not load the Control Panel overview.');
    }).finally(() => { if (active) setOverviewLoading(false); });
    return () => { active = false; };
  }, [activeTab, needsStepUp, session, staffReady]);
  async function verify() { if (!session || verifyBusy) return; setVerifyBusy(true); setError(null); try { const value = await staffStepUp(session.accessToken, password); setPermissions(value.permissions); setNeedsStepUp(false); setStaffReady(true); setPassword(''); } catch (err: any) { setError(err.message); } finally { setVerifyBusy(false); } }
  if (loading) return <PageSurface className="simple-screen settings-screen" aria-label="Control panel loading"><div className="settings-panel"><p className="settings-field-message" role="status">Loading Control panel…</p></div></PageSurface>;
  if (needsStepUp) return <Modal title="Verify staff access" onClose={() => window.history.back()} closeLabel="Close staff verification" actions={<><button className="button-secondary" type="button" onClick={() => window.history.back()} disabled={verifyBusy}>Cancel</button><button className="button-primary" type="submit" form="staff-verification-form" disabled={verifyBusy || !password}>{verifyBusy ? 'Verifying…' : 'Verify'}</button></>}><form id="staff-verification-form" onSubmit={(event) => { event.preventDefault(); void verify(); }}><p className="settings-field-message">Your ordinary Friink session stays active. Verify again to open protected staff tools.</p><div className="settings-password-input"><input className="settings-field-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete="current-password" autoFocus aria-label="Staff password" /><button className="password-toggle" type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}><i className={`fa-regular ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" /></button></div>{error ? <p className="settings-field-message" role="alert">{error}</p> : null}</form></Modal>;
  if (error && !permissions.length) return <PageSurface className="simple-screen settings-screen" aria-label="Control panel unavailable"><div className="settings-panel"><p className="settings-field-message" role="alert">{error}</p><button className="button-secondary" type="button" onClick={() => window.location.reload()}>Retry</button></div></PageSurface>;
  const allowed = (permission: string) => permissions.includes(permission);
  if (!permissions.length) return <PageSurface className="simple-screen settings-screen" aria-label="No staff access"><div className="settings-panel"><p className="settings-field-message">Staff access has not yet been assigned to this account.</p></div></PageSurface>;

  return (
    <PageSurface className="simple-screen settings-screen" aria-label="Control panel content">
      <div className="settings-panel">
        <div className="settings-section" role="tabpanel" id={`control-panel-${activeTab}`} aria-label={content.title}>
          {(activeTab === 'users' || activeTab === 'staff') ? <p className="control-panel-search-prompt">Search for a user.</p> : null}
          {activeTab === 'professional-registration' && allowed('professional_registration.manage') && session ? <ProfessionalRegistrationAdmin accessToken={session.accessToken} canManage /> : null}
          {activeTab === 'overview' ? (overviewLoading ? <p className="settings-field-message" role="status">Loading overview…</p> : overview ? <div className="control-panel-overview-rows"><ListRow avatar={<span className="settings-icon"><i className="fa-solid fa-users" aria-hidden="true" /></span>} title="Total users" subtitle="All accounts currently recorded in Friink." trailing={<span className="control-panel-overview-number">{overview.total_users.toLocaleString()}</span>} className="settings-row settings-row-expanded control-panel-overview-row" /><ListRow avatar={<span className="settings-icon"><i className="fa-solid fa-user-shield" aria-hidden="true" /></span>} title="Staff users" subtitle="Accounts with staff access enabled." trailing={<span className="control-panel-overview-number">{overview.staff_users.toLocaleString()}</span>} className="settings-row settings-row-expanded control-panel-overview-row" /></div> : null) : null}
          {(activeTab === 'staff' || activeTab === 'security' || activeTab === 'audit' || activeTab === 'public-site') ? content.items.map((item) => (
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
