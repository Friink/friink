'use client';

import { useState } from 'react';
import { navItems, posts, type Post } from '@/lib/data';
import { ScreenForNav } from '@/components/screens';

function Avatar({ initials, tone, large = false }: { initials: string; tone: string; large?: boolean }) {
  return <span className={`avatar avatar-${tone}${large ? ' avatar-large' : ''}`}>{initials}</span>;
}

function PostCard({ post }: { post: Post }) {
  return (
    <article className="post-card">
      <div className="post-heading">
        <Avatar initials={post.initials} tone={post.tone} />
        <div>
          <p className="post-author">{post.name}</p>
          <p className="post-time">{post.time}</p>
        </div>
        <button className="icon-button post-menu" aria-label={`More options for ${post.name}`}>
          ···
        </button>
      </div>
      <p className="post-copy">{post.text}</p>
      <div className="tag-row">
        {post.tags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}
      </div>
      <div className="post-actions">
        <button className="post-action" aria-label="React to post">♡ <span>{post.reactions}</span></button>
        <button className="post-action" aria-label="Reply to post">◌ <span>{post.replies}</span></button>
        <button className="post-action post-share" aria-label="Share post">↗</button>
      </div>
    </article>
  );
}

export function AppShell() {
  const [activeNav, setActiveNav] = useState('Home');
  const [composerOpen, setComposerOpen] = useState(false);
  const [postText, setPostText] = useState('');

  return (
    <main className="app-background">
      <div className={`app-layout${activeNav === 'Home' ? ' home-layout' : ''}`}>
        <aside className="sidebar">
          <div className="brand-lockup"><span className="brand-mark">f</span><span>friink</span></div>
          <div className="profile-card">
            <Avatar initials="AM" tone="mint" large />
            <div><strong>Alex Morgan</strong><span>Good to see you</span></div>
            <button className="icon-button" aria-label="Open profile menu">⌄</button>
          </div>
          <nav className="side-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <button className={`nav-item${activeNav === item.label ? ' active' : ''}`} key={item.label} onClick={() => setActiveNav(item.label)}>
                <span className="nav-icon">{item.icon}</span><span>{item.label}</span>{item.count && <span className="nav-count">{item.count}</span>}
              </button>
            ))}
          </nav>
          <div className="sidebar-footer"><button className="nav-item"><span className="nav-icon">⚙</span><span>Settings</span></button><p>© 2026 Friink</p></div>
        </aside>

        <section className="content-area">
          <header className="topbar">
            {activeNav === 'Home' ? <div className="figma-topbar"><button className="figma-avatar" aria-label="Open profile">●</button><span className="figma-logo">i<span>i</span></span><button className="figma-bell" aria-label="Notifications">♧<span /></button></div> : <><div className="mobile-brand"><span className="brand-mark">f</span><span>friink</span></div><div className="topbar-actions"><button className="icon-button search-button" aria-label="Search">⌕</button><button className="notification-button" aria-label="Notifications">♧<span /></button><Avatar initials="AM" tone="mint" /></div></>}
          </header>
          <div className="content-column">
            {activeNav === 'Home' ? <div className="figma-home-feed">
              {posts.map((post) => <article className="figma-post" key={post.id}><div className="figma-post-heading"><span className={`figma-user-avatar ${post.tone}`}>●</span><div><strong>User</strong><small>@handle&nbsp;&nbsp;19 Mar 2024</small></div><button className="figma-more" aria-label="Post options">⋮</button><button className="figma-star" aria-label="Save post">☆</button></div><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p><div className="figma-post-actions"><button aria-label="Comment">◯</button><button aria-label="Quote">❞</button><button aria-label="Like">♡</button><button aria-label="Share">♣</button></div></article>)}
            </div> : <ScreenForNav activeNav={activeNav} />}
          </div>
        </section>

        <nav className="bottom-nav" aria-label="Mobile navigation">{navItems.slice(0, 4).map((item) => <button className={`bottom-item${activeNav === item.label ? ' active' : ''}`} key={item.label} onClick={() => setActiveNav(item.label)}><span>{item.icon}</span><small>{item.label}</small></button>)}<button className="bottom-item" onClick={() => setComposerOpen(true)}><span className="bottom-add">＋</span><small>Share</small></button></nav>
      </div>

      {composerOpen && <div className="modal-backdrop" onClick={() => setComposerOpen(false)}><div className="composer-modal" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><h2>Share with your circle</h2><button className="icon-button" onClick={() => setComposerOpen(false)} aria-label="Close">×</button></div><div className="modal-user"><Avatar initials="AM" tone="mint" /><strong>Alex Morgan</strong><span>· Everyone</span></div><textarea autoFocus value={postText} onChange={(event) => setPostText(event.target.value)} placeholder="What&apos;s on your mind?" /><div className="modal-footer"><span>{postText.length}/280</span><button className="primary-button" onClick={() => { setComposerOpen(false); setPostText(''); }}>Share post</button></div></div></div>}
    </main>
  );
}
