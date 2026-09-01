"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Composer } from '@/components/composer';
import { ProfileCard } from '@/components/profile-card';
import { AuthApiError, clearAuthSession, loadAuthSession, type ApiConversation, type ApiMessage, type AuthUser } from '@/lib/auth';
import { PollingChatTransport } from '@/lib/chat-transport';
import { formatRelativeTime } from '@/lib/time';

type ChatClientProps = { username: string };

function mergeMessages(current: ApiMessage[], incoming: ApiMessage[]) {
  const messages = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => messages.set(message.id, message));
  return [...messages.values()].sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime());
}

export function ChatClient({ username }: ChatClientProps) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [conversation, setConversation] = useState<ApiConversation | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatAccessDenied, setChatAccessDenied] = useState(false);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    setUser(session.user);
    const transport = new PollingChatTransport(session.accessToken);
    let cancelled = false;
    let unsubscribe: () => void = () => undefined;

    transport.open(username)
      .then(async (nextConversation) => {
        if (cancelled) return;
        setConversation(nextConversation);
        const page = await transport.loadMessages(nextConversation.id);
        if (cancelled) return;
        setMessages(page.items);
        unsubscribe = transport.subscribe(nextConversation.id, page.nextCursor, (event) => {
          setMessages((current) => mergeMessages(current, [event.message]));
        });
      })
      .catch((nextError) => {
        if (!cancelled) {
          setChatAccessDenied(nextError instanceof AuthApiError && nextError.status === 403);
          setError(nextError instanceof Error ? nextError.message : 'Could not load this conversation.');
        }
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router, username]);

  useEffect(() => {
    const element = document.querySelector('.chat-messages');
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length]);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    const session = loadAuthSession();
    if (!text || !conversation || !session || busy) return;

    const clientMessageId = crypto.randomUUID();
    const optimisticMessage: ApiMessage = {
      id: `pending-${clientMessageId}`,
      conversation_id: conversation.id,
      sender_id: session.user.id,
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((current) => mergeMessages(current, [optimisticMessage]));
    setDraft('');
    setBusy(true);
    try {
      const sent = await new PollingChatTransport(session.accessToken).send(conversation.id, text, clientMessageId);
      setMessages((current) => mergeMessages(current.filter((message) => message.id !== optimisticMessage.id), [sent]));
    } catch (nextError) {
      setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
      setError(nextError instanceof Error ? nextError.message : 'Could not send message.');
      setDraft(text);
    } finally {
      setBusy(false);
    }
  }

  function handleLogout() {
    clearAuthSession();
    router.replace('/');
  }

  if (!user) return null;

  const displayName = conversation?.participant.display_name || conversation?.participant.username || `@${username}`;
  const handle = `@${conversation?.participant.username || username}`;

  return (
    <AppShell
      user={user}
      onLogout={handleLogout}
      initialScreen="messages"
      showTabs={false}
      floatingBarContent={<Composer draft={draft} onDraftChange={setDraft} onSend={sendMessage} placeholder="Write a message..." disabled={!conversation || chatAccessDenied} busy={busy} />}
    >
      <section className="messages-screen chat-screen">
        <div className="chat-header">
          <ProfileCard name={displayName} handle={handle} imageUrl={conversation?.participant.profile_picture_url} />
        </div>

        {error && <p className="home-feed-message" role="alert">{error}</p>}
        <div className="chat-messages">
          {messages.length > 0 && <p className="chat-date">{formatRelativeTime(messages[0].created_at)}</p>}
          {messages.map((message) => (
            <div className={`chat-bubble-row ${message.sender_id === user.id ? 'mine' : ''}`} key={message.id}>
              <div className="chat-bubble">
                <p>{message.content}</p>
                <small>{formatRelativeTime(message.created_at)}</small>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
