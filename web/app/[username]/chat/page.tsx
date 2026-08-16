"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import ComposeHeader from '@/components/compose-header';
import { mockConversations } from '@/lib/mock-conversations';
import { loadAuthSession, type AuthUser, clearAuthSession } from '@/lib/auth';

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const username = params?.username ?? '';
  const handle = `@${username}`;
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    setUser(session.user);
  }, [router]);

  const conversation = mockConversations.find((c) => c.handle === handle);
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
  if (!conversation) return <div style={{ padding: '1rem' }}>Conversation not found.</div>;

  function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    setDraft('');
  }

  function handleLogout() {
    clearAuthSession();
    router.replace('/');
  }

  return (
    <AppShell user={user} onLogout={handleLogout} initialScreen="messages" showTabs={false} fillContent>
      <section className="messages-screen chat-screen">
        <ComposeHeader name={conversation.name} handle={conversation.handle} initials={conversation.initials} tone={conversation.tone} />

        <div className="chat-messages">
          <p className="chat-date">Today</p>
          {conversation.messages.map((message) => (
            <div className={`chat-bubble-row ${message.from === 'me' ? 'mine' : ''}`} key={message.id}>
              <div className="chat-bubble">
                <p>{message.text}</p>
                <small>{message.time}</small>
              </div>
            </div>
          ))}
        </div>

        <form className="chat-composer" onSubmit={sendMessage}>
          <button className="icon-plain" type="button" aria-label="Attach file">
            <i className="fa-solid fa-paperclip" aria-hidden="true" />
          </button>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message..." aria-label="Message" />
          <button className="chat-send" type="submit" disabled={!draft.trim()} aria-label="Send message">
            <i className="fa-solid fa-arrow-up" aria-hidden="true" />
          </button>
        </form>
      </section>
    </AppShell>
  );
}
