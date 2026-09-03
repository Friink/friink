"use client";

import { Fragment, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { Composer } from '@/components/composer';
import { ProfileCard } from '@/components/profile-card';
import { acceptChatRequest, AuthApiError, CHAT_MESSAGE_MAX_LENGTH, clearAuthSession, getChatContext, loadAuthSession, sendMessageToUser, type ApiChatContext, type ApiMessage, type AuthUser } from '@/lib/auth';
import { PollingChatTransport } from '@/lib/chat-transport';
import { formatRelativeTime } from '@/lib/time';

type ChatClientProps = { username: string };

type ReceiptState = {
  unreadCount: number;
  firstUnreadMessageId: string | null;
  lastReadMessageId: string | null;
  peerDeliveredMessageId: string | null;
  peerReadMessageId: string | null;
};

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
  const [receiptState, setReceiptState] = useState<ReceiptState>({ unreadCount: 0, firstUnreadMessageId: null, lastReadMessageId: null, peerDeliveredMessageId: null, peerReadMessageId: null });
  const lastReadMessageRef = useRef<string | null>(null);

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
        lastReadMessageRef.current = page.last_read_message_id;
        setReceiptState({ unreadCount: page.unread_count, firstUnreadMessageId: page.first_unread_message_id, lastReadMessageId: page.last_read_message_id, peerDeliveredMessageId: page.peer_delivered_message_id, peerReadMessageId: page.peer_read_message_id });
        unsubscribe = transport.subscribe(nextContext.conversation.id, page.next_cursor, (event) => {
          setMessages((current) => mergeMessages(current, event.page.items));
          setReceiptState((current) => ({ ...current, unreadCount: event.page.unread_count, firstUnreadMessageId: event.page.first_unread_message_id, peerDeliveredMessageId: event.page.peer_delivered_message_id, peerReadMessageId: event.page.peer_read_message_id }));
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

  useEffect(() => {
    const container = document.querySelector('.chat-messages');
    const session = loadAuthSession();
    if (!container || !conversation || !user || !session || !messages.length || chatAccessDenied) return;
    const observer = new IntersectionObserver((entries) => {
      let furthestVisibleIncoming: ApiMessage | null = null;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const message = messages.find((item) => item.id === entry.target.getAttribute('data-message-id') && item.sender_id !== user.id);
        if (message) furthestVisibleIncoming = message;
      }
      if (!furthestVisibleIncoming) return;
      const currentIndex = messages.findIndex((message) => message.id === lastReadMessageRef.current);
      const visibleIndex = messages.findIndex((message) => message.id === furthestVisibleIncoming?.id);
      if (visibleIndex <= currentIndex) return;
      lastReadMessageRef.current = furthestVisibleIncoming.id;
      setReceiptState((current) => ({ ...current, lastReadMessageId: furthestVisibleIncoming!.id, unreadCount: Math.max(0, current.unreadCount - messages.filter((message, index) => index > currentIndex && index <= visibleIndex && message.sender_id !== user.id).length), firstUnreadMessageId: messages.find((message, index) => index > visibleIndex && message.sender_id !== user.id)?.id || null }));
      void new PollingChatTransport(session.accessToken).markRead(conversation.id, furthestVisibleIncoming.id).catch(() => undefined);
    }, { root: container, threshold: 0.6 });
    container.querySelectorAll('[data-message-id]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [chatAccessDenied, conversation?.id, messages, user]);

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
  function getReceiptStatus(message: ApiMessage) {
    if (!user || message.sender_id !== user.id) return 'sent';
    const messageIndex = messages.findIndex((item) => item.id === message.id);
    const deliveredIndex = messages.findIndex((item) => item.id === receiptState.peerDeliveredMessageId);
    const readIndex = messages.findIndex((item) => item.id === receiptState.peerReadMessageId);
    if (readIndex >= messageIndex && readIndex >= 0) return 'read';
    if (deliveredIndex >= messageIndex && deliveredIndex >= 0) return 'delivered';
    return message.receipt_status || 'sent';
  }

  return (
    <AppShell
      user={user}
      onLogout={handleLogout}
      initialScreen="messages"
      showTabs={false}
      floatingBarContent={<Composer draft={draft} onDraftChange={setDraft} onSend={sendMessage} multiline enableMentions enableMedia={false} maxLength={CHAT_MESSAGE_MAX_LENGTH} showCount placeholder={context?.composer_placeholder || 'Write a message...'} disabled={!context?.can_send || chatAccessDenied} disabledPlaceholder={context?.composer_placeholder || 'Chat unavailable'} busy={busy} />}
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
            <Fragment key={message.id}>
              {receiptState.firstUnreadMessageId === message.id ? <div className="chat-unread-divider" role="status">Unread messages</div> : null}
              <div className={`chat-bubble-row ${message.sender_id === user.id ? 'mine' : ''}`} data-message-id={message.id}>
                <div className="chat-bubble">
                  <p>{message.content}</p>
                  <small>{formatRelativeTime(message.created_at)}{message.sender_id === user.id ? <span className={`chat-receipt chat-receipt-${getReceiptStatus(message)}`} aria-label={`${getReceiptStatus(message)} message`} title={`${getReceiptStatus(message)} message`}><span className="chat-receipt-mark">✓</span>{getReceiptStatus(message) !== 'sent' ? <span className="chat-receipt-mark chat-receipt-mark-second">✓</span> : null}</span> : null}</small>
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
