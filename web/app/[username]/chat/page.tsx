"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { ChatComposer } from '@/components/chat-composer';
import { ProfileCard } from '@/components/profile-card';
import { mockConversations } from '@/lib/mock-conversations';
import { clearAuthSession, getConnectionStatus, loadAuthSession, type AuthUser } from '@/lib/auth';

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const rawUsername = params?.username ?? '';
  const username = Array.isArray(rawUsername) ? rawUsername[0] ?? '' : rawUsername;
  const handle = `@${username}`;
  const [user, setUser] = useState<AuthUser | null>(null);
  const [composerDisabled, setComposerDisabled] = useState(true);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    setUser(session.user);
    getConnectionStatus(session.accessToken, username)
      .then((status) => {
        setComposerDisabled(status.state !== 'following');
      })
      .catch(() => {
        setComposerDisabled(true);
      });
  }, [router, username]);

  const conversation = mockConversations.find((c) => c.handle === handle);
  const displayName = conversation?.name ?? formatDisplayName(username);
  const initials = conversation?.initials ?? getInitials(username);
  const tone = conversation?.tone ?? 'mint';
  const messages = conversation?.messages ?? [];
  const [draft, setDraft] = useState('');

  // keep messages scrolled to bottom on mount
  useEffect(() => {
    const el = document.querySelector('.chat-messages');
    if (el) {
      // allow layout to settle
      setTimeout(() => {
        (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
      }, 0);
    }
  }, []);

  if (!user) return null;

  function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (composerDisabled) return;
    setDraft('');
  }

  function handleLogout() {
    clearAuthSession();
    router.replace('/');
  }

  return (
    <AppShell
      user={user}
      onLogout={handleLogout}
      initialScreen="messages"
      showTabs={false}
      floatingBarContent={<ChatComposer draft={draft} onDraftChange={setDraft} onSend={sendMessage} disabled={composerDisabled} />}
    >
      <section className="messages-screen chat-screen">
        <div className="chat-header">
          <ProfileCard name={displayName} handle={handle} tone={tone} initials={initials} />
        </div>

        <div className="chat-messages">
          {messages.length > 0 && <p className="chat-date">Today</p>}
          {messages.map((message) => (
            <div className={`chat-bubble-row ${message.from === 'me' ? 'mine' : ''}`} key={message.id}>
              <div className="chat-bubble">
                <p>{message.text}</p>
                <small>{message.time}</small>
              </div>
            </div>
          ))}
        </div>

      </section>
    </AppShell>
  );
}

function formatDisplayName(username: string) {
  return (
    username
      .split(/[._-]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ') || 'Friink User'
  );
}

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
