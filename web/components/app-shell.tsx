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
import { FloatingActions } from '@/components/floating-actions';
import { HomeScreen } from '@/components/home-screen';
import { FloatingBar } from '@/components/floating-bar';
import { PostComposerControls } from '@/components/post-composer-controls';
import { PostScreen } from '@/components/post-screen';
import { MessagesScreen } from '@/components/screens';
import { SearchScreen } from '@/components/screens';
import { SideDrawer } from '@/components/side-drawer';
import { initialConnections, initialPosts, type Post, type Screen } from '@/lib/data';
import type { AuthUser } from '@/lib/auth';

type AppShellProps = {
  user: AuthUser;
  onLogout: () => void;
  initialScreen?: Screen;
  children?: React.ReactNode;
  floatingBarContent?: React.ReactNode;
  fillContent?: boolean;
  showTabs?: boolean;
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

export function AppShell({ user, onLogout, initialScreen = 'home', children, floatingBarContent, showTabs, fillContent }: AppShellProps) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceMode>('system');
  const [activeScreen, setActiveScreen] = useState<Screen>(initialScreen);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [postDraft, setPostDraft] = useState('');
  const [homeFilter, setHomeFilter] = useState<'all' | 'connections'>('all');
  const [connectionsFilter, setConnectionsFilter] = useState<'all' | 'followers' | 'following' | 'requests'>('all');
  const [messagesTab, setMessagesTab] = useState('all');
  const [settingsTab, setSettingsTab] = useState<'general' | 'account' | 'privacy'>('general');
  const [canGoBack, setCanGoBack] = useState(false);

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
      case 'floating':
        router.push('/floating');
        break;
      default:
        break;
    }
  }

  function handlePost(text: string) {
    const newPost: Post = {
      id: Date.now(),
      name: user.name,
      handle: `@${user.username}`,
      initials: getInitials(user.name),
      tone: 'mint',
      date: 'Just now',
      text,
      connectionType: 'following',
      isConnection: true,
      isStarred: false,
      replies: 0,
      reactions: 0,
    };
    setPosts((current) => [newPost, ...current]);
    setPostDraft('');
    setActiveScreen('home');
  }

  return (
    <main className="app-shell" data-theme={appearance}>
      <div className="app-layout">
        <SideDrawer
          user={user}
          activeScreen={activeScreen}
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
              onMenu={() => setSidebarCollapsed(false)}
            />
          </div>

          <div className={`main-content${activeScreen === 'post' ? ' main-content-post' : ''}`}>
            <div className="main-scroll">
              {showTabs !== false && (activeScreen === 'home' || activeScreen === 'floating') && <Tabs ariaLabel="Home quick tabs" />}
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
                    { id: 'account', label: 'Account' },
                    { id: 'privacy', label: 'Privacy & Safety' },
                  ]}
                  activeId={settingsTab}
                  onChange={(id) => setSettingsTab(id as 'general' | 'account' | 'privacy')}
                  ariaLabel="Settings sections"
                />
              )}
              <ContentBox className={(children || fillContent || activeScreen === 'post') ? 'fill-viewport' : ''}>
                {children ? (
                  children
                ) : (
                  <>
                    {activeScreen === 'home' && <HomeScreen posts={posts} activeFilter={homeFilter} onFilterChange={(id) => setHomeFilter(id as 'all' | 'connections')} />}
                    {activeScreen === 'profile' && <ProfileScreen user={user} posts={posts} />}
                    {activeScreen === 'connections' && <ConnectionsScreen connections={initialConnections} activeFilter={connectionsFilter} onFilterChange={(id) => setConnectionsFilter(id as 'all' | 'followers' | 'following' | 'requests')} />}
                    {activeScreen === 'starred' && <StarredScreen posts={posts} />}
                    {activeScreen === 'post' && <PostScreen user={user} text={postDraft} onTextChange={setPostDraft} />}
                    {activeScreen === 'search' && <SearchScreen />}
                    {activeScreen === 'settings' && (
                      <SettingsScreen
                        user={user}
                        appearance={appearance}
                        onAppearanceChange={(a) => persistAppearance(a)}
                        activeTab={settingsTab}
                        onTabChange={(id) => setSettingsTab(id as 'general' | 'account' | 'privacy')}
                      />
                    )}
                    {activeScreen === 'messages' && <MessagesScreen />}
                  </>
                )}
              </ContentBox>
            </div>
            <FloatingActions />
          </div>
        </section>

        <FloatingBar activeScreen={activeScreen} onNavigate={navigateTo}>
          {floatingBarContent ?? (activeScreen === 'post' && (
            <PostComposerControls disabled={!postDraft.trim()} onPost={() => handlePost(postDraft)} />
          ))}
        </FloatingBar>
      </div>
    </main>
  );
}
