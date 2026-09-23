"use client";

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ListRow } from '@/components/list-row';
import { PageSurface } from '@/components/page-surface';
import { ProfileCard } from '@/components/profile-card';
import { ActionMenu } from '@/components/action-menu';
import { navItems } from '@/lib/data';
import { acceptChatRequest, blockUser, listConversations, loadAuthSession, searchContent, updateChatSettings, type ApiConversation, type ApiSearchResult } from '@/lib/auth';
import { formatRelativeTime } from '@/lib/time';

function ScreenHeading({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <div className="screen-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="intro-copy">{copy}</p></div>;
}

export function QuestionsScreen() {
  return <><ScreenHeading eyebrow="Ask your people" title="Questions" copy="Small questions are a good way to start a conversation." /><div className="question-prompt"><span className="prompt-spark">✦</span><div><strong>What are you curious about?</strong><p>Ask your circle anything, big or small.</p></div><button className="button-primary">Ask a question</button></div><div className="section-heading"><h2>Recent questions</h2><button className="text-link">See all <span>→</span></button></div><div className="question-list"><div className="question-card"><div className="question-meta"><ProfileCard name="Maya Chen" handle="@mayachen" tone="coral" initials="MC" /><span><strong>Maya Chen</strong> asked <small>25 min ago</small></span></div><p>What is one place you would return to in a heartbeat?</p><div className="question-footer"><span>12 answers</span><button className="text-link">Answer →</button></div></div><div className="question-card"><div className="question-meta"><ProfileCard name="Jon Bell" handle="@jonbell" tone="sage" initials="JB" /><span><strong>Jon Bell</strong> asked <small>1 hr ago</small></span></div><p>What are you listening to on repeat this week?</p><div className="question-footer"><span>7 answers</span><button className="text-link">Answer →</button></div></div></div></>;
}

type MessagesTab = 'all' | 'muted' | 'requests' | 'archived';
export type DirectoryTab = 'all' | 'registered';

function getConversationPreview(conversation: ApiConversation) {
  return conversation.preview || 'No messages yet';
}

function getConversationState(conversation: ApiConversation, currentUserId: string | undefined) {
  if (conversation.unread_count > 0) return `${conversation.unread_count} new message${conversation.unread_count === 1 ? '' : 's'}`;
  if (conversation.status === 'pending' && conversation.requester_id !== currentUserId) return 'New message';
  if (conversation.preview_sender_id === currentUserId && conversation.preview_receipt_status) {
    return conversation.preview_receipt_status === 'read' ? 'Seen' : conversation.preview_receipt_status === 'delivered' ? 'Delivered' : 'Sent';
  }
  return '';
}

function ChatConversationRow({ conversation, currentUserId, onOpen, onSettingChange, onAccept, onBlocked }: { conversation: ApiConversation; currentUserId?: string; onOpen: () => void; onSettingChange: (input: { muted?: boolean; archived?: boolean }) => Promise<void>; onAccept: () => Promise<void>; onBlocked: () => void }) {
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const state = getConversationState(conversation, currentUserId);

  async function handleBlock() {
    const session = loadAuthSession();
    if (!session || blockBusy) return;
    setBlockBusy(true);
    try {
      await blockUser(session.accessToken, conversation.participant.username);
      onBlocked();
    } finally {
      setBlockBusy(false);
    }
  }

  const menuItems = [
    ...(conversation.status === 'pending' && conversation.requester_id !== currentUserId ? [{ label: 'Accept request', icon: 'fa-check', onClick: () => { void onAccept(); } }] : []),
    { label: conversation.muted ? 'Unmute chat' : 'Mute chat', icon: conversation.muted ? 'fa-bell' : 'fa-bell-slash', onClick: () => { void onSettingChange({ muted: !conversation.muted }); } },
    { label: conversation.archived ? 'Unarchive chat' : 'Archive chat', icon: conversation.archived ? 'fa-box-open' : 'fa-box-archive', onClick: () => { void onSettingChange({ archived: !conversation.archived }); } },
    { label: 'Block user', icon: 'fa-ban', dividerBefore: true, disabled: blockBusy, onClick: () => { void handleBlock().catch(() => undefined); } },
  ];

  return (
    <ListRow
      className="chat-list-row"
      title={<span className="chat-row-profile" onClick={(event) => event.stopPropagation()}><ProfileCard href={`/${conversation.participant.username}`} name={conversation.participant.display_name || conversation.participant.username} handle={`@${conversation.participant.username}`} imageUrl={conversation.participant.profile_picture_url} showProfessionalBadge={conversation.participant.show_professional_badge} /></span>}
      middle={<span className="chat-row-details"><span className="chat-row-preview">{getConversationPreview(conversation)}</span><span className="chat-row-date">{formatRelativeTime(conversation.updated_at)}</span>{state ? <span className={`chat-row-state${conversation.unread || state === 'New message' ? ' is-unread' : ''}`}>{state}</span> : null}</span>}
      trailing={<button ref={menuButtonRef} className="icon-button chat-row-menu-button" type="button" aria-label="Chat actions" aria-haspopup="menu" aria-expanded={menuOpen} onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open); }}><i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" /><ActionMenu open={menuOpen} anchorRef={menuButtonRef} items={menuItems} ariaLabel="Chat actions" onClose={() => setMenuOpen(false)} /></button>}
      unread={conversation.unread}
      onClick={onOpen}
      ariaLabel={`Open chat with ${conversation.participant.display_name || conversation.participant.username}`}
    />
  );
}

