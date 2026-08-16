"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConnectionsScreen } from '@/components/connections-screen';
import { SettingsScreen, type AppearanceMode } from '@/components/account-screens';
import { ProfileScreen } from '@/components/profile-screen';
import { StarredScreen } from '@/components/starred-screen';
import { Header } from '@/components/header';
// legacy TabBar removed
import { Tabs } from './tabs';
import { ContentBox } from '@/components/content-box';
import { FloatingActions } from '@/components/floating-actions';
import { HomeScreen } from '@/components/home-screen';
import { MobileNav } from '@/components/mobile-nav';
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

export function AppShell({ user, onLogout, initialScreen = 'home' }: AppShellProps) {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceMode>('system');
  const [activeScreen, setActiveScreen] = useState<Screen>(initialScreen);
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [homeFilter, setHomeFilter] = useState('all');
  const [connectionsFilter, setConnectionsFilter] = useState('all');
  const [messagesTab, setMessagesTab] = useState('all');
  const [settingsTab, setSettingsTab] = useState('general');

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const updateSidebarState = () => setSidebarCollapsed(mobileQuery.matches);

    updateSidebarState();
    mobileQuery.addEventListener('change', updateSidebarState);

    return () => mobileQuery.removeEventListener('change', updateSidebarState);
  }, []);

  function navigateTo(screen: Screen) {
    setActiveScreen(screen);
    // route to pages that have their own app route
    switch (screen) {
      case 'home':
        router.replace('/home');
        break;
      case 'profile':
        router.replace(`/${user.username}`);
        break;
      case 'connections':
        router.replace('/connections');
        break;
      case 'starred':
        router.replace('/starred');
        break;
      case 'settings':
        router.replace('/settings');
        break;
      case 'post':
        router.replace('/compose');
        break;
      case 'messages':
        router.replace('/messages');
        break;
      case 'floating':
        router.replace('/floating');
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
          onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
          onLogout={onLogout}
        />

        <section className="main-panel">
          <Header
            onNavigate={navigateTo}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
          />

          <div className={`main-content${activeScreen === 'post' ? ' main-content-post' : ''}`}>
            {(activeScreen === 'home' || activeScreen === 'floating') && <Tabs ariaLabel="Home quick tabs" />}
            {activeScreen === 'settings' && (
              <Tabs
                tabs={[
                  { id: 'general', label: 'General' },
                  { id: 'account', label: 'Account' },
                  { id: 'privacy', label: 'Privacy & Safety' },
                ]}
                activeId={settingsTab}
                onChange={(id) => setSettingsTab(id)}
                ariaLabel="Settings sections"
              />
            )}

            {/* Legacy TabBar removed; UI uses `Tabs` or other controls. */}

            {/* Profile manages its own tab UI (non-standard) */}

            {/* Messages filters moved away from legacy TabBar. */}

            {/* Legacy TabBar removed from settings — Tabs component handles settings navigation now. */}
            <ContentBox>
              {activeScreen === 'home' && <HomeScreen posts={posts} activeFilter={homeFilter} onFilterChange={(id) => setHomeFilter(id)} />}
              {activeScreen === 'profile' && <ProfileScreen user={user} posts={posts} />}
              {activeScreen === 'connections' && <ConnectionsScreen connections={initialConnections} activeFilter={connectionsFilter} onFilterChange={(id) => setConnectionsFilter(id)} />}
              {activeScreen === 'starred' && <StarredScreen posts={posts} />}
              {activeScreen === 'post' && <PostScreen user={user} onBack={() => setActiveScreen('home')} onPost={handlePost} />}
              {activeScreen === 'search' && <SearchScreen />}
              {activeScreen === 'messages' && <MessagesScreen />}
              {activeScreen === 'settings' && (
                <SettingsScreen user={user} appearance={appearance} onAppearanceChange={setAppearance} activeTab={settingsTab} onTabChange={(id) => setSettingsTab(id)} />
              )}
            </ContentBox>
            <FloatingActions />
          </div>
        </section>

        <MobileNav activeScreen={activeScreen} onNavigate={navigateTo} />
      </div>
    </main>
  );
}
