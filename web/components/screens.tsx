"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ListRow } from '@/components/list-row';
import { PageSurface } from '@/components/page-surface';
import { ProfileCard } from '@/components/profile-card';
import { navItems } from '@/lib/data';
import { acceptChatRequest, listConversations, loadAuthSession, updateChatSettings, type ApiConversation } from '@/lib/auth';
import { formatRelativeTime } from '@/lib/time';

function ScreenHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="screen-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="intro-copy">{copy}</p></div>;
}

export function QuestionsScreen() {
  return <><ScreenHeading eyebrow="Ask your people" title="Questions" copy="Small questions are a good way to start a conversation." /><div className="question-prompt"><span className="prompt-spark">✦</span><div><strong>What are you curious about?</strong><p>Ask your circle anything, big or small.</p></div><button className="primary-button">Ask a question</button></div><div className="section-heading"><h2>Recent questions</h2><button className="text-button">See all <span>→</span></button></div><div className="question-list"><div className="question-card"><div className="question-meta"><ProfileCard name="Maya Chen" handle="@mayachen" tone="coral" initials="MC" /><span><strong>Maya Chen</strong> asked <small>25 min ago</small></span></div><p>What is one place you would return to in a heartbeat?</p><div className="question-footer"><span>12 answers</span><button className="text-button">Answer →</button></div></div><div className="question-card"><div className="question-meta"><ProfileCard name="Jon Bell" handle="@jonbell" tone="sage" initials="JB" /><span><strong>Jon Bell</strong> asked <small>1 hr ago</small></span></div><p>What are you listening to on repeat this week?</p><div className="question-footer"><span>7 answers</span><button className="text-button">Answer →</button></div></div></div></>;
}

type MessagesTab = 'all' | 'muted' | 'requests' | 'archived';

export function MessagesScreen({ activeTab = 'all' }: { activeTab?: MessagesTab }) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = loadAuthSession();
    if (!session) return;
    let stopped = false;
    let busy = false;
    let timer: number | null = null;

    const refresh = async () => {
      if (stopped || busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const nextConversations = await listConversations(session.accessToken);
        if (!stopped) setConversations(nextConversations);
      } finally {
        busy = false;
        if (!stopped) setLoading(false);
      }
    };

    const schedule = () => {
      if (!stopped && document.visibilityState !== 'hidden') timer = window.setTimeout(async () => { await refresh(); schedule(); }, 4000);
    };

    const resume = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
      void refresh();
      schedule();
    };

    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    void refresh();
    schedule();

    return () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
    };
  }, []);

  const visibleConversations = conversations.filter((conversation) => {
    if (activeTab === 'muted') return conversation.muted;
    if (activeTab === 'requests') return conversation.status === 'pending';
    if (activeTab === 'archived') return conversation.archived;
    return conversation.status === 'accepted' && !conversation.archived;
  });

  async function changeSetting(conversation: ApiConversation, input: { muted?: boolean; archived?: boolean }) {
    const session = loadAuthSession();
    if (!session) return;
    const updated = await updateChatSettings(session.accessToken, conversation.id, input);
    setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  async function acceptRequest(conversation: ApiConversation) {
    const session = loadAuthSession();
    if (!session) return;
    const updated = await acceptChatRequest(session.accessToken, conversation.id);
    setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
  }

  return (
    <PageSurface className="messages-screen" variant="list">
      <div className="message-list">
        {loading && <div className="home-feed-message">Loading chats...</div>}
        {!loading && visibleConversations.map((conversation) => (
          <ListRow
            key={conversation.id}
            avatar={
              <Link className="message-row-profile" href={`/${conversation.participant.username}`} aria-label={`Open ${conversation.participant.display_name || conversation.participant.username} profile`}>
                <ProfileCard name={conversation.participant.display_name || conversation.participant.username} handle={`@${conversation.participant.username}`} imageUrl={conversation.participant.profile_picture_url} />
              </Link>
            }
            title={
              <Link className="message-profile-link" href={`/${conversation.participant.username}`}>
                {conversation.participant.display_name || conversation.participant.username}
              </Link>
            }
            subtitle={conversation.preview}
            meta={formatRelativeTime(conversation.updated_at)}
            trailing={
              <span className="chat-row-actions">
                {conversation.status === 'pending' && conversation.requester_id !== loadAuthSession()?.user.id ? <button className="text-button" type="button" onClick={(event) => { event.stopPropagation(); acceptRequest(conversation).catch(() => undefined); }}>Accept</button> : null}
                <button className="icon-button" type="button" aria-label={conversation.muted ? 'Unmute chat' : 'Mute chat'} onClick={(event) => { event.stopPropagation(); changeSetting(conversation, { muted: !conversation.muted }).catch(() => undefined); }}><i className={`fa-solid ${conversation.muted ? 'fa-bell' : 'fa-bell-slash'}`} aria-hidden="true" /></button>
                <button className="icon-button" type="button" aria-label={conversation.archived ? 'Unarchive chat' : 'Archive chat'} onClick={(event) => { event.stopPropagation(); changeSetting(conversation, { archived: !conversation.archived }).catch(() => undefined); }}><i className={`fa-solid ${conversation.archived ? 'fa-box-open' : 'fa-box-archive'}`} aria-hidden="true" /></button>
                {conversation.unread_count > 0 ? <span className="unread-count-pill" aria-label={`${conversation.unread_count} unread message${conversation.unread_count === 1 ? '' : 's'}`}>{conversation.unread_count > 99 ? '99+' : conversation.unread_count}</span> : null}
              </span>
            }
            unread={conversation.unread}
            onClick={() => router.push(`/${conversation.participant.username}/chat`)}
            ariaLabel={`Open chat with ${conversation.participant.display_name || conversation.participant.username}`}
          />
        ))}
        {!loading && visibleConversations.length === 0 && <div className="home-feed-message">No chats to show yet.</div>}
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
  return <><ScreenHeading eyebrow="Your people" title="Directory" copy="Everyone you care about, easy to find." /><div className="message-search">⌕ <span>Search your directory</span></div><div className="directory-section"><p className="directory-label">A · 2 people</p><ListRow avatar={<ProfileCard name="Alex Morgan" handle="@alexmorgan" tone="mint" initials="AM" />} title="Alex Morgan" subtitle="You · 34 connections" trailing={<button className="icon-button" type="button">···</button>} className="directory-row" /><ListRow avatar={<ProfileCard name="Alina Ross" handle="@alinaross" tone="coral" initials="AL" />} title="Alina Ross" subtitle="12 shared connections" trailing={<button className="icon-button" type="button">···</button>} className="directory-row" /></div><div className="directory-section"><p className="directory-label">J · 1 person</p><ListRow avatar={<ProfileCard name="Jon Bell" handle="@jonbell" tone="sage" initials="JB" />} title="Jon Bell" subtitle="8 shared connections" trailing={<button className="icon-button" type="button">···</button>} className="directory-row" /></div></>;
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
