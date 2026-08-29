"use client";

import Link from 'next/link';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Composer } from '@/components/composer';
import { ListRow } from '@/components/list-row';
import { PageSurface } from '@/components/page-surface';
import { ProfileCard } from '@/components/profile-card';
import { navItems } from '@/lib/data';
import { mockConversations } from '@/lib/mock-conversations';
import { formatRelativeTime } from '@/lib/time';

function ScreenHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="screen-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="intro-copy">{copy}</p></div>;
}

export function QuestionsScreen() {
  return <><ScreenHeading eyebrow="Ask your people" title="Questions" copy="Small questions are a good way to start a conversation." /><div className="question-prompt"><span className="prompt-spark">✦</span><div><strong>What are you curious about?</strong><p>Ask your circle anything, big or small.</p></div><button className="primary-button">Ask a question</button></div><div className="section-heading"><h2>Recent questions</h2><button className="text-button">See all <span>→</span></button></div><div className="question-list"><div className="question-card"><div className="question-meta"><span className="avatar avatar-coral">MC</span><span><strong>Maya Chen</strong> asked <small>25 min ago</small></span></div><p>What is one place you would return to in a heartbeat?</p><div className="question-footer"><span>12 answers</span><button className="text-button">Answer →</button></div></div><div className="question-card"><div className="question-meta"><span className="avatar avatar-sage">JB</span><span><strong>Jon Bell</strong> asked <small>1 hr ago</small></span></div><p>What are you listening to on repeat this week?</p><div className="question-footer"><span>7 answers</span><button className="text-button">Answer →</button></div></div></div></>;
}

type MessagesTab = 'all' | 'muted' | 'requests';

export function MessagesScreen({ activeTab = 'all' }: { activeTab?: MessagesTab }) {
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  const [conversations, setConversations] = useState(mockConversations);

  const router = useRouter();
  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
  const visibleConversations = conversations.filter((conversation) => {
    if (activeTab === 'muted') return conversation.muted === true;
    if (activeTab === 'requests') return conversation.request === true;
    return true;
  });

  function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !activeConversation) return;

    setConversations((current) => current.map((conversation) => conversation.id === activeConversation.id
      ? {
          ...conversation,
          preview: text,
          createdAt: new Date().toISOString(),
          messages: [...conversation.messages, { id: Date.now(), from: 'me', text, createdAt: new Date().toISOString() }],
        }
      : conversation));
    setDraft('');
  }

  if (activeConversation) {
    return (
      <PageSurface className="messages-screen chat-screen">
        <div className="chat-header">
          <Link className="chat-contact-link" href={`/${activeConversation.handle.replace('@', '')}`}>
            <span className={`user-avatar avatar-${activeConversation.tone}`}>{activeConversation.initials}</span>
            <div className="chat-contact">
              <strong>{activeConversation.name}</strong>
              <span>{activeConversation.handle}</span>
            </div>
          </Link>
          <button className="icon-plain chat-more" type="button" aria-label="Conversation options">
            <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
          </button>
        </div>
        <div className="chat-messages">
          {activeConversation.messages.length > 0 && <p className="chat-date">{formatRelativeTime(activeConversation.messages[0].createdAt)}</p>}
          {activeConversation.messages.map((message) => (
            <div className={`chat-bubble-row ${message.from === 'me' ? 'mine' : ''}`} key={message.id}>
              <div className="chat-bubble">
                <p>{message.text}</p>
                <small>{formatRelativeTime(message.createdAt)}</small>
              </div>
            </div>
          ))}
        </div>
        <Composer draft={draft} onDraftChange={setDraft} onSend={sendMessage} />
      </PageSurface>
    );
  }

  return (
    <PageSurface className="messages-screen" variant="list">
      <div className="message-list">
        {visibleConversations.map((conversation) => (
          <ListRow
            key={conversation.id}
            avatar={
              <Link className="message-row-profile" href={`/${conversation.handle.replace('@', '')}`} aria-label={`Open ${conversation.name} profile`}>
                <span className={`user-avatar avatar-${conversation.tone}`}>{conversation.initials}</span>
              </Link>
            }
            title={
              <Link className="message-profile-link" href={`/${conversation.handle.replace('@', '')}`}>
                {conversation.name}
              </Link>
            }
            subtitle={conversation.preview}
            meta={formatRelativeTime(conversation.createdAt)}
            trailing={conversation.unread ? <span className="unread-dot" /> : null}
            unread={conversation.unread}
            onClick={() => router.push(`/${conversation.handle.replace('@', '')}/chat`)}
            ariaLabel={`Open chat with ${conversation.name}`}
          />
        ))}
        {visibleConversations.length === 0 && <div className="home-feed-message">No chats to show yet.</div>}
      </div>
    </PageSurface>
  );
}

function getSearchParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? decodeURIComponent(raw) : '';
}

export function SearchScreen() {
  const params = useParams<{ query?: string | string[] }>();
  const query = getSearchParam(params?.query);
  const normalizedQuery = query.trim().toLowerCase();
  const fallbackResults = [
    {
      id: 'people-muflah',
      type: 'People',
      name: 'Muflah',
      handle: '@muflah',
      initials: 'M',
      tone: 'mint' as const,
      summary: 'Profile result',
    },
    {
      id: 'posts-dark-mode',
      type: 'Posts',
      name: 'Muflah',
      handle: '@muflah',
      initials: 'M',
      tone: 'sage' as const,
      summary: 'The dark mode should be darker.',
    },
    {
      id: 'posts-connections',
      type: 'Posts',
      name: 'Muflah',
      handle: '@muflah',
      initials: 'M',
      tone: 'sun' as const,
      summary: 'Bug: Connections page ALL tab is not showing all connections.',
    },
  ];
  const results = normalizedQuery
    ? fallbackResults.filter((result) => `${result.type} ${result.name} ${result.handle} ${result.summary}`.toLowerCase().includes(normalizedQuery))
    : [];

  return (
    <PageSurface className="search-screen" variant="list">
      <div className="search-results-list">
        {query ? (
          results.length > 0 ? (
            results.map((result) => (
              <ListRow
                key={result.id}
                title={<ProfileCard name={result.name} handle={result.handle} initials={result.initials} tone={result.tone} href={`/${result.handle.replace('@', '')}`} />}
                subtitle={result.summary}
                meta={result.type}
                className="search-result-row"
              />
            ))
          ) : (
            <div className="connections-empty">
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
              <p>No results found.</p>
              <span>Try another search.</span>
            </div>
          )
        ) : (
          <div className="connections-empty">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <p>Search Friink.</p>
            <span>Use the header search to find people and posts.</span>
          </div>
        )}
      </div>
    </PageSurface>
  );
}

export function CalendarScreen() {
  return <><ScreenHeading eyebrow="Make time" title="Calendar" copy="A gentle view of the moments you have planned." /><div className="calendar-top"><button className="icon-button">‹</button><strong>August 2026</strong><button className="icon-button">›</button></div><div className="calendar-grid">{['S','M','T','W','T','F','S'].map((day, index) => <span className="calendar-weekday" key={`${day}-${index}`}>{day}</span>)}{Array.from({ length: 31 }, (_, index) => <span className={`calendar-day${[5, 11, 17, 22].includes(index + 1) ? ' has-event' : ''}${index + 1 === 11 ? ' today' : ''}`} key={index}>{index + 1}</span>)}</div><div className="section-heading"><h2>Coming up</h2><button className="primary-button">＋ Add event</button></div><div className="event-list"><ListRow avatar={<span className="event-date">17<span>MON</span></span>} title="Sunday market" subtitle="10:00 AM · With Maya" trailing={<span className="event-dot coral-dot" />} className="event-row" /><ListRow avatar={<span className="event-date">22<span>SAT</span></span>} title="Dinner at Luma" subtitle="7:30 PM · With your circle" trailing={<span className="event-dot green-dot" />} className="event-row" /></div></>;
}

export function DirectoryScreen() {
  return <><ScreenHeading eyebrow="Your people" title="Directory" copy="Everyone you care about, easy to find." /><div className="message-search">⌕ <span>Search your directory</span></div><div className="directory-section"><p className="directory-label">A · 2 people</p><ListRow avatar={<span className="avatar avatar-mint">AM</span>} title="Alex Morgan" subtitle="You · 34 connections" trailing={<button className="icon-button" type="button">···</button>} className="directory-row" /><ListRow avatar={<span className="avatar avatar-coral">AL</span>} title="Alina Ross" subtitle="12 shared connections" trailing={<button className="icon-button" type="button">···</button>} className="directory-row" /></div><div className="directory-section"><p className="directory-label">J · 1 person</p><ListRow avatar={<span className="avatar avatar-sage">JB</span>} title="Jon Bell" subtitle="8 shared connections" trailing={<button className="icon-button" type="button">···</button>} className="directory-row" /></div></>;
}

export function ScreenForNav({ activeNav }: { activeNav: string }) {
  if (activeNav === 'Questions') return <QuestionsScreen />;
  if (activeNav === 'Chat') return <MessagesScreen />;
  if (activeNav === 'Calendar') return <CalendarScreen />;
  if (activeNav === 'Directory') return <DirectoryScreen />;
  return null;
}

export function FloatingBar() {
  return navItems.slice(0, 4).map((item) => <span key={item.label}>{item.label}</span>);
}
