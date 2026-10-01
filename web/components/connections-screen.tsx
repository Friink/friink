'use client';

import { ListRow } from '@/components/list-row';
import { PageSurface } from '@/components/page-surface';
import { ProfileCard } from '@/components/profile-card';
import type { Connection, ConnectionRequest } from '@/lib/data';

function profileHref(handle: string) {
  return `/${handle.replace('@', '')}`;
}

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
  onUnfollow?: (username: string) => void;
  onRemoveFollower?: (username: string) => void;
  unfollowBusyHandle?: string | null;
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
  onUnfollow,
  onRemoveFollower,
  unfollowBusyHandle = null,
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
            {incomingRequests.length > 0 ? <h2 className="connection-request-section-title">Incoming</h2> : null}
            {incomingRequests.map((request) => (
              <ListRow
                key={`incoming-${request.id}`}
                title={<ProfileCard name={request.name} handle={request.handle} tone="mint" initials={request.initials} href={profileHref(request.handle)} showProfessionalBadge={request.showProfessionalBadge} />}
                trailing={
                  <span className="connection-request-actions">
                    <button className="icon-button" type="button" aria-label={`Accept ${request.name}`} title="Accept" disabled={requestActionBusyId === request.id} onClick={() => onAcceptRequest?.(request.id)}>
                      <i className="fa-solid fa-check" aria-hidden="true" />
                    </button>
                    <button className="icon-button" type="button" aria-label={`Reject ${request.name}`} title="Reject" disabled={requestActionBusyId === request.id} onClick={() => onRejectRequest?.(request.id)}>
                      <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                  </span>
                }
              />
            ))}
            {outgoingRequests.length > 0 ? <h2 className="connection-request-section-title">Sent</h2> : null}
            {outgoingRequests.map((request) => (
              <ListRow
                key={`outgoing-${request.id}`}
                title={<ProfileCard name={request.name} handle={request.handle} tone="sage" initials={request.initials} href={profileHref(request.handle)} showProfessionalBadge={request.showProfessionalBadge} />}
                subtitle="Request sent"
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
              title={<ProfileCard name={connection.name} handle={connection.handle} tone={connection.tone} initials={connection.initials} href={profileHref(connection.handle)} showProfessionalBadge={connection.showProfessionalBadge} />}
              trailing={(() => {
                const username = connection.handle.replace('@', '');
                const canUnfollow = ['following', 'mutual'].includes(connection.relationship) && !!onUnfollow;
                const canRemoveFollower = ['follower', 'mutual'].includes(connection.relationship) && !!onRemoveFollower;
                const rowBusy = unfollowBusyHandle === connection.handle || removeFollowerBusyHandle === connection.handle;
                if (!canUnfollow && !canRemoveFollower) return null;
                return (
                  <span className="connection-request-actions">
                    {canUnfollow ? (
                      <button className="icon-button" type="button" aria-label={`Unfollow ${connection.name}`} title="Unfollow" disabled={rowBusy} onClick={() => onUnfollow?.(username)}>
                        <i className="fa-solid fa-user-minus" aria-hidden="true" />
                      </button>
                    ) : null}
                    {canRemoveFollower ? (
                      <button className="icon-button" type="button" aria-label={`Remove follower ${connection.name}`} title="Remove follower" disabled={rowBusy} onClick={() => onRemoveFollower?.(username)}>
                        <i className="fa-solid fa-user-xmark" aria-hidden="true" />
                      </button>
                    ) : null}
                  </span>
                );
              })()}
            />
          ))
        ) : (
          <div className="connections-empty">
            <i className="fa-solid fa-users" aria-hidden="true" />
            <p>{isRequestsView ? 'No pending requests.' : 'No people here yet.'}</p>
            <span>{isRequestsView ? 'Incoming follow requests will appear here.' : 'Your connections will appear here.'}</span>
          </div>
        )}
      </div>
    </PageSurface>
  );
}
