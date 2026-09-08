import { ListRow } from '@/components/list-row';
import { PageSurface } from '@/components/page-surface';

export type ControlPanelTab = 'overview' | 'users' | 'roles' | 'security' | 'audit';

const tabContent: Record<ControlPanelTab, { title: string; description: string; items: Array<{ icon: string; title: string; description: string; meta: string }> }> = {
  overview: {
    title: 'Overview',
    description: 'A calm starting point for staff-only administration.',
    items: [
      { icon: 'fa-solid fa-users', title: 'Users & accounts', description: 'Review account status, staff access, roles, and direct permissions.', meta: 'Phase 5b' },
      { icon: 'fa-solid fa-user-shield', title: 'Roles & permissions', description: 'Manage role capabilities and narrowly scoped individual grants.', meta: 'Phase 5b' },
      { icon: 'fa-solid fa-shield-halved', title: 'Security & sessions', description: 'Review privileged sessions, locks, and session revocation.', meta: 'Phase 5c–5d' },
    ],
  },
  users: {
    title: 'Users & accounts',
    description: 'Search and review accounts without exposing private credentials.',
    items: [
      { icon: 'fa-solid fa-magnifying-glass', title: 'Search users', description: 'Find an account by email, username, or display name.', meta: 'Planned' },
      { icon: 'fa-solid fa-user-check', title: 'Account status', description: 'Review lifecycle, verification, and staff status.', meta: 'Planned' },
      { icon: 'fa-solid fa-key', title: 'Access assignments', description: 'Review each user’s role and direct permission grants.', meta: 'Planned' },
    ],
  },
  roles: {
    title: 'Roles & permissions',
    description: 'Define reusable access while retaining precise user-level control.',
    items: [
      { icon: 'fa-solid fa-layer-group', title: 'Roles', description: 'Create and edit role names and their permission sets.', meta: 'Planned' },
      { icon: 'fa-solid fa-list-check', title: 'Permission catalog', description: 'Review the permissions available to staff roles.', meta: 'Planned' },
      { icon: 'fa-solid fa-user-plus', title: 'Individual grants', description: 'Add or revoke one permission for a single user.', meta: 'Planned' },
    ],
  },
  security: {
    title: 'Security & sessions',
    description: 'Keep privileged access reviewable and reversible.',
    items: [
      { icon: 'fa-solid fa-laptop', title: 'Privileged sessions', description: 'Review and revoke active staff sessions.', meta: 'Phase 5c' },
      { icon: 'fa-solid fa-lock', title: 'Account locks', description: 'Review lock state and apply authorized account actions.', meta: 'Phase 5d' },
      { icon: 'fa-solid fa-right-from-bracket', title: 'Session revocation', description: 'End sessions without changing account credentials.', meta: 'Phase 5c–5d' },
    ],
  },
  audit: {
    title: 'Audit log',
    description: 'Review redacted, server-recorded staff and security activity.',
    items: [
      { icon: 'fa-solid fa-user-gear', title: 'Access changes', description: 'Role and individual permission changes.', meta: 'Phase 5b' },
      { icon: 'fa-solid fa-user-lock', title: 'Account actions', description: 'Staff account, lock, and session actions.', meta: 'Phase 5d' },
      { icon: 'fa-solid fa-clock-rotate-left', title: 'Recent activity', description: 'Immutable events with sensitive values redacted.', meta: 'Phase 5b–5d' },
    ],
  },
};

export function ControlPanelScreen({ activeTab = 'overview' }: { activeTab?: ControlPanelTab }) {
  const content = tabContent[activeTab];

  return (
    <PageSurface variant="stack" aria-labelledby="control-panel-title">
      <div>
        <h1 id="control-panel-title">{content.title}</h1>
        <p>{content.description}</p>
      </div>
      <div className="settings-section" role="tabpanel" id={`control-panel-${activeTab}`} aria-label={content.title}>
        {content.items.map((item) => (
          <ListRow
            key={item.title}
            avatar={<span className="settings-icon"><i className={item.icon} aria-hidden="true" /></span>}
            title={item.title}
            subtitle={item.description}
            meta={item.meta}
            className="settings-row settings-row-expanded"
          />
        ))}
      </div>
    </PageSurface>
  );
}
