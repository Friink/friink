"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Composer } from '@/components/composer';
import { ProfileCard } from '@/components/profile-card';
import { mockConversations } from '@/lib/mock-conversations';
import { clearAuthSession, getConnectionStatus, getPublicUser, loadAuthSession, type AuthUser } from '@/lib/auth';
import { getInitialsForUsername } from '@/lib/profile-display';

type ChatClientProps = {
  username: string;
};

export function ChatClient({ username }: ChatClientProps) {
  const router = useRouter();
  const handle = `@${username}`;
  const [user, setUser] = useState<AuthUser | null>(null);
  const [composerDisabled, setComposerDisabled] = useState(true);
  const [draft, setDraft] = useState('');
  const [publicProfile, setPublicProfile] = useState<Pick<AuthUser, 'id' | 'name' | 'username' | 'about'> | null>(null);

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

  useEffect(() => {
    const conversation = mockConversations.find((c) => c.handle === handle);
    if (conversation) {
      setPublicProfile({
        id: conversation.id.toString(),
        name: conversation.name,
        username,
        about: '',
      });
      return;
    }

    getPublicUser(username)
      .then((profile) => setPublicProfile(profile))
      .catch(() => {
        setPublicProfile({
          id: `missing-${username}`,
          name: `@${username}`,
          username,
          about: '',
        });
      });
  }, [handle, username]);

  useEffect(() => {
    const el = document.querySelector('.chat-messages');
    if (el) {
      setTimeout(() => {
        (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
      }, 0);
    }
  }, []);

  const conversation = mockConversations.find((c) => c.handle === handle);
  const displayName = publicProfile?.name ?? `@${username}`;
  const initials = conversation?.initials ?? getInitialsForUsername(displayName);
  const tone = conversation?.tone ?? 'mint';
  const messages = conversation?.messages ?? [];

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
      floatingBarContent={<Composer draft={draft} onDraftChange={setDraft} onSend={sendMessage} disabled={composerDisabled} />}
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
