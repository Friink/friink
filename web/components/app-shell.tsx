'use client';

import { useEffect, useState } from 'react';
import { FriinkLogo } from '@/components/friink-logo';
import { HomeScreen } from '@/components/home-screen';
import { LoginScreen } from '@/components/login-screen';
import { MobileNav } from '@/components/mobile-nav';
import { PostScreen } from '@/components/post-screen';
import { DirectoryScreen as ConnectionsScreen, MessagesScreen } from '@/components/screens';
import { SearchScreen } from '@/components/screens';
import { SideDrawer } from '@/components/side-drawer';
import { currentUser, initialPosts, type Post, type Screen } from '@/lib/data';

function UserAvatar({ initials, tone }: { initials: string; tone: string }) {
  return <span className={`user-avatar avatar-${tone}`}>{initials}</span>;
}

export function AppShell() {
  const [loggedIn, setLoggedIn] = useState(false);
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
      replies: 0,
      reactions: 0,
    };
    setPosts((current) => [newPost, ...current]);
    setActiveScreen('home');
  }

  if (!loggedIn) {
    return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <main className="app-shell">
      <div className="app-layout">
        <SideDrawer
          activeScreen={activeScreen}
          collapsed={sidebarCollapsed}
          onNavigate={setActiveScreen}
          onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
          onLogout={() => setLoggedIn(false)}
        />

        <section className="main-panel">
          {activeScreen === 'home' && (
            <header className="topbar">
              <div className="topbar-home">
                <button className="topbar-bell" type="button" aria-label="Notifications">
                  <i className="fa-regular fa-bell" aria-hidden="true" />
                  <span />
                </button>
              </div>
            </header>
          )}

          <div className={`main-content${activeScreen === 'post' ? ' main-content-post' : ''}`}>
            {activeScreen === 'home' && <HomeScreen posts={posts} />}
            {activeScreen === 'connections' && <ConnectionsScreen />}
            {activeScreen === 'post' && <PostScreen onBack={() => setActiveScreen('home')} onPost={handlePost} />}
            {activeScreen === 'search' && <SearchScreen />}
            {activeScreen === 'messages' && <MessagesScreen />}
          </div>
        </section>

        <MobileNav activeScreen={activeScreen} onNavigate={setActiveScreen} />
      </div>
    </main>
  );
}
