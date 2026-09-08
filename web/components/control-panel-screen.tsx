'use client';

import { useState } from 'react';

const tabs = [
  { id: 'overview', label: 'Overview', icon: 'fa-solid fa-chart-line' },
  { id: 'users', label: 'Users & Accounts', icon: 'fa-solid fa-users' },
  { id: 'roles', label: 'Roles & Permissions', icon: 'fa-solid fa-user-shield' },
  { id: 'security', label: 'Security & Sessions', icon: 'fa-solid fa-shield-halved' },
  { id: 'audit', label: 'Audit Log', icon: 'fa-solid fa-list-check' },
] as const;

const tabCopy: Record<(typeof tabs)[number]['id'], { title: string; description: string; cards: string[] }> = {
  overview: { title: 'Staff overview', description: 'A quick view of the platform areas you can administer.', cards: ['Active staff sessions', 'Locked accounts', 'Recent security events'] },
  users: { title: 'Users & accounts', description: 'Search users and review account access without exposing private credentials.', cards: ['Search users', 'Account status', 'Roles and direct permissions'] },
  roles: { title: 'Roles & permissions', description: 'Manage role capabilities and narrowly scoped direct grants.', cards: ['Predefined roles', 'Permission catalog', 'Individual grants'] },
  security: { title: 'Security & sessions', description: 'Review privileged access and account-session security actions.', cards: ['Privileged sessions', 'Account locks', 'Session revocation'] },
  audit: { title: 'Audit log', description: 'Review redacted, server-recorded staff and security activity.', cards: ['Role changes', 'Account actions', 'Privileged-session events'] },
};

export function ControlPanelScreen() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['id']>('overview');
  const content = tabCopy[activeTab];

  return (
    <section className="control-panel" aria-labelledby="control-panel-title">
      <div className="control-panel-header">
        <div>
          <p className="control-panel-eyebrow">Staff workspace</p>
          <h1 id="control-panel-title">Control panel</h1>
          <p>{content.description}</p>
        </div>
        <span className="control-panel-status"><i className="fa-solid fa-lock" aria-hidden="true" /> Privileged workspace</span>
      </div>

      <div className="control-panel-tabs" role="tablist" aria-label="Control panel sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`control-panel-tab${activeTab === tab.id ? ' active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`control-panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <i className={tab.icon} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="control-panel-content" id={`control-panel-${activeTab}`} role="tabpanel">
        <div className="control-panel-section-heading">
          <div><p className="control-panel-eyebrow">Current section</p><h2>{content.title}</h2></div>
          <span className="control-panel-placeholder">Backend actions coming next</span>
        </div>
        <div className="control-panel-cards">
          {content.cards.map((card) => <article className="control-panel-card" key={card}><span className="control-panel-card-icon"><i className="fa-regular fa-circle" aria-hidden="true" /></span><div><h3>{card}</h3><p>This area will be connected to the server-authorized Phase 5 workflow.</p></div></article>)}
        </div>
      </div>
    </section>
  );
}