export function MessagesScreen({ activeTab = 'all' }: { activeTab?: MessagesTab }) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const currentUserId = loadAuthSession()?.user.id;

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
        if (!stopped) {
          setConversations(nextConversations);
          setLoadError(null);
        }
      } catch (error) {
        if (!stopped) setLoadError(error instanceof Error ? error.message : 'Could not load chats.');
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
  }, [retryVersion]);

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
        {!loading && loadError && (
          <div className="home-feed-message chat-load-error" role="alert">
            <p>Couldn’t load your chats.</p>
            <span>{loadError}</span>
            <button className="button-secondary" type="button" onClick={() => { setLoading(true); setRetryVersion((current) => current + 1); }}>Try again</button>
          </div>
        )}
        {!loading && !loadError && visibleConversations.map((conversation) => (
          <ChatConversationRow
            key={conversation.id}
            conversation={conversation}
            currentUserId={currentUserId}
            onOpen={() => router.push(`/${conversation.participant.username}/chat`)}
            onSettingChange={(input) => changeSetting(conversation, input)}
            onAccept={() => acceptRequest(conversation)}
            onBlocked={() => setConversations((current) => current.filter((item) => item.id !== conversation.id))}
          />
        ))}
        {!loading && !loadError && visibleConversations.length === 0 && <div className="home-feed-message">No chats to show yet.</div>}
      </div>
    </PageSurface>
  );
}

function getSearchParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw ? decodeURIComponent(raw) : '';
}

