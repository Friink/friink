 'use client';

import { useState } from 'react';
import { ListRow } from '@/components/list-row';
import type { Connection, ConnectionRequest } from '@/lib/data';

type ConnectionsScreenProps = {
  connections: Connection[];
  activeFilter?: 'all' | 'followers' | 'following' | 'requests';
  onFilterChange?: (id: string) => void;
  incomingRequests?: ConnectionRequest[];
  requestActionBusyId?: string | null;
  onAcceptRequest?: (id: string) => void;
  onRejectRequest?: (id: string) => void;
};

export function ConnectionsScreen({
  connections,
  activeFilter = 'all',
  incomingRequests = [],
  requestActionBusyId = null,
  onAcceptRequest,
  onRejectRequest,
}: ConnectionsScreenProps) {
  const [pendingConnections, setPendingConnections] = useState(connections);
  const isRequestsView = activeFilter === 'requests';
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
      <div className="connection-list">
        {isRequestsView && incomingRequests.length > 0 ? (
          incomingRequests.map((request) => (
            <ListRow
              key={request.id}
              avatar={<span className="user-avatar avatar-mint">{request.initials}</span>}
              title={request.name}
              subtitle={request.handle}
              trailing={
                <span className="connection-request-actions">
                  <button
                    className="profile-action-button connection-accept"
                    type="button"
                    disabled={requestActionBusyId === request.id}
                    onClick={() => onAcceptRequest?.(request.id)}
                  >
                    Accept
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Reject ${request.name}`}
                    disabled={requestActionBusyId === request.id}
                    onClick={() => onRejectRequest?.(request.id)}
                  >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                  </button>
                </span>
              }
            />
          ))
        ) : visibleConnections.length > 0 ? (
          visibleConnections.map((connection) => (
            <ListRow
              key={connection.id}
              avatar={<span className={`user-avatar avatar-${connection.tone}`}>{connection.initials}</span>}
              title={connection.name}
              subtitle={connection.handle}
              trailing={
                activeFilter === 'all' ? (
                  <button
                    className="icon-button connection-add"
                    type="button"
                    aria-label={`Add ${connection.name}`}
                  >
                    <i className="fa-solid fa-user-plus" aria-hidden="true" />
                  </button>
                ) : null
              }
            />
          ))
        ) : (
          <div className="connections-empty">
            <i className="fa-solid fa-users" aria-hidden="true" />
            <p>{isRequestsView ? 'No pending requests.' : 'No people here yet.'}</p>
            <span>{isRequestsView ? 'Incoming follow requests will appear here.' : 'New connection activity will appear here.'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
