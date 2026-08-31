"use client";

import { type FormEvent, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ConnectionsScreen } from '@/components/connections-screen';
import { SettingsScreen, type AppearanceMode } from '@/components/account-screens';
import { ProfileScreen } from '@/components/profile-screen';
import { StarredScreen } from '@/components/starred-screen';
import { Header } from '@/components/header';
import { NavigationBar } from '@/components/navigationbar';
// legacy TabBar removed
import { Tabs } from './tabs';
import { ContentBox } from '@/components/content-box';
import { HomeScreen } from '@/components/home-screen';
import { Composer } from '@/components/composer';
import { FloatingBar } from '@/components/floating-bar';
import { NotificationsScreen, type NotificationItem } from '@/components/notifications-screen';
import { MessagesScreen } from '@/components/screens';
import { SearchScreen } from '@/components/screens';
import { SideDrawer } from '@/components/side-drawer';
import { ToastStack, type ToastInput, type ToastMessage } from '@/components/toast-stack';
import { ProfileSetupWizard } from '@/components/profile-setup-wizard';
import { getPostPath } from '@/lib/post-path';
import { initialConnections, initialPosts, type Connection, type ConnectionRequest, type Post, type Screen } from '@/lib/data';
import {
  acceptFollowRequest,
  cancelFollowRequest,
  createPost,
  getConnectionStatus,
  listFollowers,
  listFollowing,
  listIncomingFollowRequests,
  listNotifications,
  listOutgoingFollowRequests,
  markAllNotificationsRead,
  getUnreadNotificationCount,
  listPosts,
  loadAuthSession,
  rejectFollowRequest,
  removeConnection,
  removeFollower,
  sendFollowRequest,
  type ApiConnectionUser,
  type ApiFollowRequest,
  type ApiNotification,
  type ApiPost,
  type AuthUser,
} from '@/lib/auth';

type AppShellProps = {
  user: AuthUser;
  onLogout: () => void;
  initialScreen?: Screen;
  profileUser?: AuthUser;
  children?: React.ReactNode;
  floatingBarContent?: React.ReactNode;
  showTabs?: boolean;
  showFloatingBar?: boolean;
  onUserChange?: (user: AuthUser) => void;
  profileStats?: { followers: number; following: number } | null;
  profileConnectionsBasePath?: string;
  connectionsUsername?: string;
  initialConnectionsFilter?: 'all' | 'followers' | 'following' | 'requests';
  initialHomeFilter?: 'all' | 'following';
  initialMessagesTab?: 'all' | 'muted' | 'requests';
  initialSettingsTab?: 'general' | 'profile' | 'account' | 'subscription' | 'privacy';
  profileTab?: 'posts' | 'replies';
  onProfileTabChange?: (tab: 'posts' | 'replies') => void;
};

type ComposeContext =
  | { kind: 'post' }
  | { kind: 'reply'; post: Post }
  | { kind: 'quote'; post: Post };

function getInitials(username: string) {
  return (
    username
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'FR'
  );
}

