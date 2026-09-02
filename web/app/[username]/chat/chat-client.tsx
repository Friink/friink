"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Composer } from '@/components/composer';
import { ProfileCard } from '@/components/profile-card';
import { acceptChatRequest, AuthApiError, clearAuthSession, getChatContext, loadAuthSession, sendMessageToUser, type ApiChatContext, type ApiMessage, type AuthUser } from '@/lib/auth';
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
  const [context, setContext] = useState<ApiChatContext | null>(null);
  const conversation = context?.conversation ?? null;
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

    getChatContext(session.accessToken, username)
      .then(async (nextContext) => {
        if (cancelled) return;
        setContext(nextContext);
        if (!nextContext.conversation) return;
        const page = await transport.loadMessages(nextContext.conversation.id);
        if (cancelled) return;
        setMessages(page.items);
        unsubscribe = transport.subscribe(nextContext.conversation.id, page.nextCursor, (event) => {
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
    if (!text || !context?.can_send || !session || busy) return;

    const clientMessageId = crypto.randomUUID();
    const optimisticMessage = conversation ? {
      id: `pending-${clientMessageId}`,
      conversation_id: conversation.id,
      sender_id: session.user.id,
      content: text,
      created_at: new Date().toISOString(),
    } satisfies ApiMessage : null;
    if (optimisticMessage) setMessages((current) => mergeMessages(current, [optimisticMessage]));
    setDraft('');
    setBusy(true);
    try {
      const sent = conversation
        ? await new PollingChatTransport(session.accessToken).send(conversation.id, text, clientMessageId)
        : await sendMessageToUser(session.accessToken, username, text, clientMessageId);
      if (optimisticMessage) setMessages((current) => mergeMessages(current.filter((message) => message.id !== optimisticMessage.id), [sent]));
      const nextContext = await getChatContext(session.accessToken, username);
      setContext(nextContext);
      if (!optimisticMessage) setMessages((current) => mergeMessages(current, [sent]));
    } catch (nextError) {
      if (optimisticMessage) setMessages((current) => current.filter((message) => message.id !== optimisticMessage.id));
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

  async function handleAcceptRequest() {
    const session = loadAuthSession();
    if (!session || !conversation) return;
    try {
      const accepted = await acceptChatRequest(session.accessToken, conversation.id);
      setContext((current) => current ? { ...current, conversation: accepted, can_send: true, composer_placeholder: 'Write a message...', status: 'accepted' } : current);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not accept this request.');
    }
  }

  if (!user) return null;

  const participant = context?.participant || conversation?.participant;
  const displayName = participant?.display_name || participant?.username || `@${username}`;
  const handle = `@${participant?.username || username}`;

  return (
    <AppShell
      user={user}
      onLogout={handleLogout}
      initialScreen="messages"
      showTabs={false}
      floatingBarContent={<Composer draft={draft} onDraftChange={setDraft} onSend={sendMessage} multiline enableMentions enableMedia={false} placeholder={context?.composer_placeholder || 'Write a message...'} disabled={!context?.can_send || chatAccessDenied} disabledPlaceholder={context?.composer_placeholder || 'Chat unavailable'} busy={busy} />}
    >
      <section className="messages-screen chat-screen">
        <div className="chat-header">
          <ProfileCard name={displayName} handle={handle} imageUrl={participant?.profile_picture_url} />
          {context?.status === 'pending' && conversation && conversation.requester_id !== user.id ? <button className="primary-button chat-accept-button" type="button" onClick={handleAcceptRequest}>Accept request</button> : null}
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
