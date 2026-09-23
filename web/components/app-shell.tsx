"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ConnectionsScreen } from '@/components/connections-screen';
import { SettingsScreen, type AppearanceMode } from '@/components/account-screens';
import { ProfileScreen, type ProfileTab } from '@/components/profile-screen';
import { SavedScreen } from '@/components/saved-screen';
import { Header } from '@/components/header';
import { NavigationBar } from '@/components/navigationbar';
import { TopBar } from '@/components/top-bar';
import type { ActionMenuItem } from '@/components/action-menu';
// legacy TabBar removed
import { Tabs } from './tabs';
import { ContentBox } from '@/components/content-box';
import { HomeScreen } from '@/components/home-screen';
import { Composer } from '@/components/composer';
import { FloatingBar } from '@/components/floating-bar';
import { NotificationsScreen, type NotificationItem } from '@/components/notifications-screen';
import { DirectoryScreen, MessagesScreen, type DirectoryTab } from '@/components/screens';
import { SearchScreen } from '@/components/screens';
import { ControlPanelScreen, type ControlPanelTab } from '@/components/control-panel-screen';
import { SideDrawer } from '@/components/side-drawer';
import { ToastStack, type ToastInput, type ToastMessage } from '@/components/toast-stack';
import { ProfileSetupWizard } from '@/components/profile-setup-wizard';
import { Modal } from '@/components/modal';
import { getPostPath } from '@/lib/post-path';
import { PollingNotificationTransport } from '@/lib/notification-transport';
import { initialConnections, initialPosts, type Connection, type ConnectionRequest, type Post, type Screen } from '@/lib/data';
import {
  acceptFollowRequest,
  cancelFollowRequest,
  createPost,
  blockUser,
  getConnectionStatus,
  listFollowers,
  listFollowing,
  listIncomingFollowRequests,
  listNotifications,
  listConversations,
  acceptChatRequest,
  rejectChatRequest,
  listOutgoingFollowRequests,
  markAllNotificationsRead,
  markNotificationRead,
  getUnreadNotificationCount,
  getProfessionalRegistration,
  getProfileSaveStatus,
  submitProfessionalRegistration,
  cancelProfessionalRegistration,
  setProfileSave,
  listPosts,
  loadAuthSession,
  staffLogout,
  rejectFollowRequest,
  removeConnection,
  removeFollower,
  sendFollowRequest,
  type ApiConnectionUser,
  type ApiFollowRequest,
  type ApiNotification,
  type ApiPost,
  type AuthUser,
  type ProfessionalRegistration,
} from '@/lib/auth';