export function AppShell({ user, onLogout, initialScreen = 'home', profileUser, children, floatingBarContent, showTabs, showFloatingBar = true, onUserChange, profileStats, profileConnectionsBasePath, connectionsUsername, initialConnectionsFilter = 'all', initialHomeFilter = 'all', initialMessagesTab = 'all', initialSettingsTab = 'general', profileTab = 'posts', onProfileTabChange }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceMode>('system');
  const [activeScreen, setActiveScreen] = useState<Screen>(initialScreen);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [homeInjectedPost, setHomeInjectedPost] = useState<Post | null>(null);
  const [floatingDraft, setFloatingDraft] = useState('');
  const [floatingPostBusy, setFloatingPostBusy] = useState(false);
  const [composeContext, setComposeContext] = useState<ComposeContext>({ kind: 'post' });
  const [profileConnectionState, setProfileConnectionState] = useState<'self' | 'none' | 'requested' | 'following'>(profileUser ? 'none' : 'self');
  const [profileConnectionRequestId, setProfileConnectionRequestId] = useState<string | null>(null);
  const [connectionActionBusy, setConnectionActionBusy] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ConnectionRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [followers, setFollowers] = useState<Connection[]>([]);
  const [following, setFollowing] = useState<Connection[]>([]);
  const [requestActionBusyId, setRequestActionBusyId] = useState<string | null>(null);
  const [removeFollowerBusyHandle, setRemoveFollowerBusyHandle] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [homeFilter, setHomeFilter] = useState<'all' | 'following'>(initialHomeFilter);
  const [connectionsFilter, setConnectionsFilter] = useState<'all' | 'followers' | 'following' | 'requests'>(initialConnectionsFilter);
  const [messagesTab, setMessagesTab] = useState<'all' | 'muted' | 'requests'>(initialMessagesTab);
  const [settingsTab, setSettingsTab] = useState<'general' | 'profile' | 'account' | 'subscription' | 'privacy'>(initialSettingsTab);
  const [canGoBack, setCanGoBack] = useState(false);
  useEffect(() => setHomeFilter(initialHomeFilter), [initialHomeFilter]);
  useEffect(() => setConnectionsFilter(initialConnectionsFilter), [initialConnectionsFilter]);
  useEffect(() => setMessagesTab(initialMessagesTab), [initialMessagesTab]);
  useEffect(() => setSettingsTab(initialSettingsTab), [initialSettingsTab]);
  const sidebarActiveScreen: Screen = profileUser && activeScreen === 'profile' ? 'home' : activeScreen;
  const viewingOtherConnections = Boolean(connectionsUsername && connectionsUsername.toLowerCase() !== user.username.toLowerCase());
  const connectionsTabs = !viewingOtherConnections && user.isPrivate
    ? [
        { id: 'all', label: 'All' },
        { id: 'followers', label: 'Followers' },
        { id: 'following', label: 'Following' },
        { id: 'requests', label: 'Requests' },
      ]
    : [
        { id: 'all', label: 'All' },
        { id: 'followers', label: 'Followers' },
        { id: 'following', label: 'Following' },
      ];
  const hasContextualFloatingBar = floatingBarContent !== null && floatingBarContent !== undefined && floatingBarContent !== false;
  const hasComposerContext = composeContext.kind !== 'post';
  const shouldShowFloatingBar = showFloatingBar && (hasContextualFloatingBar || hasComposerContext || activeScreen === 'home' || activeScreen === 'profile' || (activeScreen === 'messages' && hasContextualFloatingBar));

  useEffect(() => {
    const updateBackAvailability = () => {
      setCanGoBack(window.history.length > 1);
    };

    updateBackAvailability();
    window.addEventListener('popstate', updateBackAvailability);
    return () => window.removeEventListener('popstate', updateBackAvailability);
  }, [activeScreen, pathname]);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const updateSidebarState = () => {
      const isMobile = mobileQuery.matches;
      if (isMobile) {
        setSidebarCollapsed(true);
        return;
      }

      // desktop: prefer saved cookie if present, otherwise default open
      try {
        const match = document.cookie.match(/(?:^|; )friink_sidebar_collapsed=([^;]+)/);
        if (match && match[1]) {
          setSidebarCollapsed(match[1] === '1');
          return;
        }
      } catch (e) {
        // ignore
      }

      setSidebarCollapsed(false);
    };

    updateSidebarState();
    mobileQuery.addEventListener('change', updateSidebarState);

    return () => mobileQuery.removeEventListener('change', updateSidebarState);
  }, []);

  // persist sidebar collapsed state to cookie
  function persistSidebarCollapsed(collapsed: boolean) {
    setSidebarCollapsed(collapsed);
    try {
      const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `friink_sidebar_collapsed=${collapsed ? '1' : '0'}; path=/; expires=${expires}; sameSite=Lax`;
    } catch (e) {
      // ignore
    }
  }

  // read persisted appearance from cookie (if present)
  useEffect(() => {
    try {
      const match = document.cookie.match(/(?:^|; )friink_appearance=([^;]+)/);
      if (match && match[1]) {
        const value = decodeURIComponent(match[1]);
        if (value === 'light' || value === 'dark' || value === 'system') {
          setAppearance(value as AppearanceMode);
        }
      }
    } catch (e) {
      // ignore cookie read errors
    }
  }, []);

  // persist appearance to cookie when changed via UI
  function persistAppearance(a: AppearanceMode) {
    setAppearance(a);
    try {
      const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = `friink_appearance=${encodeURIComponent(a)}; path=/; expires=${expires}; sameSite=Lax`;
    } catch (e) {
      // ignore cookie write errors
    }
  }

  function getPageTitle(screen: Screen) {
    switch (screen) {
      case 'home':
        return 'Home';
      case 'profile':
        return 'Profile';
      case 'connections':
        return 'Connections';
      case 'starred':
        return 'Starred';
      case 'search':
        return 'Search';
      case 'messages':
        return 'Chat';
      case 'notifications':
        return 'Notifications';
      case 'settings':
        return 'Settings';
      default:
        return 'Friink';
    }
  }

  function navigateTo(screen: Screen) {
    setActiveScreen(screen);
    // route to pages that have their own app route
    switch (screen) {
      case 'home':
        router.push('/home/explore');
        break;
      case 'profile':
        router.push(`/${user.username}`);
        break;
      case 'connections':
        router.push(`/${encodeURIComponent(user.username)}/connections`);
        break;
      case 'starred':
        router.push('/starred');
        break;
      case 'settings':
        router.push('/settings/general');
        break;
      case 'messages':
        router.push('/chat/all');
        break;
      case 'notifications':
        router.push('/notifications');
        break;
      case 'search':
        router.push('/search');
        break;
      default:
        break;
    }
  }

  function handleConnectionsFilterChange(filter: 'all' | 'followers' | 'following' | 'requests') {
    setConnectionsFilter(filter);
    const basePath = viewingOtherConnections
      ? `/${encodeURIComponent(connectionsUsername!)}/connections`
      : `/${encodeURIComponent(user.username)}/connections`;
    router.push(filter === 'all' ? basePath : `${basePath}/${filter}`, { scroll: false });
  }

  function handleHomeFilterChange(filter: 'all' | 'following') {
    setHomeFilter(filter);
    router.push(`/home/${filter === 'all' ? 'explore' : 'following'}`, { scroll: false });
  }

  function handleMessagesTabChange(tab: 'all' | 'muted' | 'requests') {
    setMessagesTab(tab);
    router.push(`/chat/${tab}`, { scroll: false });
  }

  function handleSettingsTabChange(tab: 'general' | 'profile' | 'account' | 'subscription' | 'privacy') {
    setSettingsTab(tab);
    router.push(`/settings/${tab}`, { scroll: false });
  }

  function addToast(input: ToastInput, tone: ToastMessage['tone'] = 'error') {
    const now = new Date();
    const toast = typeof input === 'string' ? { message: input, tone } : input;
    setToasts((current) => {
      if (current.some((item) => item.message === toast.message && item.title === toast.title && item.code === toast.code)) {
        return current;
      }
      return [
        ...current,
        {
          id: now.getTime(),
          ...toast,
          timestamp: now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
        },
      ];
    });
  }

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  useEffect(() => {
    listPosts({ limit: 40 })
      .then((page) => {
        setPosts(page.items.map(mapApiPost));
      })
      .catch(() => {
        // Keep the timeline empty when the API is not running.
      });
  }, []);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) return;

    listIncomingFollowRequests(session.accessToken)
      .then((requests) => {
        setIncomingRequests(requests.map((request) => mapApiFollowRequest(request, 'incoming')));
      })
      .catch(() => {
        // Connections still renders with demo data if the API is unavailable.
      });

    listOutgoingFollowRequests(session.accessToken)
      .then((requests) => {
        setOutgoingRequests(requests.map((request) => mapApiFollowRequest(request, 'outgoing')));
      })
      .catch(() => {
        setOutgoingRequests([]);
      });

    const viewingNotifications = activeScreen === 'notifications';

    listNotifications(session.accessToken, { limit: 40 })
      .then((page) => {
        const notificationItems = page.items.map(mapApiNotification);
        setNotifications(viewingNotifications ? notificationItems.map((notification) => ({ ...notification, tone: 'sage', unread: false })) : notificationItems);
      })
      .catch(() => {
        setNotifications([]);
      });

    if (viewingNotifications) {
      setUnreadNotificationCount(0);
      setNotifications((current) => current.map((notification) => ({ ...notification, tone: 'sage', unread: false })));
      markAllNotificationsRead(session.accessToken)
        .catch(() => {
          addToast('Could not mark notifications as read.');
          return getUnreadNotificationCount(session.accessToken)
            .then((response) => {
              setUnreadNotificationCount(response.count);
            })
            .catch(() => {
              setUnreadNotificationCount(0);
            });
        });
    } else {
      getUnreadNotificationCount(session.accessToken)
        .then((response) => {
          setUnreadNotificationCount(response.count);
        })
        .catch(() => {
          setUnreadNotificationCount(0);
        });
    }

    const targetUsername = viewingOtherConnections ? connectionsUsername! : user.username;
    listFollowers(targetUsername)
      .then((response) => {
        setFollowers(response.users.map((connectionUser) => mapConnectionUser(connectionUser, 'follower')));
      })
      .catch(() => {
        setFollowers([]);
      });

    listFollowing(targetUsername)
      .then((response) => {
        setFollowing(response.users.map((connectionUser) => mapConnectionUser(connectionUser, 'following')));
      })
      .catch(() => {
        setFollowing([]);
      });
  }, [activeScreen, connectionsUsername, viewingOtherConnections]);

  useEffect(() => {
    const viewedUser = profileUser ?? user;
    if (!profileUser || viewedUser.username === user.username) {
      setProfileConnectionState('self');
      setProfileConnectionRequestId(null);
      return;
    }

    const session = loadAuthSession();
    if (!session) {
      setProfileConnectionState('none');
      setProfileConnectionRequestId(null);
      return;
    }

    getConnectionStatus(session.accessToken, viewedUser.username)
      .then((statusResponse) => {
        setProfileConnectionState(statusResponse.state);
        setProfileConnectionRequestId(statusResponse.request?.id ?? null);
      })
      .catch((error) => {
        setProfileConnectionState('none');
        setProfileConnectionRequestId(null);
        addToast(error instanceof Error ? error.message : 'Could not load connection state.');
      });
  }, [profileUser, user]);

  useEffect(() => {
    if (!user.isPrivate && connectionsFilter === 'requests') {
      setConnectionsFilter('all');
    }
  }, [connectionsFilter, user.isPrivate]);

  useEffect(() => {
    if (activeScreen !== 'profile' || composeContext.kind !== 'post') return;
    if (!profileUser || profileUser.username === user.username) return;
    if (floatingDraft.trim().length > 0) return;

    setFloatingDraft(`@${profileUser.username} `);
  }, [activeScreen, composeContext.kind, floatingDraft, profileUser, user.username]);

  function handleReply(post: Post) {
    setComposeContext({ kind: 'reply', post });
  }

  function handleQuote(post: Post) {
    setComposeContext({ kind: 'quote', post });
  }

  async function handleFloatingPost(event: FormEvent<HTMLFormElement>, media: File[]) {
    event.preventDefault();

    const trimmedText = floatingDraft.trim();
    if (!trimmedText && composeContext.kind !== 'quote') return;

    const session = loadAuthSession();
    if (!session) {
      addToast('Please log in again to post.');
      return false;
    }

    setFloatingPostBusy(true);
    try {
      const apiPost = await createPost(session.accessToken, {
        kind: composeContext.kind,
        content: trimmedText,
        quotedPostId: composeContext.kind === 'quote' ? composeContext.post.id : null,
        parentPostId: composeContext.kind === 'reply' ? composeContext.post.id : null,
        media,
      });
      const newPost = mapApiPost(apiPost);
      if (newPost.kind !== 'reply') {
        setPosts((current) => [newPost, ...current]);
        setHomeInjectedPost(newPost);
      }
      setFloatingDraft('');
      setComposeContext({ kind: 'post' });
      addToast('Post published.', 'success');
      if (newPost.kind !== 'reply') {
        setHomeFilter('all');
        setActiveScreen('home');
        router.push('/home');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create post.';
      addToast(message);
      return false;
    } finally {
      setFloatingPostBusy(false);
    }
  }

  function openProfileSettings() {
    setSettingsTab('profile');
    router.push('/settings/profile');
  }

  function mapApiPost(post: ApiPost): Post {
    return {
      id: post.id,
      publicId: post.public_id,
      slug: post.slug,
      kind: post.kind,
      name: post.author_display_name || post.author_username,
      handle: `@${post.author_username}`,
      initials: getInitials(post.author_display_name || post.author_username),
      imageUrl: post.profile_picture_url,
      tone: 'mint',
      createdAt: post.created_at,
      text: post.content,
      connectionType: 'following',
      isConnection: true,
      isStarred: false,
      replies: post.reply_count,
      quotes: post.quote_count,
      reactions: 0,
      quotedPost: post.quoted_post
        ? {
            id: post.quoted_post.id,
            publicId: post.quoted_post.public_id,
            slug: post.quoted_post.slug,
            authorUsername: post.quoted_post.author_username,
            authorDisplayName: post.quoted_post.author_display_name,
            imageUrl: post.quoted_post.profile_picture_url,
            content: post.quoted_post.content,
            mediaCount: post.quoted_post.media_count,
            unavailable: post.quoted_post.unavailable,
          }
        : null,
    };
  }

  function mapApiFollowRequest(request: ApiFollowRequest, direction: 'incoming' | 'outgoing' = 'incoming'): ConnectionRequest {
    const connectionUser = direction === 'incoming' ? request.requester : request.recipient;
    return {
      id: request.id,
      name: connectionUser.username,
      handle: `@${connectionUser.username}`,
      initials: getInitials(connectionUser.username),
      status: 'pending',
      createdAt: request.created_at,
    };
  }

  function mapApiNotification(notification: ApiNotification): NotificationItem {
    const payload = notification.payload;
    const requesterUsername = typeof payload.requester_username === 'string' ? payload.requester_username : null;
    const recipientUsername = typeof payload.recipient_username === 'string' ? payload.recipient_username : null;
    const postAuthorUsername = typeof payload.post_author_username === 'string' ? payload.post_author_username : null;
    const postAuthorDisplayName = typeof payload.post_author_display_name === 'string' ? payload.post_author_display_name : null;
    const requesterName = typeof payload.requester_display_name === 'string' && payload.requester_display_name ? payload.requester_display_name : requesterUsername;
    const recipientName = typeof payload.recipient_display_name === 'string' && payload.recipient_display_name ? payload.recipient_display_name : recipientUsername;
    const actorName = postAuthorDisplayName || requesterName || recipientName || 'Friink';
    const actorHandle = postAuthorUsername || requesterUsername || recipientUsername || 'friink';
    const postPublicId = typeof payload.post_public_id === 'string' ? payload.post_public_id : null;
    const postSlug = typeof payload.post_slug === 'string' ? payload.post_slug : '';
    const notificationHref = notification.type === 'mention' && postAuthorUsername && postPublicId
      ? getPostPath(postAuthorUsername, postSlug, postPublicId)
      : undefined;
    return {
      id: notification.id,
      kind: notification.type === 'mention' ? 'mention' : notification.type.includes('request') ? 'request' : 'follow',
      name: actorName || 'Friink',
      handle: `@${actorHandle}`,
      text: getNotificationText(notification.type, requesterUsername, recipientUsername, actorName, actorHandle),
      createdAt: notification.created_at,
      initials: getInitials(actorName || actorHandle),
      tone: notification.read ? 'sage' : 'mint',
      unread: !notification.read,
      href: notificationHref,
    };
  }

  function getNotificationText(type: ApiNotification['type'], requesterUsername: string | null, recipientUsername: string | null, actorName: string, actorHandle: string) {
    switch (type) {
      case 'mention':
        return `${actorName} (@${actorHandle}) mentioned you.`;
      case 'follow_sent_public':
        return recipientUsername ? `You are now following @${recipientUsername}.` : 'You are now following this profile.';
      case 'new_follower':
        return requesterUsername ? `@${requesterUsername} started following you.` : 'Someone started following you.';
      case 'request_sent':
        return recipientUsername ? `You requested to follow @${recipientUsername}.` : 'You sent a follow request.';
      case 'request_received':
        return requesterUsername ? `@${requesterUsername} requested to follow you.` : 'Someone requested to follow you.';
      case 'unfollow_confirmed':
        return recipientUsername ? `You unfollowed @${recipientUsername}.` : 'You unfollowed this profile.';
      case 'request_accepted':
      default:
        return recipientUsername ? `You are now following @${recipientUsername}.` : 'Your follow request was accepted.';
    }
  }

  function mapConnectionUser(connectionUser: ApiConnectionUser, relationship: 'follower' | 'following') {
    return {
      id: connectionUser.id,
      name: connectionUser.username,
      handle: `@${connectionUser.username}`,
      initials: getInitials(connectionUser.username),
      tone: connectionUser.is_private ? 'sage' : 'mint',
      relationship,
      status: 'connected' as const,
    };
  }

  function getConnectionsForFilter() {
    const liveConnections = mergeConnections(followers, following);

    if (connectionsFilter === 'followers') {
      return followers;
    }

    if (connectionsFilter === 'following') {
      return following;
    }

    if (connectionsFilter === 'requests') {
      return [];
    }

    return liveConnections;
  }

  function mergeConnections(left: Connection[], right: Connection[]) {
    const merged = new Map<string, Connection>();

    for (const connection of [...left, ...right]) {
      const existing = merged.get(connection.handle);
      if (existing) {
        merged.set(connection.handle, {
          ...existing,
          relationship: existing.relationship === connection.relationship ? existing.relationship : 'mutual',
        });
      } else {
        merged.set(connection.handle, connection);
      }
    }

    return [...merged.values()];
  }

  async function handleFollowProfile() {
    if (!profileUser) return;
    const session = loadAuthSession();
    if (!session) {
      addToast('Please log in again to follow people.');
      return;
    }

    setConnectionActionBusy(true);
    try {
      const request = await sendFollowRequest(session.accessToken, profileUser.username);
      setProfileConnectionState(request.status === 'accepted' ? 'following' : 'requested');
      setProfileConnectionRequestId(request.id);
      if (request.status === 'pending') {
        setOutgoingRequests((current) => [mapApiFollowRequest(request, 'outgoing'), ...current]);
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not send follow request.');
    } finally {
      setConnectionActionBusy(false);
    }
  }

  async function handleCancelProfileRequest() {
    const session = loadAuthSession();
    if (!session || !profileConnectionRequestId) return;

    setConnectionActionBusy(true);
    try {
      await cancelFollowRequest(session.accessToken, profileConnectionRequestId);
      setProfileConnectionState('none');
      setProfileConnectionRequestId(null);
      setOutgoingRequests((current) => current.filter((request) => request.id !== profileConnectionRequestId));
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not cancel follow request.');
    } finally {
      setConnectionActionBusy(false);
    }
  }

  async function handleUnfollowProfile() {
    const session = loadAuthSession();
    if (!session || !profileConnectionRequestId) return;

    setConnectionActionBusy(true);
    try {
      await removeConnection(session.accessToken, profileConnectionRequestId);
      setProfileConnectionState('none');
      setProfileConnectionRequestId(null);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not remove connection.');
    } finally {
      setConnectionActionBusy(false);
    }
  }

  async function handleAcceptRequest(requestId: string) {
    const session = loadAuthSession();
    if (!session) return;

    setRequestActionBusyId(requestId);
    try {
      await acceptFollowRequest(session.accessToken, requestId);
      setIncomingRequests((current) => current.filter((request) => request.id !== requestId));
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not accept request.');
    } finally {
      setRequestActionBusyId(null);
    }
  }

  async function handleRejectRequest(requestId: string) {
    const session = loadAuthSession();
    if (!session) return;

    setRequestActionBusyId(requestId);
    try {
      await rejectFollowRequest(session.accessToken, requestId);
      setIncomingRequests((current) => current.filter((request) => request.id !== requestId));
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not reject request.');
    } finally {
      setRequestActionBusyId(null);
    }
  }

  async function handleCancelSentRequest(requestId: string) {
    const session = loadAuthSession();
    if (!session) return;

    setRequestActionBusyId(requestId);
    try {
      await cancelFollowRequest(session.accessToken, requestId);
      setOutgoingRequests((current) => current.filter((request) => request.id !== requestId));
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not cancel request.');
    } finally {
      setRequestActionBusyId(null);
    }
  }

  async function handleRemoveFollower(username: string) {
    const session = loadAuthSession();
    if (!session) return;

    setRemoveFollowerBusyHandle(`@${username}`);
    try {
      await removeFollower(session.accessToken, username);
      setFollowers((current) => current.filter((connection) => connection.handle !== `@${username}`));
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not remove follower.');
    } finally {
      setRemoveFollowerBusyHandle(null);
    }
  }

  return (
    <main className="app-shell" data-theme={appearance}>
      <div className="app-layout">
        <SideDrawer
          user={user}
          activeScreen={sidebarActiveScreen}
          collapsed={sidebarCollapsed}
          onNavigate={navigateTo}
          onToggleCollapsed={() => persistSidebarCollapsed(!sidebarCollapsed)}
          onLogout={onLogout}
        />

        <Header
          onNavigate={navigateTo}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => persistSidebarCollapsed(!sidebarCollapsed)}
          notificationCount={unreadNotificationCount}
          notifications={notifications}
        />

        <section className="main-panel">
          <div className="mobile-page-navigation">
            <NavigationBar
              title={getPageTitle(activeScreen)}
              onBack={() => router.back()}
              backDisabled={!canGoBack}
            />
          </div>

          <div className="main-content">
            {showTabs !== false && activeScreen === 'home' && (
              <Tabs
                tabs={[
                  { id: 'all', label: 'Explore' },
                  { id: 'following', label: 'Following' },
                ]}
                activeId={homeFilter}
                onChange={(id) => handleHomeFilterChange(id as 'all' | 'following')}
                ariaLabel="Home quick tabs"
              />
            )}
            {showTabs !== false && activeScreen === 'connections' && (
              <Tabs
                tabs={connectionsTabs}
                activeId={connectionsFilter}
                onChange={(id) => handleConnectionsFilterChange(id as 'all' | 'followers' | 'following' | 'requests')}
                ariaLabel="Connections filters"
              />
            )}
            {showTabs !== false && activeScreen === 'messages' && (
              <Tabs
                tabs={[
                  { id: 'all', label: 'All' },
                  { id: 'muted', label: 'Muted' },
                  { id: 'requests', label: 'Requests' },
                ]}
                activeId={messagesTab}
                onChange={(id) => handleMessagesTabChange(id as 'all' | 'muted' | 'requests')}
                ariaLabel="Chat filters"
              />
            )}
            {showTabs !== false && activeScreen === 'settings' && (
              <Tabs
                tabs={[
                  { id: 'general', label: 'General' },
                  { id: 'profile', label: 'Profile' },
                  { id: 'account', label: 'Account' },
                  { id: 'subscription', label: 'Subscription' },
                  { id: 'privacy', label: 'Privacy & Safety' },
                ]}
                activeId={settingsTab}
                onChange={(id) => handleSettingsTabChange(id as 'general' | 'profile' | 'account' | 'subscription' | 'privacy')}
                ariaLabel="Settings sections"
              />
            )}
            <ContentBox>
              {children ? (
                children
              ) : (
                <>
                  {activeScreen === 'home' && (
                    <HomeScreen
                      posts={posts}
                      activeFilter={homeFilter}
                      onFilterChange={(id) => handleHomeFilterChange(id as 'all' | 'following')}
                      onReply={handleReply}
                      onQuote={handleQuote}
                      injectedPost={homeInjectedPost}
                      onInjectedPostConsumed={() => setHomeInjectedPost(null)}
                    />
                  )}
                  {activeScreen === 'profile' && (
                    <ProfileScreen
                      user={profileUser ?? user}
                      posts={posts}
                      profileStats={profileStats}
                      profileConnectionsBasePath={profileConnectionsBasePath}
                      isOwnProfile={!profileUser}
                      onReply={handleReply}
                      onQuote={handleQuote}
                      onEditProfile={openProfileSettings}
                      initialTab={profileTab}
                      onTabChange={onProfileTabChange}
                      connectionState={profileConnectionState}
                      connectionActionBusy={connectionActionBusy}
                      onFollow={handleFollowProfile}
                      onCancelRequest={handleCancelProfileRequest}
                      onUnfollow={handleUnfollowProfile}
                    />
                  )}
                  {activeScreen === 'connections' && (
                    <ConnectionsScreen
                      connections={getConnectionsForFilter()}
                      activeFilter={connectionsFilter}
                      onFilterChange={(id) => handleConnectionsFilterChange(id as 'all' | 'following' | 'followers' | 'requests')}
                      incomingRequests={incomingRequests}
                      outgoingRequests={outgoingRequests}
                      requestActionBusyId={requestActionBusyId}
                      onAcceptRequest={handleAcceptRequest}
                      onRejectRequest={handleRejectRequest}
                      onCancelRequest={handleCancelSentRequest}
                      onRemoveFollower={viewingOtherConnections ? undefined : handleRemoveFollower}
                      removeFollowerBusyHandle={removeFollowerBusyHandle}
                    />
                  )}
                  {activeScreen === 'starred' && <StarredScreen posts={posts} onReply={handleReply} onQuote={handleQuote} />}
                  {activeScreen === 'search' && <SearchScreen />}
                  {activeScreen === 'notifications' && <NotificationsScreen notifications={notifications} />}
                  {activeScreen === 'settings' && (
                    <SettingsScreen
                      user={user}
                      appearance={appearance}
                      onAppearanceChange={(a) => persistAppearance(a)}
                      activeTab={settingsTab}
                      onTabChange={(id) => handleSettingsTabChange(id as 'general' | 'profile' | 'account' | 'subscription' | 'privacy')}
                      onUserChange={onUserChange}
                      onToast={addToast}
                    />
                  )}
                  {activeScreen === 'messages' && <MessagesScreen activeTab={messagesTab} />}
                </>
              )}
            </ContentBox>
          </div>
        </section>

        {shouldShowFloatingBar && (
          <FloatingBar>
            {hasContextualFloatingBar ? (
              floatingBarContent
            ) : (
              <Composer
                draft={floatingDraft}
                onDraftChange={setFloatingDraft}
                onSend={handleFloatingPost}
                disabled={floatingPostBusy}
                multiline
                placeholder={composeContext.kind === 'reply' ? 'Write a reply...' : composeContext.kind === 'quote' ? 'Add your quote...' : 'Write a post...'}
                disabledPlaceholder="Posting..."
                inputLabel="Post"
                sendLabel="Post"
                maxLength={256}
                draftStorageKey={`friink-draft:${user.id}:floating:${composeContext.kind}:${composeContext.kind === 'post' ? 'new' : composeContext.post.id}`}
                showCount
                allowEmptySubmit={composeContext.kind === 'quote'}
                enableMentions
                contextLabel={composeContext.kind === 'reply' ? `Replying to ${composeContext.post.name}` : composeContext.kind === 'quote' ? `Quoting ${composeContext.post.name}` : null}
                referencedPreview={composeContext.kind === 'reply' || composeContext.kind === 'quote' ? {
                  name: composeContext.post.name,
                  handle: composeContext.post.handle,
                  initials: composeContext.post.initials,
                  tone: composeContext.post.tone,
                  imageUrl: composeContext.post.imageUrl,
                  text: composeContext.post.text,
                  mediaCount: 0,
                } : null}
                onClearContext={composeContext.kind === 'reply' || composeContext.kind === 'quote' ? () => setComposeContext({ kind: 'post' }) : undefined}
              />
            )}
          </FloatingBar>
        )}
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
        <ProfileSetupWizard user={user} onUserChange={onUserChange ?? (() => undefined)} onToast={(message) => addToast(message)} />
      </div>
    </main>
  );
}
