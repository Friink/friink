 'use client';

import { useState } from 'react';
import { TabBar } from '@/components/tab-bar';
import type { Connection } from '@/lib/data';

type ConnectionsScreenProps = {
  connections: Connection[];
};

type ConnectionFilter = 'all' | 'followers' | 'following' | 'requests';

const filters: { id: ConnectionFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'followers', label: 'Followers' },
  { id: 'following', label: 'Following' },
  { id: 'requests', label: 'Requests' },
];

export function ConnectionsScreen({ connections }: ConnectionsScreenProps) {
  const [activeFilter, setActiveFilter] = useState<ConnectionFilter>('all');
  const [pendingConnections, setPendingConnections] = useState(connections);
  const visibleConnections = pendingConnections.filter((connection) => {
    if (activeFilter === 'requests') return connection.status === 'request';
    if (activeFilter === 'followers') return connection.status === 'connected' && ['follower', 'mutual'].includes(connection.relationship);
    if (activeFilter === 'following') return connection.status === 'connected' && ['following', 'mutual'].includes(connection.relationship);
    return connection.status === 'connected';
  });

  function removeRequest(id: number) {
    setPendingConnections((current) => current.filter((connection) => connection.id !== id));
  }

  return (
    <div className="connections-screen">
      <TabBar
        tabs={filters}
        activeId={activeFilter}
        onChange={(id) => setActiveFilter(id as ConnectionFilter)}
        containerClass="tab-bar connection-tabs"
        itemClass="tab-bar__item connection-tab"
        ariaLabel="Connection lists"
      />

      <div className="connection-list">
        {visibleConnections.length > 0 ? (
          visibleConnections.map((connection) => (
            <article className="connection-row" key={connection.id}>
              <span className={`user-avatar avatar-${connection.tone}`}>{connection.initials}</span>
              <div className="connection-person">
                <strong>{connection.name}</strong>
                <small>{connection.handle}</small>
              </div>
              {activeFilter === 'all' && (
                <button
                  className="icon-button connection-add"
                  type="button"
                  aria-label={`Add ${connection.name}`}
                >
                  <i className="fa-solid fa-user-plus" aria-hidden="true" />
                </button>
              )}
            </article>
          ))
        ) : (
          <div className="connections-empty">
            <i className="fa-solid fa-users" aria-hidden="true" />
            <p>No people here yet.</p>
            <span>New connection activity will appear here.</span>
          </div>
        )}
      </div>
    </div>
  );
}