type AppShellProps = {
  user: AuthUser;
  onLogout: () => void;
  logoutError?: string | null;
  initialScreen?: Screen;
  initialSearchQuery?: string;
  profileUser?: AuthUser;
  profilePosts?: Post[];
  profileReplies?: Post[];
  children?: React.ReactNode;
  floatingBarContent?: React.ReactNode;
  showTabs?: boolean;
  showFloatingBar?: boolean;
  onUserChange?: (user: AuthUser) => void;
  profileStats?: { followers: number; following: number } | null;
  profileLikedPosts?: Post[];
  profileLikedPostsHasMore?: boolean;
  profileLikedPostsLoading?: boolean;
  onLoadMoreProfileLikedPosts?: () => void;
  profileConnectionsBasePath?: string;
  connectionsUsername?: string;
  initialConnectionsFilter?: 'all' | 'followers' | 'following' | 'requests';
  initialHomeFilter?: 'all' | 'following';
  initialMessagesTab?: 'all' | 'muted' | 'requests' | 'archived';
  initialSettingsTab?: 'general' | 'profile' | 'account' | 'subscription' | 'privacy';
  initialSavedSection?: 'posts' | 'profiles';
  profileTab?: ProfileTab;
  onProfileTabChange?: (tab: ProfileTab) => void;
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

export function AppShell({ user, onLogout, logoutError, initialScreen = 'home', initialSearchQuery, profileUser, profilePosts, profileReplies = [], children, floatingBarContent, showTabs, showFloatingBar = true, onUserChange, profileStats, profileLikedPosts: profileLikedPostsProp, profileLikedPostsHasMore = false, profileLikedPostsLoading = false, onLoadMoreProfileLikedPosts, profileConnectionsBasePath, connectionsUsername, initialConnectionsFilter = 'all', initialHomeFilter = 'all', initialMessagesTab = 'all', initialSettingsTab = 'general', initialSavedSection = 'posts', profileTab = 'posts', onProfileTabChange }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceMode>('system');
  const [accentColor, setAccentColor] = useState('#33aa55');
  const [activeScreen, setActiveScreen] = useState<Screen>(initialScreen);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [profileLikedPosts, setProfileLikedPosts] = useState<Post[]>(profileLikedPostsProp ?? []);
  const [homeInjectedPost, setHomeInjectedPost] = useState<Post | null>(null);
  const [floatingDraft, setFloatingDraft] = useState('');
  const [floatingPostBusy, setFloatingPostBusy] = useState(false);
  const [composeContext, setComposeContext] = useState<ComposeContext>({ kind: 'post' });
  const [profileConnectionState, setProfileConnectionState] = useState<'self' | 'none' | 'requested' | 'following'>(profileUser ? 'none' : 'self');
  const [profileConnectionRequestId, setProfileConnectionRequestId] = useState<string | null>(null);
  const [connectionActionBusy, setConnectionActionBusy] = useState(false);
  const [profileBlockOpen, setProfileBlockOpen] = useState(false);
  const [profileBlockBusy, setProfileBlockBusy] = useState(false);
  const [profileSaved, setProfileSaved] = useState<boolean | null>(null);
  const [profileSaveBusy, setProfileSaveBusy] = useState(false);
  const [professionalRegistration, setProfessionalRegistration] = useState<ProfessionalRegistration | null>(null);
  const [registrationModalOpen, setRegistrationModalOpen] = useState(false);
  const [registrationInstitute, setRegistrationInstitute] = useState('');
  const [registrationCredentialId, setRegistrationCredentialId] = useState('');
  const [registrationBusy, setRegistrationBusy] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ConnectionRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [followers, setFollowers] = useState<Connection[]>([]);
  const [following, setFollowing] = useState<Connection[]>([]);
  const [requestActionBusyId, setRequestActionBusyId] = useState<string | null>(null);
  const [removeFollowerBusyHandle, setRemoveFollowerBusyHandle] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [homeFilter, setHomeFilter] = useState<'all' | 'following'>(initialHomeFilter);
  const [connectionsFilter, setConnectionsFilter] = useState<'all' | 'followers' | 'following' | 'requests'>(initialConnectionsFilter);
  const [messagesTab, setMessagesTab] = useState<'all' | 'muted' | 'requests' | 'archived'>(initialMessagesTab);
  const [settingsTab, setSettingsTab] = useState<'general' | 'profile' | 'account' | 'subscription' | 'privacy'>(initialSettingsTab);
  const [notificationsTab, setNotificationsTab] = useState<'all' | 'security'>('all');
  const [notificationsUnreadOnly, setNotificationsUnreadOnly] = useState(false);
  const [notificationActionBusyId, setNotificationActionBusyId] = useState<string | null>(null);
  const [controlPanelTab, setControlPanelTab] = useState<ControlPanelTab>('overview');
  const [canGoBack, setCanGoBack] = useState(false);
  const activeScreenRef = useRef(activeScreen);
  const notificationCountRef = useRef<number | null>(null);
  const notificationToastIds = useRef(new Set<string>());
  const notificationReadIds = useRef(new Set<string>());
  const notificationReadMutationCount = useRef(0);
  useEffect(() => setHomeFilter(initialHomeFilter), [initialHomeFilter]);
  useEffect(() => setConnectionsFilter(initialConnectionsFilter), [initialConnectionsFilter]);
  useEffect(() => setMessagesTab(initialMessagesTab), [initialMessagesTab]);
  useEffect(() => setSettingsTab(initialSettingsTab), [initialSettingsTab]);
  useEffect(() => { activeScreenRef.current = activeScreen; }, [activeScreen]);
  useEffect(() => setProfileLikedPosts(profileLikedPostsProp ?? []), [profileLikedPostsProp]);
  useEffect(() => {
    if (activeScreen !== 'profile' || profileUser) return;
    const session = loadAuthSession();
    if (!session) return;
    getProfessionalRegistration(session.accessToken)
      .then(setProfessionalRegistration)
      .catch(() => setProfessionalRegistration(null));
  }, [activeScreen, profileUser]);
  useEffect(() => {
    setProfileSaved(null);
    if (activeScreen !== 'profile' || !profileUser) return;
    const session = loadAuthSession();
    if (!session) return;
    getProfileSaveStatus(session.accessToken, profileUser.username)
      .then((status) => setProfileSaved(status.saved))
      .catch(() => setProfileSaved(false));
  }, [activeScreen, profileUser]);
  const sidebarActiveScreen: Screen | null = activeScreen === 'post' || (activeScreen === 'profile' && profileUser)
    ? null
    : activeScreen;
  const viewingOtherConnections = Boolean(connectionsUsername && connectionsUsername.toLowerCase() !== user.username.toLowerCase());
  const searchFilterParam = searchParams.get('filter');
  const searchFilter: 'all' | 'people' | 'posts' | 'messages' = searchFilterParam === 'people' || searchFilterParam === 'posts' || searchFilterParam === 'messages' ? searchFilterParam : searchParams.get('scope') === 'messages' ? 'messages' : 'all';
  const directoryTabParam = searchParams.get('tab');
  const directoryTab: DirectoryTab = directoryTabParam === 'registered' ? 'registered' : 'all';
  const connectionsTabs = !viewingOtherConnections
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
  const shouldShowFloatingBar = showFloatingBar && (hasContextualFloatingBar || hasComposerContext || activeScreen === 'home' || (activeScreen === 'messages' && hasContextualFloatingBar));
  const visibleNotifications = notifications.filter((notification) => {
    if (notificationsTab === 'security' && notification.kind !== 'login') return false;
    if (notificationsUnreadOnly && !notification.unread) return false;
    return true;
  });
  const notificationMenuItems: ActionMenuItem[] = [
    {
      label: notificationsUnreadOnly ? 'Show all notifications' : 'Show unread only',
      icon: 'fa-filter',
      onClick: () => setNotificationsUnreadOnly((current) => !current),
    },
    {
      label: 'Mark all as read',
      icon: 'fa-check-double',
      onClick: handleMarkAllNotificationsRead,
      disabled: unreadNotificationCount === 0,
    },
  ];
  const handleCancelProfessionalRegistration = async () => {
    const session = loadAuthSession();
    if (!session) return;
    setRegistrationBusy(true);
    try {
      setProfessionalRegistration(await cancelProfessionalRegistration(session.accessToken));
      addToast('Registration request cancelled.');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not cancel the registration request.');
    } finally {
      setRegistrationBusy(false);
    }
  };
  const profileMenuItems: ActionMenuItem[] = profileUser ? [
    {
      label: profileSaved ? 'Remove from saved' : 'Save profile',
      icon: 'fa-star',
      disabled: profileSaved === null || profileSaveBusy,
      onClick: () => {
        const session = loadAuthSession();
        if (!session || profileSaved === null) return;
        const nextSaved = !profileSaved;
        setProfileSaveBusy(true);
        void setProfileSave(session.accessToken, profileUser.username, nextSaved)
          .then(() => {
            setProfileSaved(nextSaved);
            addToast(nextSaved ? 'Profile saved.' : 'Profile removed from Saved.', 'success');
          })
          .catch((error) => addToast(error instanceof Error ? error.message : 'Could not update saved profile.'))
          .finally(() => setProfileSaveBusy(false));
      },
    },
    {
      label: 'Block user',
      icon: 'fa-ban',
      dividerBefore: true,
      onClick: () => setProfileBlockOpen(true),
    },
  ] : [
    professionalRegistration?.status === 'pending' ? {
      label: 'Registration request pending',
      icon: 'fa-hourglass-half',
      disabled: true,
      trailingIcon: 'fa-xmark',
      trailingAriaLabel: 'Cancel registration request',
      trailingAction: () => void handleCancelProfessionalRegistration(),
      trailingDisabled: registrationBusy,
    } : {
      label: 'Apply for Friink Registration',
      icon: 'fa-id-card',
      onClick: () => {
        setRegistrationError(null);
        setRegistrationInstitute(professionalRegistration?.institute ?? '');
        setRegistrationCredentialId(professionalRegistration?.credential_id ?? '');
        setRegistrationModalOpen(true);
      },
    },
  ];
  const controlPanelMenuItems: ActionMenuItem[] = [
    {
      label: 'End CP session',
      icon: 'fa-right-from-bracket',
      onClick: () => {
        const currentSession = loadAuthSession();
        if (!currentSession) return;
        void staffLogout(currentSession.accessToken)
          .catch(() => undefined)
          .finally(() => router.push('/home'));
      },
    },
  ];
  const navigationMenuItems = activeScreen === 'profile'
    ? profileMenuItems
    : activeScreen === 'notifications'
      ? notificationMenuItems
      : activeScreen === 'control-panel'
        ? controlPanelMenuItems
      : [];

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

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('friink_accent_color')?.trim().toLowerCase();
      if (saved && /^#[0-9a-f]{6}$/.test(saved)) setAccentColor(saved);
    } catch {
      // Keep the default accent when local storage is unavailable.
    }
  }, []);

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

  function persistAccentColor(color: string) {
    const normalized = color.trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(normalized)) return;
    setAccentColor(normalized);
    try {
      window.localStorage.setItem('friink_accent_color', normalized);
    } catch {
      // Best effort; the current app session still uses the chosen color.
    }
  }

  function getPageTitle(screen: Screen) {
    switch (screen) {
      case 'home':
        return 'Home';
      case 'post':
        return 'Post';
      case 'profile':
        return 'Profile';
      case 'connections':
        return 'Connections';
      case 'saved':
        return 'Saved';
      case 'directory':
        return 'Directory';
      case 'search':
        return 'Search';
      case 'messages':
        return 'Chat';
      case 'notifications':
        return 'Notifications';
      case 'settings':
        return 'Settings';
      case 'control-panel':
        return 'Control panel';
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
      case 'saved':
        router.push('/saved/posts');
        break;
      case 'directory':
        router.push('/directory');
        break;
      case 'settings':
        router.push('/settings/general');
        break;
      case 'messages':
        router.push('/chats');
        break;
      case 'notifications':
        router.push('/notifications');
        break;
      case 'search':
        router.push('/search');
        break;
      case 'control-panel':
        router.push('/cp');
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

  function handleMessagesTabChange(tab: 'all' | 'muted' | 'requests' | 'archived') {
    setMessagesTab(tab);
    router.push(`/chat/${tab}`, { scroll: false });
  }

  function handleSettingsTabChange(tab: 'general' | 'profile' | 'account' | 'subscription' | 'privacy') {
    setSettingsTab(tab);
    router.push(`/settings/${tab}`, { scroll: false });
  }

  const addToast = useCallback((input: ToastInput, tone: ToastMessage['tone'] = 'error') => {
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
  }, []);

  useEffect(() => {
    if (logoutError) addToast(logoutError);
  }, [logoutError, addToast]);

  function handlePostUpdated(updatedPost: Post) {
    setPosts((current) => current.map((post) => post.id === updatedPost.id ? updatedPost : post));
    setProfileLikedPosts((current) => updatedPost.isLiked
      ? current.some((post) => post.id === updatedPost.id)
        ? current.map((post) => post.id === updatedPost.id ? updatedPost : post)
        : [updatedPost, ...current]
      : current.filter((post) => post.id !== updatedPost.id));
  }

  function handlePostDeleted(deletedPost: Post) {
    setPosts((current) => current.filter((post) => post.id !== deletedPost.id));
    setProfileLikedPosts((current) => current.filter((post) => post.id !== deletedPost.id));
    addToast('Post deleted.', 'success');
    router.refresh();
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
    const transport = new PollingNotificationTransport(() => loadAuthSession()?.accessToken ?? session.accessToken);
    return transport.subscribe((count) => {
      if (notificationReadMutationCount.current > 0) return;
      const previousCount = notificationCountRef.current;
      notificationCountRef.current = count;
      setUnreadNotificationCount(count);
      if (previousCount === null || (count <= previousCount && activeScreenRef.current !== 'notifications')) return;
      listNotifications(loadAuthSession()?.accessToken ?? session.accessToken, { limit: 40 })
        .then((page) => {
          page.items.forEach((item) => {
            if (!item.read && previousCount !== null && count > previousCount && activeScreenRef.current !== 'notifications' && !notificationToastIds.current.has(item.id)) {
              notificationToastIds.current.add(item.id);
              if (item.type === 'login_security' && item.payload.kind === 'login_approval') {
                addToast({ title: 'Login request', message: 'Review the new login request in Settings.', tone: 'success' });
              }
            }
          });
          page.items.filter((item) => item.read).forEach((item) => notificationReadIds.current.add(item.id));
          if (activeScreenRef.current === 'notifications') {
            setNotifications(mapNotificationPage(page.items));
          }
        })
        .catch(() => undefined);
    });
  }, [addToast]);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) return;
    let stopped = false;
    let busy = false;
    let timer: number | null = null;
    const sync = async () => {
      if (stopped || busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const conversations = await listConversations(loadAuthSession()?.accessToken ?? session.accessToken);
        if (!stopped) setHasUnreadMessages(conversations.some((conversation) => conversation.unread_count > 0));
      } catch { /* delivery sync and header state are best effort */ }
      finally { busy = false; }
    };
    const schedule = () => { if (!stopped && document.visibilityState !== 'hidden') timer = window.setTimeout(async () => { await sync(); schedule(); }, 4000); };
    const resume = () => { if (timer !== null) window.clearTimeout(timer); timer = null; void sync(); schedule(); };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    void sync();
    schedule();
    return () => { stopped = true; if (timer !== null) window.clearTimeout(timer); document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume); };
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
        page.items.forEach((item) => notificationToastIds.current.add(item.id));
        const notificationItems = mapNotificationPage(page.items);
        setNotifications(notificationItems);
      })
      .catch(() => {
        // Preserve the last known notification state when a refresh fails.
      });

    if (!viewingNotifications) {
      getUnreadNotificationCount(session.accessToken)
        .then((response) => {
          setUnreadNotificationCount(response.count);
        })
        .catch(() => undefined);
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
  }, [activeScreen, addToast, connectionsUsername, viewingOtherConnections]);

  useEffect(() => {
    const viewedUser = profileUser ?? user;
    if (!profileUser) {
      setProfileConnectionState('self');
      setProfileConnectionRequestId(null);
      return;
    }

    setProfileConnectionState('none');
    setProfileConnectionRequestId(null);

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
  }, [addToast, profileUser, user]);

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
    if (!trimmedText && !media.length && composeContext.kind !== 'quote') return;

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
      showProfessionalBadge: post.show_professional_badge,
      tone: 'mint',
      createdAt: post.created_at,
      text: post.content,
      connectionType: 'following',
      isConnection: true,
      isSaved: post.saved ?? false,
      isLiked: post.liked ?? false,
      replies: post.reply_count,
      quotes: post.quote_count,
      likeCount: post.like_count ?? 0,
      savedCount: post.saved_count ?? 0,
      reactions: 0,
      media: post.media.map((item) => item.url),
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
            media: post.quoted_post.media.map((item) => item.url),
            unavailable: post.quoted_post.unavailable,
            showProfessionalBadge: post.quoted_post.show_professional_badge,
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
      showProfessionalBadge: connectionUser.show_professional_badge,
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
    const likeActorName = typeof payload.actor_display_name === 'string' && payload.actor_display_name ? payload.actor_display_name : null;
    const likeActorHandle = typeof payload.actor_username === 'string' && payload.actor_username ? payload.actor_username : null;
    const actorName = likeActorName || postAuthorDisplayName || requesterName || recipientName || 'Friink';
    const actorHandle = likeActorHandle || postAuthorUsername || requesterUsername || recipientUsername || 'friink';
    const chatActorName = typeof payload.actor_display_name === 'string' && payload.actor_display_name ? payload.actor_display_name : actorName;
    const chatActorHandle = typeof payload.actor_username === 'string' && payload.actor_username ? payload.actor_username : actorHandle;
    const postPublicId = typeof payload.post_public_id === 'string' ? payload.post_public_id : null;
    const postSlug = typeof payload.post_slug === 'string' ? payload.post_slug : '';
    const connectionId = typeof payload.connection_id === 'string' ? payload.connection_id : null;
    const conversationId = typeof payload.conversation_id === 'string' ? payload.conversation_id : null;
    const isSubscriptionNotification = notification.type.startsWith('subscription_access_');
    const notificationHref = notification.type === 'login_security'
      ? (typeof payload.action_href === 'string' ? payload.action_href : '/settings')
      : isSubscriptionNotification
      ? (typeof payload.action_href === 'string' ? payload.action_href : '/settings/subscription')
      : (notification.type === 'mention' || notification.type === 'like') && postPublicId
      ? getPostPath(postAuthorUsername || actorHandle, postSlug, postPublicId)
      : undefined;
    return {
      id: notification.id,
      kind: notification.type === 'login_security' ? 'login' : notification.type.startsWith('professional_registration_') || isSubscriptionNotification ? 'service' : notification.type === 'mention' ? 'mention' : notification.type === 'like' ? 'like' : notification.type.startsWith('chat_') ? (notification.type === 'chat_message' ? 'chat' : 'request') : notification.type.includes('request') ? 'request' : 'follow',
      name: notification.type === 'login_security' || notification.type.startsWith('professional_registration_') || isSubscriptionNotification ? 'Friink' : notification.type.startsWith('chat_') ? chatActorName : actorName || 'Friink',
      handle: `@${notification.type === 'login_security' || notification.type.startsWith('professional_registration_') || isSubscriptionNotification ? 'friink' : notification.type.startsWith('chat_') ? chatActorHandle : actorHandle}`,
      text: getNotificationText(notification.type, requesterUsername, recipientUsername, notification.type.startsWith('chat_') ? chatActorName : actorName, notification.type.startsWith('chat_') ? chatActorHandle : actorHandle, payload),
      createdAt: notification.created_at,
      initials: getInitials(notification.type.startsWith('chat_') ? chatActorName : isSubscriptionNotification ? 'Friink' : actorName || actorHandle),
      showProfessionalBadge: notification.actor_show_professional_badge,
      tone: notification.read ? 'sage' : 'mint',
      unread: !notification.read,
      href: notificationHref,
      actions: !notification.read && notification.type === 'request_received' && connectionId ? [
        { label: 'Accept', onClick: () => void handleNotificationAction(notification.id, 'accept-follow', connectionId), busy: notificationActionBusyId === notification.id },
        { label: 'Decline', onClick: () => void handleNotificationAction(notification.id, 'reject-follow', connectionId), busy: notificationActionBusyId === notification.id },
      ] : !notification.read && notification.type === 'chat_request_received' && conversationId ? [
        { label: 'Accept', onClick: () => void handleNotificationAction(notification.id, 'accept-chat', conversationId), busy: notificationActionBusyId === notification.id },
        { label: 'Decline', onClick: () => void handleNotificationAction(notification.id, 'reject-chat', conversationId), busy: notificationActionBusyId === notification.id },
      ] : undefined,
    };
  }

  function mapNotificationPage(items: ApiNotification[]): NotificationItem[] {
    return items.map((item) => {
      if (item.read) notificationReadIds.current.add(item.id);
      const mapped = mapApiNotification(item);
      return notificationReadIds.current.has(item.id) ? { ...mapped, unread: false, tone: 'sage', actions: undefined } : mapped;
    });
  }

  function getNotificationText(type: ApiNotification['type'], requesterUsername: string | null, recipientUsername: string | null, actorName: string, actorHandle: string, payload: Record<string, unknown>) {
    switch (type) {
      case 'login_security':
        return 'kind' in payload && payload.kind === 'login_approval'
          ? 'A new device is asking to sign in. Approve or deny it in Settings.'
          : 'A new login to your Friink account was successful. Review sessions if this was not you.';
      case 'mention':
        return `${actorName} (@${actorHandle}) mentioned you.`;
      case 'like':
        return `${actorName} (@${actorHandle}) liked your post.`;
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
      case 'chat_request_received':
        return `${actorName} sent you a chat request.`;
      case 'chat_message':
        return `${actorName} sent you a message.`;
      case 'chat_request_accepted':
        return `${actorName} accepted your chat request.`;
      case 'professional_registration_submitted':
        return 'Your Friink Registration request was submitted and is pending staff review.';
      case 'professional_registration_approved':
        return 'Your Friink Registration request was approved. You can now show your registered badge.';
      case 'professional_registration_rejected':
        return typeof payload.message === 'string' && payload.message ? `Your Friink Registration request was declined: ${payload.message}` : 'Your Friink Registration request was declined. You may apply again.';
      case 'professional_registration_revoked':
        return typeof payload.message === 'string' && payload.message ? `Your Friink Registration was revoked: ${payload.message}` : 'Your Friink Registration was revoked by Friink staff.';
      case 'subscription_access_granted':
        return typeof payload.plan_name === 'string' ? `Friink staff granted you ${payload.plan_name} access${payload.indefinite ? ' with no expiration' : '.'}` : 'Friink staff granted you a new plan.';
      case 'subscription_access_changed':
        return typeof payload.plan_name === 'string' ? `Your Friink plan changed to ${payload.plan_name}${payload.indefinite ? ' with no expiration' : '.'}` : 'Your Friink plan was updated by staff.';
      case 'subscription_access_revoked':
        return typeof payload.plan_name === 'string' ? `Your ${payload.plan_name} access was ended by Friink staff. You are now on Friink Free.` : 'Your paid Friink access was ended. You are now on Friink Free.';
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
      showProfessionalBadge: connectionUser.show_professional_badge,
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

  function handleMarkNotificationRead(notificationId: string) {
    const session = loadAuthSession();
    if (!session || notificationReadIds.current.has(notificationId)) return;
    const notification = notifications.find((item) => item.id === notificationId);
    if (!notification?.unread) return;
    notificationReadIds.current.add(notificationId);
    notificationReadMutationCount.current += 1;
    notificationCountRef.current = Math.max(0, (notificationCountRef.current ?? unreadNotificationCount) - 1);
    setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, unread: false, tone: 'sage' } : item));
    setUnreadNotificationCount((current) => Math.max(0, current - 1));
    void markNotificationRead(session.accessToken, notificationId)
      .catch(() => {
        notificationReadIds.current.delete(notificationId);
        setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, unread: true, tone: 'mint' } : item));
        getUnreadNotificationCount(session.accessToken)
          .then((response) => setUnreadNotificationCount(response.count))
          .catch(() => undefined);
      })
      .finally(() => { notificationReadMutationCount.current = Math.max(0, notificationReadMutationCount.current - 1); });
  }

  function handleMarkAllNotificationsRead() {
    const session = loadAuthSession();
    if (!session) return;
    const markedIds = notifications.filter((item) => item.unread).map((item) => item.id);
    markedIds.forEach((id) => notificationReadIds.current.add(id));
    notificationReadMutationCount.current += 1;
    notificationCountRef.current = 0;
    setNotifications((current) => current.map((item) => ({ ...item, unread: false, tone: 'sage' })));
    setUnreadNotificationCount(0);
    void markAllNotificationsRead(session.accessToken).catch(() => {
      addToast('Could not mark notifications as read.');
      markedIds.forEach((id) => notificationReadIds.current.delete(id));
      listNotifications(session.accessToken, { limit: 40 })
        .then((page) => setNotifications(mapNotificationPage(page.items)))
        .catch(() => undefined);
      getUnreadNotificationCount(session.accessToken)
        .then((response) => setUnreadNotificationCount(response.count))
        .catch(() => undefined);
    }).finally(() => { notificationReadMutationCount.current = Math.max(0, notificationReadMutationCount.current - 1); });
  }

  async function handleNotificationAction(notificationId: string, action: 'accept-follow' | 'reject-follow' | 'accept-chat' | 'reject-chat', targetId: string) {
    const session = loadAuthSession();
    if (!session || notificationActionBusyId === notificationId) return;
    setNotificationActionBusyId(notificationId);
    try {
      if (action === 'accept-follow') await acceptFollowRequest(session.accessToken, targetId);
      if (action === 'reject-follow') await rejectFollowRequest(session.accessToken, targetId);
      if (action === 'accept-chat') await acceptChatRequest(session.accessToken, targetId);
      if (action === 'reject-chat') await rejectChatRequest(session.accessToken, targetId);
      setNotifications((current) => current.map((item) => item.id === notificationId ? { ...item, actions: undefined } : item));
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Could not update notification.');
    } finally {
      setNotificationActionBusyId(null);
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

  useEffect(() => {
    document.documentElement.style.setProperty('--color-accent', accentColor);
  }, [accentColor]);

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
          onAccountChange={onUserChange}
        />

        <TopBar
          title={getPageTitle(activeScreen)}
          isHome={activeScreen === 'home'}
          sidebarCollapsed={sidebarCollapsed}
          isSearchPage={activeScreen === 'search'}
          initialSearchQuery={initialSearchQuery}
          searchFilter={searchFilter}
          searchScope={activeScreen === 'messages' ? 'messages' : 'global'}
          notificationCount={unreadNotificationCount}
          notifications={notifications}
          hasUnreadMessages={hasUnreadMessages}
          backDisabled={!canGoBack}
          menuItems={navigationMenuItems}
          onNavigate={navigateTo}
          onBack={() => router.back()}
          onToggleSidebar={() => persistSidebarCollapsed(!sidebarCollapsed)}
        />

          <Header
          onNavigate={navigateTo}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => persistSidebarCollapsed(!sidebarCollapsed)}
            notificationCount={unreadNotificationCount}
            notifications={notifications}
            hasUnreadMessages={hasUnreadMessages}
        />

        <section className="main-panel">
          <div className="mobile-page-navigation">
            <NavigationBar
              title={getPageTitle(activeScreen)}
              onBack={() => router.back()}
              backDisabled={!canGoBack}
              menuItems={navigationMenuItems}
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
                  { id: 'archived', label: 'Archived' },
                ]}
                activeId={messagesTab}
                onChange={(id) => handleMessagesTabChange(id as 'all' | 'muted' | 'requests' | 'archived')}
                ariaLabel="Chat filters"
              />
            )}
            {showTabs !== false && activeScreen === 'notifications' && (
              <Tabs
                tabs={[{ id: 'all', label: 'All' }, { id: 'security', label: 'Security' }]}
                activeId={notificationsTab}
                onChange={(id) => setNotificationsTab(id as 'all' | 'security')}
                ariaLabel="Notification filters"
              />
            )}
            {showTabs !== false && activeScreen === 'settings' && (
              <Tabs
                tabs={[
                  { id: 'general', label: 'General' },
                  { id: 'profile', label: 'Profile' },
                  { id: 'privacy', label: 'Privacy & Safety' },
                  { id: 'account', label: 'Account' },
                  { id: 'subscription', label: 'Subscription' },
                ]}
                activeId={settingsTab}
                onChange={(id) => handleSettingsTabChange(id as 'general' | 'profile' | 'account' | 'subscription' | 'privacy')}
                ariaLabel="Settings sections"
              />
            )}
            {showTabs !== false && activeScreen === 'control-panel' && (
              <Tabs
                tabs={[
                  { id: 'overview', label: 'Overview' },
                  { id: 'staff', label: 'Staff' },
                  { id: 'users', label: 'Users' },
                  { id: 'professional-registration', label: 'Professional Registration' },
                  { id: 'security', label: 'Security & Sessions' },
                  { id: 'audit', label: 'Audit Log' },
                  { id: 'public-site', label: 'Public site' },
                ]}
                activeId={controlPanelTab}
                onChange={(id) => setControlPanelTab(id as ControlPanelTab)}
                ariaLabel="Control panel sections"
              />
            )}
            {showTabs !== false && activeScreen === 'saved' && (
              <Tabs
                tabs={[{ id: 'posts', label: 'Posts' }, { id: 'profiles', label: 'Profiles' }]}
                activeId={initialSavedSection}
                onChange={(id) => router.push(`/saved/${id}`)}
                ariaLabel="Saved sections"
              />
            )}
            {showTabs !== false && activeScreen === 'search' && (
              <Tabs
                tabs={[{ id: 'all', label: 'All' }, { id: 'people', label: 'People' }, { id: 'posts', label: 'Posts' }, { id: 'messages', label: 'Messages' }]}
                activeId={searchFilter}
                onChange={(id) => {
                  if (!initialSearchQuery) return;
                  const nextFilter = id as 'all' | 'people' | 'posts' | 'messages';
                  const nextParams = new URLSearchParams(searchParams.toString());
                  if (nextFilter === 'all') nextParams.delete('filter');
                  else nextParams.set('filter', nextFilter);
                  if (nextFilter === 'people') {
                    nextParams.delete('sort');
                    nextParams.delete('date');
                    nextParams.delete('date_from');
                    nextParams.delete('date_to');
                  } else if (nextFilter === 'all') {
                    nextParams.delete('date');
                    nextParams.delete('date_from');
                    nextParams.delete('date_to');
                  }
                  const suffix = nextParams.toString() ? `?${nextParams.toString()}` : '';
                  router.replace(`/search/${encodeURIComponent(initialSearchQuery)}${suffix}`);
                }}
                ariaLabel="Search scope"
              />
            )}
            {showTabs !== false && activeScreen === 'directory' && (
              <Tabs
                tabs={[{ id: 'all', label: 'All' }, { id: 'registered', label: 'Friink Registered' }]}
                activeId={directoryTab}
                onChange={(id) => router.replace(`/directory?tab=${id as DirectoryTab}`)}
                ariaLabel="Directory sections"
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
                      accountId={user.id}
                      activeFilter={homeFilter}
                      onFilterChange={(id) => handleHomeFilterChange(id as 'all' | 'following')}
                      onReply={handleReply}
                      onQuote={handleQuote}
                      onPostUpdated={handlePostUpdated}
                      onPostDeleted={handlePostDeleted}
                      onReactionError={(message) => addToast(message)}
                      injectedPost={homeInjectedPost}
                      onInjectedPostConsumed={() => setHomeInjectedPost(null)}
                    />
                  )}
                  {activeScreen === 'profile' && (
                    <ProfileScreen
                      user={profileUser ?? user}
                      posts={profilePosts ?? posts}
                      replies={profileReplies}
                      likedPosts={profileLikedPosts}
                      likedPostsHasMore={profileLikedPostsHasMore}
                      likedPostsLoading={profileLikedPostsLoading}
                      onLoadMoreLikedPosts={onLoadMoreProfileLikedPosts}
                      profileStats={profileStats}
                      profileConnectionsBasePath={profileConnectionsBasePath}
                      isOwnProfile={!profileUser}
                      onReply={handleReply}
                      onQuote={handleQuote}
                      onPostUpdated={handlePostUpdated}
                      onPostDeleted={handlePostDeleted}
                      onReactionError={(message) => addToast(message)}
                      onEditProfile={openProfileSettings}
                      onMessage={() => router.push(`/${encodeURIComponent((profileUser ?? user).username)}/chat`)}
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
                  {activeScreen === 'saved' && <SavedScreen section={initialSavedSection} posts={posts} onReply={handleReply} onQuote={handleQuote} onPostUpdated={handlePostUpdated} onPostDeleted={handlePostDeleted} onReactionError={(message) => addToast(message)} />}
                  {activeScreen === 'directory' && <DirectoryScreen tab={directoryTab} />}
                  {activeScreen === 'search' && <SearchScreen initialQuery={initialSearchQuery} />}
                  {activeScreen === 'notifications' && <NotificationsScreen notifications={visibleNotifications} onMarkRead={handleMarkNotificationRead} emptyMessage={notificationsUnreadOnly ? 'No unread notifications.' : notificationsTab === 'security' ? 'No security notifications yet.' : 'No notifications yet.'} />}
                  {activeScreen === 'settings' && (
                    <SettingsScreen
                      user={user}
                      appearance={appearance}
                      onAppearanceChange={(a) => persistAppearance(a)}
                      accentColor={accentColor}
                      onAccentColorChange={persistAccentColor}
                      activeTab={settingsTab}
                      onTabChange={(id) => handleSettingsTabChange(id as 'general' | 'profile' | 'account' | 'subscription' | 'privacy')}
                      onUserChange={onUserChange}
                      onToast={addToast}
                      onLogout={onLogout}
                    />
                  )}
                  {activeScreen === 'control-panel' && <ControlPanelScreen activeTab={controlPanelTab} session={loadAuthSession()} />}
                  {activeScreen === 'messages' && <MessagesScreen activeTab={messagesTab} />}
                </>
              )}
            </ContentBox>
            {registrationModalOpen && (
              <Modal
                title="Apply for Friink Registration"
                onClose={() => !registrationBusy && setRegistrationModalOpen(false)}
                actions={(
                  <>
                    <button className="button-secondary" type="button" onClick={() => setRegistrationModalOpen(false)} disabled={registrationBusy}>Cancel</button>
                    <button
                      className="button-primary"
                      type="button"
                      disabled={registrationBusy}
                      onClick={async () => {
                        const institute = registrationInstitute.trim();
                        const credentialId = registrationCredentialId.trim();
                        if (!institute || !credentialId) {
                          setRegistrationError('Institute and Credential ID are required.');
                          return;
                        }
                        const session = loadAuthSession();
                        if (!session) return;
                        setRegistrationBusy(true);
                        setRegistrationError(null);
                        try {
                          setProfessionalRegistration(await submitProfessionalRegistration(session.accessToken, { institute, credential_id: credentialId }));
                          setRegistrationModalOpen(false);
                          addToast('Registration request submitted.');
                        } catch (error) {
                          setRegistrationError(error instanceof Error ? error.message : 'Could not submit the registration request.');
                        } finally {
                          setRegistrationBusy(false);
                        }
                      }}
                    >
                      {registrationBusy ? 'Submitting…' : 'Submit application'}
                    </button>
                  </>
                )}
              >
                <p>Share the institute and credential ID you want Friink staff to review.</p>
                <label className="settings-field-label" htmlFor="registration-institute">Institute</label>
                <input id="registration-institute" className="settings-field-input" value={registrationInstitute} onChange={(event) => setRegistrationInstitute(event.target.value)} autoComplete="organization" />
                <label className="settings-field-label" htmlFor="registration-credential-id">Credential ID</label>
                <input id="registration-credential-id" className="settings-field-input" value={registrationCredentialId} onChange={(event) => setRegistrationCredentialId(event.target.value)} autoComplete="off" />
                {registrationError ? <p className="form-error" role="alert">{registrationError}</p> : null}
              </Modal>
            )}
            {profileBlockOpen && profileUser && (
              <Modal
                title="Block user"
                onClose={() => !profileBlockBusy && setProfileBlockOpen(false)}
                actions={(
                  <>
                    <button className="button-secondary" type="button" onClick={() => setProfileBlockOpen(false)} disabled={profileBlockBusy}>Cancel</button>
                    <button
                      className="button-primary"
                      type="button"
                      disabled={profileBlockBusy}
                      onClick={async () => {
                        const session = loadAuthSession();
                        if (!session) return;
                        setProfileBlockBusy(true);
                        try {
                          await blockUser(session.accessToken, profileUser.username);
                          setProfileBlockOpen(false);
                          router.refresh();
                        } catch (error) {
                          addToast(error instanceof Error ? error.message : 'Could not block user.');
                        } finally {
                          setProfileBlockBusy(false);
                        }
                      }}
                    >
                      {profileBlockBusy ? 'Blocking…' : 'Block user'}
                    </button>
                  </>
                )}
              >
                <p>They will not be able to view your profile or message you. Follow relationships will be removed and existing chats will become read-only.</p>
              </Modal>
            )}
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
                busy={floatingPostBusy}
                multiline
                placeholder={composeContext.kind === 'reply' ? 'Write a reply...' : composeContext.kind === 'quote' ? 'Add your quote...' : 'Write a post...'}
                disabledPlaceholder="Posting..."
                inputLabel="Post"
                sendLabel="Post"
                maxLength={256}
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
                  showProfessionalBadge: composeContext.post.showProfessionalBadge,
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