export function SearchScreen({ initialQuery }: { initialQuery?: string }) {
  const params = useParams<{ query?: string | string[] }>();
  const searchParams = useSearchParams();
  const query = initialQuery ?? getSearchParam(params?.query);
  const filterParam = searchParams.get('filter');
  const filter: 'all' | 'people' | 'posts' | 'messages' = filterParam === 'people' || filterParam === 'posts' || filterParam === 'messages' ? filterParam : searchParams.get('scope') === 'messages' ? 'messages' : 'all';
  const scope = filter === 'messages' ? 'messages' : 'global';
  const kind = filter === 'people' ? 'person' : filter === 'posts' ? 'post' : 'all';
  const sortParam = searchParams.get('sort');
  const sort: 'relevance' | 'newest' | 'oldest' = sortParam === 'newest' || sortParam === 'oldest' ? sortParam : 'relevance';
  const dateParam = searchParams.get('date');
  const date: 'any' | 'day' | 'week' | 'month' | 'custom' = dateParam === 'day' || dateParam === 'week' || dateParam === 'month' || dateParam === 'custom' ? dateParam : 'any';
  const dateFrom = searchParams.get('date_from') || undefined;
  const dateTo = searchParams.get('date_to') || undefined;
  const [results, setResults] = useState<ApiSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = loadAuthSession();
    if (date === 'custom' && (!dateFrom || !dateTo || dateFrom > dateTo)) {
      setResults([]);
      setError('Choose a valid date range.');
      setLoading(false);
      return;
    }
    if (!query || !session) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    let stopped = false;
    setLoading(true);
    setError(null);
    searchContent(session.accessToken, query, scope, 24, kind, { sort, date, dateFrom, dateTo })
      .then((response) => { if (!stopped) setResults(response.items); })
      .catch((requestError) => { if (!stopped) setError(requestError instanceof Error ? requestError.message : 'Could not search Friink.'); })
      .finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [date, dateFrom, dateTo, kind, query, scope, sort]);

  return (
    <PageSurface className="search-screen" variant="list">
      <div className="search-results-list">
        {query ? (
          loading ? <div className="home-feed-message">Searching Friink…</div> : error ? <div className="home-feed-message" role="alert">{error}</div> : results.length > 0 ? (
            results.map((result) => (
              <ListRow
                key={result.id}
                title={<ProfileCard name={result.name} handle={result.username ? `@${result.username}` : ''} initials={result.name.slice(0, 2).toUpperCase()} tone={result.type === 'post' ? 'sage' : result.type === 'conversation' ? 'sun' : 'mint'} imageUrl={result.profile_picture_url} href={result.href ?? undefined} />}
                subtitle={result.summary}
                meta={result.type === 'person' ? 'People' : result.type === 'post' ? 'Posts' : 'Conversations'}
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
  return <><ScreenHeading eyebrow="Make time" title="Calendar" copy="A gentle view of the moments you have planned." /><div className="calendar-top"><button className="icon-button" aria-label="Previous month">‹</button><strong>August 2026</strong><button className="icon-button" aria-label="Next month">›</button></div><div className="calendar-grid">{['S','M','T','W','T','F','S'].map((day, index) => <span className="calendar-weekday" key={`${day}-${index}`}>{day}</span>)}{Array.from({ length: 31 }, (_, index) => <span className={`calendar-day${[5, 11, 17, 22].includes(index + 1) ? ' has-event' : ''}${index + 1 === 11 ? ' today' : ''}`} key={index}>{index + 1}</span>)}</div><div className="section-heading"><h2>Coming up</h2><button className="button-primary">＋ Add event</button></div><div className="event-list"><ListRow avatar={<span className="event-date">17<span>MON</span></span>} title="Sunday market" subtitle="10:00 AM · With Maya" trailing={<span className="event-dot coral-dot" />} className="event-row" /><ListRow avatar={<span className="event-date">22<span>SAT</span></span>} title="Dinner at Luma" subtitle="7:30 PM · With your circle" trailing={<span className="event-dot green-dot" />} className="event-row" /></div></>;
}

const directoryEntries = [
  { username: 'alexmorgan', name: 'Alex Morgan', about: 'Counsellor helping people make space for change.', tone: 'mint', initials: 'AM', professional: true, registered: false },
  { username: 'alinaross', name: 'Alina Ross', about: 'Psychologist focused on accessible mental-health care.', tone: 'coral', initials: 'AR', professional: true, registered: true },
  { username: 'jonbell', name: 'Jon Bell', about: 'Mental-wellness educator and community facilitator.', tone: 'sage', initials: 'JB', professional: false, registered: true },
];

type DirectoryEntry = typeof directoryEntries[number];

function DirectoryResultRow({ entry }: { entry: DirectoryEntry }) {
  const router = useRouter();
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [following, setFollowing] = useState(entry.username === 'alinaross');

  return (
    <div className="directory-result">
      <ListRow
        title={<ProfileCard name={entry.name} handle={`@${entry.username}`} tone={entry.tone} initials={entry.initials} showProfessionalBadge={entry.professional} showRegisteredBadge={entry.registered} />}
        subtitle={entry.about}
        trailing={(
          <span className="directory-profile-actions" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button directory-icon-action" type="button" aria-label={`Chat with ${entry.name}`} title="Chat" onClick={() => router.push(`/${entry.username}/chat`)}>
              <i className="fa-regular fa-paper-plane" aria-hidden="true" />
            </button>
            <button className="icon-button directory-icon-action" type="button" aria-label={following ? `Unfollow ${entry.name}` : `Follow ${entry.name}`} title={following ? 'Unfollow' : 'Follow'} aria-pressed={following} onClick={() => setFollowing((current) => !current)}>
              <i className={`fa-solid ${following ? 'fa-user-check' : 'fa-user-plus'}`} aria-hidden="true" />
            </button>
            <button className="icon-button directory-icon-action directory-more-action" type="button" aria-label={`More actions for ${entry.name}`} title="More actions" ref={menuButtonRef} onClick={() => setMenuOpen(true)}>
              <i className="fa-solid fa-ellipsis-vertical" aria-hidden="true" />
            </button>
          </span>
        )}
        onClick={() => router.push(`/${entry.username}`)}
        ariaLabel={`Open ${entry.name} profile`}
        className="directory-row"
      />
      <ActionMenu
        open={menuOpen}
        anchorRef={menuButtonRef}
        ariaLabel={`${entry.name} profile actions`}
        onClose={() => setMenuOpen(false)}
        items={[
          { label: 'Share profile', icon: 'fa-share-nodes', onClick: () => setMenuOpen(false) },
          { label: 'Copy profile link', icon: 'fa-link', onClick: () => setMenuOpen(false) },
          { label: 'Report profile', icon: 'fa-flag', onClick: () => setMenuOpen(false) },
        ]}
      />
    </div>
  );
}

export function DirectoryScreen({ tab = 'all' }: { tab?: DirectoryTab }) {
  const entries = directoryEntries.filter((entry) => tab === 'registered' ? entry.registered : true);

  return (
    <PageSurface className="directory-screen" variant="list">
      <div className="directory-list">
        {entries.length > 0 ? entries.map((entry) => (
          <DirectoryResultRow key={entry.username} entry={entry} />
        )) : (
          <div className="connections-empty directory-empty">
            <i className="fa-solid fa-address-book" aria-hidden="true" />
            <p>No directory members yet.</p>
            <span>Try another directory view later.</span>
          </div>
        )}
      </div>
    </PageSurface>
  );
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
