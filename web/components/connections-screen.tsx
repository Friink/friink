 'use client';

import { useState } from 'react';
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
            <article className="connection-row" key={request.id}>
              <span className="user-avatar avatar-mint">{request.initials}</span>
              <div className="connection-person">
                <strong>{request.name}</strong>
                <small>{request.handle}</small>
              </div>
              <div className="connection-request-actions">
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
              </div>
            </article>
          ))
        ) : visibleConnections.length > 0 ? (
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
            <p>{isRequestsView ? 'No pending requests.' : 'No people here yet.'}</p>
            <span>{isRequestsView ? 'Incoming follow requests will appear here.' : 'New connection activity will appear here.'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
