'use client';

import { useState } from 'react';
import { FriinkLogo } from '@/components/friink-logo';
import { HomeScreen } from '@/components/home-screen';
import { LoginScreen } from '@/components/login-screen';
import { PostScreen } from '@/components/post-screen';
import { currentUser, initialPosts, navItems, type Post, type Screen } from '@/lib/data';

function UserAvatar({ initials, tone }: { initials: string; tone: string }) {
  return <span className={`user-avatar avatar-${tone}`}>{initials}</span>;
}

export function AppShell() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeScreen, setActiveScreen] = useState<Screen>('home');
  const [posts, setPosts] = useState<Post[]>(initialPosts);

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
        <aside className="sidebar" aria-label="Sidebar">
          <div className="sidebar-brand">
            <FriinkLogo />
          </div>

          <div className="sidebar-profile">
            <UserAvatar initials={currentUser.initials} tone={currentUser.tone} />
            <div>
              <strong>{currentUser.name}</strong>
              <span>{currentUser.handle}</span>
            </div>
          </div>

          <nav className="sidebar-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <button
                className={`nav-item${activeScreen === item.id ? ' active' : ''}`}
                key={item.id}
                type="button"
                onClick={() => setActiveScreen(item.id)}
              >
                <i className={item.icon} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button className="nav-item" type="button" onClick={() => setLoggedIn(false)}>
              <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
              <span>Log out</span>
            </button>
            <p>© 2026 Friink</p>
          </div>
        </aside>

        <section className="main-panel">
          {activeScreen === 'home' && (
            <header className="topbar">
              <div className="topbar-home">
                <button className="topbar-avatar" type="button" aria-label="Open profile">
                  <UserAvatar initials={currentUser.initials} tone={currentUser.tone} />
                </button>
                <FriinkLogo />
                <button className="topbar-bell" type="button" aria-label="Notifications">
                  <i className="fa-regular fa-bell" aria-hidden="true" />
                  <span />
                </button>
              </div>
            </header>
          )}

          <div className={`main-content${activeScreen === 'post' ? ' main-content-post' : ''}`}>
            {activeScreen === 'home' ? (
              <HomeScreen posts={posts} />
            ) : (
              <PostScreen onBack={() => setActiveScreen('home')} onPost={handlePost} />
            )}
          </div>
        </section>

        <nav className="bottom-nav" aria-label="Mobile navigation">
          {navItems.map((item) => (
            <button
              className={`bottom-nav-item${activeScreen === item.id ? ' active' : ''}`}
              key={item.id}
              type="button"
              onClick={() => setActiveScreen(item.id)}
              aria-label={item.label}
            >
              <i className={item.icon} aria-hidden="true" />
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}
