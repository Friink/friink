'use client';

import { ListRow } from '@/components/list-row';
import { PageSurface } from '@/components/page-surface';
import type { Connection, ConnectionRequest } from '@/lib/data';

type ConnectionsScreenProps = {
  connections: Connection[];
  activeFilter?: 'all' | 'followers' | 'following' | 'requests';
  onFilterChange?: (id: string) => void;
  incomingRequests?: ConnectionRequest[];
  outgoingRequests?: ConnectionRequest[];
  requestActionBusyId?: string | null;
  onAcceptRequest?: (id: string) => void;
  onRejectRequest?: (id: string) => void;
  onCancelRequest?: (id: string) => void;
  onRemoveFollower?: (username: string) => void;
  removeFollowerBusyHandle?: string | null;
};

export function ConnectionsScreen({
  connections,
  activeFilter = 'all',
  incomingRequests = [],
  outgoingRequests = [],
  requestActionBusyId = null,
  onAcceptRequest,
  onRejectRequest,
  onCancelRequest,
  onRemoveFollower,
  removeFollowerBusyHandle = null,
}: ConnectionsScreenProps) {
  const isRequestsView = activeFilter === 'requests';
  const visibleConnections = connections.filter((connection) => {
    if (activeFilter === 'requests') return connection.status === 'request';
    if (activeFilter === 'followers') return connection.status === 'connected' && ['follower', 'mutual'].includes(connection.relationship);
    if (activeFilter === 'following') return connection.status === 'connected' && ['following', 'mutual'].includes(connection.relationship);
    return connection.status === 'connected';
  });

  return (
    <PageSurface className="connections-screen" variant="list">
      <div className="connection-list">
        {isRequestsView && (incomingRequests.length > 0 || outgoingRequests.length > 0) ? (
          <>
            {incomingRequests.map((request) => (
              <ListRow
                key={`incoming-${request.id}`}
                avatar={<span className="user-avatar avatar-mint">{request.initials}</span>}
                title={request.name}
                subtitle={`${request.handle} requested to follow you`}
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
            ))}
            {outgoingRequests.map((request) => (
              <ListRow
                key={`outgoing-${request.id}`}
                avatar={<span className="user-avatar avatar-sage">{request.initials}</span>}
                title={request.name}
                subtitle={`Requested ${request.handle}`}
                trailing={
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Cancel request to ${request.name}`}
                    disabled={requestActionBusyId === request.id}
                    onClick={() => onCancelRequest?.(request.id)}
                  >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                  </button>
                }
              />
            ))}
          </>
        ) : visibleConnections.length > 0 ? (
          visibleConnections.map((connection) => (
            <ListRow
              key={connection.id}
              avatar={<span className={`user-avatar avatar-${connection.tone}`}>{connection.initials}</span>}
              title={connection.name}
              subtitle={connection.handle}
              trailing={
                activeFilter === 'followers' && onRemoveFollower ? (
                  <button
                    className="icon-button connection-add"
                    type="button"
                    aria-label={`Remove follower ${connection.name}`}
                    disabled={removeFollowerBusyHandle === connection.handle}
                    onClick={() => onRemoveFollower(connection.handle.replace('@', ''))}
                  >
                    <i className="fa-solid fa-user-minus" aria-hidden="true" />
                  </button>
                ) : activeFilter === 'all' ? (
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
    </PageSurface>
  );
}
