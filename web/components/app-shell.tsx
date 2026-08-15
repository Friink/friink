'use client';

import { useEffect, useState } from 'react';
import { ConnectionsScreen } from '@/components/connections-screen';
import { SettingsScreen, type AppearanceMode } from '@/components/account-screens';
import { ProfileScreen } from '@/components/profile-screen';
import { StarredScreen } from '@/components/starred-screen';
import { Header } from '@/components/header';
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

export function AppShell({ user, onLogout }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceMode>('system');
  const [activeScreen, setActiveScreen] = useState<Screen>('home');
  const [posts, setPosts] = useState<Post[]>(initialPosts);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const updateSidebarState = () => setSidebarCollapsed(mobileQuery.matches);

    updateSidebarState();
    mobileQuery.addEventListener('change', updateSidebarState);

    return () => mobileQuery.removeEventListener('change', updateSidebarState);
  }, []);

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
          onNavigate={setActiveScreen}
          onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
          onLogout={onLogout}
        />

        <section className="main-panel">
          <Header
            onNavigate={setActiveScreen}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
          />

          <div className={`main-content${activeScreen === 'post' ? ' main-content-post' : ''}`}>
            {activeScreen === 'home' && <HomeScreen posts={posts} />}
            {activeScreen === 'profile' && <ProfileScreen user={user} posts={posts} />}
            {activeScreen === 'connections' && <ConnectionsScreen connections={initialConnections} />}
            {activeScreen === 'starred' && <StarredScreen posts={posts} />}
            {activeScreen === 'post' && <PostScreen user={user} onBack={() => setActiveScreen('home')} onPost={handlePost} />}
            {activeScreen === 'search' && <SearchScreen />}
            {activeScreen === 'messages' && <MessagesScreen />}
            {activeScreen === 'settings' && (
              <SettingsScreen user={user} appearance={appearance} onAppearanceChange={setAppearance} />
            )}
          </div>
        </section>

        <MobileNav activeScreen={activeScreen} onNavigate={setActiveScreen} />
      </div>
    </main>
  );
}
