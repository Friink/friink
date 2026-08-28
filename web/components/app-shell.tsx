"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { FloatingBar } from '@/components/floating-bar';
import { NotificationsScreen } from '@/components/notifications-screen';
import { PostComposerControls } from '@/components/post-composer-controls';
import { PostScreen } from '@/components/post-screen';
import { MessagesScreen } from '@/components/screens';
import { SearchScreen } from '@/components/screens';
import { SideDrawer } from '@/components/side-drawer';
import { ToastStack, type ToastMessage } from '@/components/toast-stack';
import { initialConnections, initialPosts, type ConnectionRequest, type Post, type Screen } from '@/lib/data';
import {
  acceptFollowRequest,
  cancelFollowRequest,
  createPost,
  getConnectionStatus,
  listIncomingFollowRequests,
  listPosts,
  loadAuthSession,
  rejectFollowRequest,
  removeConnection,
  sendFollowRequest,
  type ApiFollowRequest,
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
  onUserChange?: (user: AuthUser) => void;
};

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

function getDisplayName(user: AuthUser) {
  return user.name.trim() || user.username;
}

export function AppShell({ user, onLogout, initialScreen = 'home', profileUser, children, floatingBarContent, showTabs, onUserChange }: AppShellProps) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceMode>('system');
  const [activeScreen, setActiveScreen] = useState<Screen>(initialScreen);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [postDraft, setPostDraft] = useState('');
  const [quotedPost, setQuotedPost] = useState<Post | null>(null);
  const [profileConnectionState, setProfileConnectionState] = useState<'self' | 'none' | 'requested' | 'following'>(profileUser ? 'none' : 'self');
  const [profileConnectionRequestId, setProfileConnectionRequestId] = useState<string | null>(null);
  const [connectionActionBusy, setConnectionActionBusy] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequest[]>([]);
  const [requestActionBusyId, setRequestActionBusyId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [homeFilter, setHomeFilter] = useState<'all' | 'connections'>('all');
  const [connectionsFilter, setConnectionsFilter] = useState<'all' | 'followers' | 'following' | 'requests'>('all');
  const [messagesTab, setMessagesTab] = useState('all');
  const [settingsTab, setSettingsTab] = useState<'general' | 'profile' | 'account' | 'privacy'>('general');
  const [canGoBack, setCanGoBack] = useState(false);
  const sidebarActiveScreen: Screen = profileUser && activeScreen === 'profile' ? 'home' : activeScreen;

  useEffect(() => {
    const updateBackAvailability = () => {
      setCanGoBack(activeScreen !== 'home' && window.history.length > 1);
    };

    updateBackAvailability();
    window.addEventListener('popstate', updateBackAvailability);
    return () => window.removeEventListener('popstate', updateBackAvailability);
  }, [activeScreen]);

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
      case 'post':
        return 'Post';
      case 'search':
        return 'Search';
      case 'messages':
        return 'Chat';
      case 'notifications':
        return 'Notifications';
      case 'settings':
        return 'Settings';
      case 'floating':
        return 'Floating';
      default:
        return 'Friink';
    }
  }

  function navigateTo(screen: Screen) {
    setActiveScreen(screen);
    // route to pages that have their own app route
    switch (screen) {
      case 'home':
        router.push('/home');
        break;
      case 'profile':
        router.push(`/${user.username}`);
        break;
      case 'connections':
        router.push('/connections');
        break;
      case 'starred':
        router.push('/starred');
        break;
      case 'settings':
        router.push('/settings');
        break;
      case 'post':
        router.push('/compose');
        break;
      case 'messages':
        router.push('/chat');
        break;
      case 'notifications':
        router.push('/notifications');
        break;
      case 'floating':
        router.push('/floating');
        break;
      default:
        break;
    }
  }

  function addToast(message: string, tone: ToastMessage['tone'] = 'error') {
    const now = new Date();
    setToasts((current) => [
      ...current,
      {
        id: now.getTime(),
        message,
        timestamp: now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
        tone,
      },
    ]);
  }

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  useEffect(() => {
    listPosts()
      .then((apiPosts) => {
        setPosts(apiPosts.map(mapApiPost));
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
        setIncomingRequests(requests.map(mapApiFollowRequest));
      })
      .catch(() => {
        // Connections still renders with demo data if the API is unavailable.
      });
  }, [activeScreen]);

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

  function handleQuote(post: Post) {
    setQuotedPost(post);
    navigateTo('post');
  }

  async function handlePost(text: string) {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    const session = loadAuthSession();
    if (!session) {
      addToast('Please log in again to post.');
      return;
    }

    try {
      const apiPost = await createPost(session.accessToken, {
        content: trimmedText,
        quotedPostId: quotedPost?.id ?? null,
      });
      const newPost = mapApiPost(apiPost);
      setPosts((current) => [newPost, ...current]);
      setPostDraft('');
      setQuotedPost(null);
      setActiveScreen('home');
      router.push('/home');
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create post.';
      addToast(message);
    }
  }

  function openProfileSettings() {
    setSettingsTab('profile');
    navigateTo('settings');
  }

  function mapApiPost(post: ApiPost): Post {
    return {
      id: post.id,
      name: post.author_username,
      handle: `@${post.author_username}`,
      initials: getInitials(post.author_username),
      tone: 'mint',
      date: new Date(post.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }),
      text: post.content,
      connectionType: 'following',
      isConnection: true,
      isStarred: false,
      replies: 0,
      reactions: 0,
      quotedPost: post.quoted_post
        ? {
            id: post.quoted_post.id,
            authorUsername: post.quoted_post.author_username,
            content: post.quoted_post.content,
            unavailable: post.quoted_post.unavailable,
          }
        : null,
    };
  }

  function mapApiFollowRequest(request: ApiFollowRequest): ConnectionRequest {
    return {
      id: request.id,
      name: request.requester.username,
      handle: `@${request.requester.username}`,
      initials: getInitials(request.requester.username),
      status: 'pending',
      createdAt: request.created_at,
    };
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
          onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
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
            {showTabs !== false && (activeScreen === 'home' || activeScreen === 'floating') && (
              <Tabs
                tabs={[
                  { id: 'all', label: 'Explore' },
                  { id: 'connections', label: 'Connections' },
                ]}
                activeId={homeFilter}
                onChange={(id) => setHomeFilter(id as 'all' | 'connections')}
                ariaLabel="Home quick tabs"
              />
            )}
            {showTabs !== false && activeScreen === 'connections' && (
              <Tabs
                tabs={[
                  { id: 'all', label: 'All' },
                  { id: 'followers', label: 'Followers' },
                  { id: 'following', label: 'Following' },
                  { id: 'requests', label: 'Requests' },
                ]}
                activeId={connectionsFilter}
                onChange={(id) => setConnectionsFilter(id as 'all' | 'followers' | 'following' | 'requests')}
                ariaLabel="Connections filters"
              />
            )}
            {showTabs !== false && activeScreen === 'settings' && (
              <Tabs
                tabs={[
                  { id: 'general', label: 'General' },
                  { id: 'profile', label: 'Profile' },
                  { id: 'account', label: 'Account' },
                  { id: 'privacy', label: 'Privacy & Safety' },
                ]}
                activeId={settingsTab}
                onChange={(id) => setSettingsTab(id as 'general' | 'profile' | 'account' | 'privacy')}
                ariaLabel="Settings sections"
              />
            )}
            <ContentBox>
              {children ? (
                children
              ) : (
                <>
                  {activeScreen === 'home' && <HomeScreen posts={posts} activeFilter={homeFilter} onFilterChange={(id) => setHomeFilter(id as 'all' | 'connections')} onQuote={handleQuote} />}
                  {activeScreen === 'profile' && (
                    <ProfileScreen
                      user={profileUser ?? user}
                      posts={posts}
                      isOwnProfile={!profileUser}
                      onQuote={handleQuote}
                      onEditProfile={openProfileSettings}
                      connectionState={profileConnectionState}
                      connectionActionBusy={connectionActionBusy}
                      onFollow={handleFollowProfile}
                      onCancelRequest={handleCancelProfileRequest}
                      onUnfollow={handleUnfollowProfile}
                    />
                  )}
                  {activeScreen === 'connections' && (
                    <ConnectionsScreen
                      connections={initialConnections}
                      activeFilter={connectionsFilter}
                      onFilterChange={(id) => setConnectionsFilter(id as 'all' | 'following' | 'followers' | 'requests')}
                      incomingRequests={incomingRequests}
                      requestActionBusyId={requestActionBusyId}
                      onAcceptRequest={handleAcceptRequest}
                      onRejectRequest={handleRejectRequest}
                    />
                  )}
                  {activeScreen === 'starred' && <StarredScreen posts={posts} onQuote={handleQuote} />}
                  {activeScreen === 'post' && (
                    <PostScreen
                      user={user}
                      text={postDraft}
                      onTextChange={(text) => {
                        setPostDraft(text);
                      }}
                      quotedPost={quotedPost ? { handle: quotedPost.handle, text: quotedPost.text } : null}
                    />
                  )}
                  {activeScreen === 'search' && <SearchScreen />}
                  {activeScreen === 'notifications' && <NotificationsScreen />}
                  {activeScreen === 'settings' && (
                    <SettingsScreen
                      user={user}
                      appearance={appearance}
                      onAppearanceChange={(a) => persistAppearance(a)}
                      activeTab={settingsTab}
                      onTabChange={(id) => setSettingsTab(id as 'general' | 'profile' | 'account' | 'privacy')}
                      onUserChange={onUserChange}
                      onToast={addToast}
                    />
                  )}
                  {activeScreen === 'messages' && <MessagesScreen />}
                </>
              )}
            </ContentBox>
          </div>
        </section>

        <FloatingBar activeScreen={activeScreen} onNavigate={navigateTo}>
          {floatingBarContent ?? (activeScreen === 'post' && (
            <PostComposerControls disabled={!postDraft.trim()} onPost={() => handlePost(postDraft)} />
          ))}
        </FloatingBar>
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </div>
    </main>
  );
}
