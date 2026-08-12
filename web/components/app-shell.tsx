'use client';

import { useEffect, useState } from 'react';
import { ConnectionsScreen } from '@/components/connections-screen';
import { SettingsScreen } from '@/components/account-screens';
import { ProfileScreen } from '@/components/profile-screen';
import { StarredScreen } from '@/components/starred-screen';
import { Header } from '@/components/header';
import { HomeScreen } from '@/components/home-screen';
import { MobileNav } from '@/components/mobile-nav';
import { PostScreen } from '@/components/post-screen';
import { MessagesScreen } from '@/components/screens';
import { SearchScreen } from '@/components/screens';
import { SideDrawer } from '@/components/side-drawer';
import { currentUser, initialConnections, initialPosts, type Post, type Screen } from '@/lib/data';

type AppShellProps = {
  onLogout: () => void;
};

export function AppShell({ onLogout }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
      name: currentUser.name,
      handle: currentUser.handle,
      initials: currentUser.initials,
      tone: currentUser.tone,
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
    <main className="app-shell">
      <div className="app-layout">
        <SideDrawer
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
            {activeScreen === 'profile' && <ProfileScreen posts={posts} />}
            {activeScreen === 'connections' && <ConnectionsScreen connections={initialConnections} />}
            {activeScreen === 'starred' && <StarredScreen posts={posts} />}
            {activeScreen === 'post' && <PostScreen onBack={() => setActiveScreen('home')} onPost={handlePost} />}
            {activeScreen === 'search' && <SearchScreen />}
            {activeScreen === 'messages' && <MessagesScreen />}
            {activeScreen === 'settings' && <SettingsScreen />}
          </div>
        </section>

        <MobileNav activeScreen={activeScreen} onNavigate={setActiveScreen} />
      </div>
    </main>
  );
}
