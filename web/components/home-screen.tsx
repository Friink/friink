'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import { flushSync } from 'react-dom';
import { FeedPost } from '@/components/feed-post';
import { PageSurface } from '@/components/page-surface';
import { getFeedContext, listNewerPosts, listPosts, type ApiFeedContext, type ApiFeedPage, type ApiPost } from '@/lib/auth';
import type { Post } from '@/lib/data';

const FEED_PAGE_SIZE = 20;
const FEED_CONTEXT_BEFORE = 10;
const FEED_CONTEXT_AFTER = 10;
const POLL_INTERVAL_MS = 10_000;
const SCROLL_IDLE_MS = 180;
const VIEW_PERSIST_THROTTLE_MS = 500;
const RESTORE_SCROLL_OFFSET = 96;
const PULL_TRIGGER_PX = 72;
const MAX_PULL_PX = 120;
const LAST_VIEWED_POST_KEY = 'friink-home-last-viewed-post';

type HomeScreenProps = {
  posts?: Post[];
  activeFilter?: 'all' | 'following';
  onFilterChange?: (id: string) => void;
  onReply?: (post: Post) => void;
  onQuote?: (post: Post) => void;
  injectedPost?: Post | null;
  onInjectedPostConsumed?: () => void;
};

type FeedRefreshReason = 'resume_pending' | 'poll_failed' | null;

type SavedFeedPosition = {
  postId: string;
  savedAt: string;
};

function getInitials(value: string) {
  return (
    value
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2) || 'FR'
  );
}

function mapApiPost(post: ApiPost): Post {
  return {
    id: post.id,
    publicId: post.public_id,
    slug: post.slug,
    kind: post.kind,
    name: post.author_display_name || post.author_username,
    handle: `@${post.author_username}`,
    initials: getInitials(post.author_display_name || post.author_username),
    imageUrl: post.profile_picture_url,
    tone: 'mint',
    createdAt: post.created_at,
    text: post.content,
    connectionType: 'following',
    isConnection: true,
    isStarred: false,
    replies: post.reply_count,
    quotes: post.quote_count,
    reactions: 0,
    quotedPost: post.quoted_post
      ? {
          id: post.quoted_post.id,
          authorUsername: post.quoted_post.author_username,
          authorDisplayName: post.quoted_post.author_display_name,
          content: post.quoted_post.content,
          mediaCount: post.quoted_post.media_count,
          unavailable: post.quoted_post.unavailable,
        }
      : null,
  };
}

function comparePostsDescending(left: Pick<Post, 'createdAt' | 'id'>, right: Pick<Post, 'createdAt' | 'id'>) {
  const leftTime = new Date(left.createdAt).getTime();
  const rightTime = new Date(right.createdAt).getTime();
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }
  return right.id.localeCompare(left.id);
}

function dedupeAndSortPosts(posts: Post[]) {
  const postMap = new Map<string, Post>();
  for (const post of posts) {
    if (!postMap.has(post.id)) {
      postMap.set(post.id, post);
    }
  }

  return [...postMap.values()].sort(comparePostsDescending);
}

function mergeOlderPosts(current: Post[], incoming: Post[]) {
  const existingIds = new Set(current.map((post) => post.id));
  const additions = incoming.filter((post) => !existingIds.has(post.id));
  return [...current, ...additions].sort(comparePostsDescending);
}

function mergeNewerPosts(current: Post[], incoming: Post[]) {
  const existingIds = new Set(current.map((post) => post.id));
  const additions = incoming.filter((post) => !existingIds.has(post.id));
  if (additions.length === 0) {
    return current;
  }
  return dedupeAndSortPosts([...additions, ...current]);
}

function readSavedFeedPosition(): SavedFeedPosition | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(LAST_VIEWED_POST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedFeedPosition>;
    if (typeof parsed.postId !== 'string' || !parsed.postId.trim()) return null;
    return {
      postId: parsed.postId,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function persistSavedFeedPosition(postId: string) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      LAST_VIEWED_POST_KEY,
      JSON.stringify({
        postId,
        savedAt: new Date().toISOString(),
      } satisfies SavedFeedPosition),
    );
  } catch {
    // Ignore storage failures and keep the feed usable.
  }
}

function clearSavedFeedPosition() {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(LAST_VIEWED_POST_KEY);
  } catch {
    // Ignore storage failures and continue with a fresh feed load.
  }
}

function isWindowAtTop() {
  return typeof window !== 'undefined' ? window.scrollY <= 8 : true;
}

function getTopVisiblePostId() {
  if (typeof window === 'undefined') return null;

  const postElements = [...document.querySelectorAll<HTMLElement>('[data-feed-post-id]')];
  const viewportHeight = window.innerHeight;

  const fullyVisible = postElements.find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= viewportHeight;
  });
  if (fullyVisible) {
    return fullyVisible.dataset.feedPostId ?? null;
  }

  const partiallyVisible = postElements.find((element) => {
    const rect = element.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < viewportHeight;
  });

  return partiallyVisible?.dataset.feedPostId ?? null;
}

export function HomeScreen({ posts = [], activeFilter = 'all', onFilterChange, onReply, onQuote, injectedPost, onInjectedPostConsumed }: HomeScreenProps) {
  void onFilterChange;
  const initialSeedPosts = useMemo(() => dedupeAndSortPosts(posts), [posts]);
  const [feedPosts, setFeedPosts] = useState<Post[]>(initialSeedPosts);
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(initialSeedPosts.length === 0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [manualRefreshReason, setManualRefreshReason] = useState<FeedRefreshReason>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isDesktopRefresh, setIsDesktopRefresh] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [restoreAnchorId, setRestoreAnchorId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const feedPostsRef = useRef<Post[]>(initialSeedPosts);
  const nextCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const loadingOlderRef = useRef(false);
  const refreshingRef = useRef(false);
  const interactionActiveRef = useRef(false);
  const pendingPrependRef = useRef<Post[]>([]);
  const scrollIdleTimeoutRef = useRef<number | null>(null);
  const persistTimeoutRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const pullActiveRef = useRef(false);

  const visiblePosts = useMemo(
    () => (activeFilter === 'following' ? feedPosts.filter((post) => post.isConnection) : feedPosts),
    [activeFilter, feedPosts],
  );

  function updateFeedPage(page: ApiFeedPage | ApiFeedContext, mappedPosts: Post[]) {
    feedPostsRef.current = mappedPosts;
    setFeedPosts(mappedPosts);
    nextCursorRef.current = page.next_cursor;
    hasMoreRef.current = page.has_more;
    setHasMore(page.has_more);
  }

  function scheduleScrollIdleFlush() {
    if (typeof window === 'undefined') return;
    if (scrollIdleTimeoutRef.current) {
      window.clearTimeout(scrollIdleTimeoutRef.current);
    }
    scrollIdleTimeoutRef.current = window.setTimeout(() => {
      interactionActiveRef.current = false;
      if (pendingPrependRef.current.length > 0) {
        const deferred = pendingPrependRef.current;
        pendingPrependRef.current = [];
        applyPrepend(deferred);
      }
    }, SCROLL_IDLE_MS);
  }

  function markInteractionActive() {
    interactionActiveRef.current = true;
    scheduleScrollIdleFlush();
  }

  function applyPrepend(incoming: Post[]) {
    const newPosts = incoming.filter((post) => !feedPostsRef.current.some((existing) => existing.id === post.id));
    if (newPosts.length === 0) {
      setManualRefreshReason(null);
      return;
    }

    const preserveScroll = !isWindowAtTop();
    const previousHeight = preserveScroll ? document.documentElement.scrollHeight : 0;

    flushSync(() => {
      const merged = mergeNewerPosts(feedPostsRef.current, newPosts);
      feedPostsRef.current = merged;
      setFeedPosts(merged);
    });

    if (preserveScroll) {
      const nextHeight = document.documentElement.scrollHeight;
      const heightDelta = Math.max(0, nextHeight - previousHeight);
      if (heightDelta > 0) {
        window.scrollTo({ top: window.scrollY + heightDelta });
      }
    }

    setManualRefreshReason(null);
  }

  async function fetchLatestPosts(options: { manual?: boolean } = {}) {
    if (refreshingRef.current) return;
    const currentTopPost = feedPostsRef.current[0];
    if (!currentTopPost) return;

    refreshingRef.current = true;
    setRefreshing(true);
    try {
      const newerPosts = await listNewerPosts({
        afterCreatedAt: currentTopPost.createdAt,
        afterId: currentTopPost.id,
        limit: FEED_PAGE_SIZE,
        feed: activeFilter === 'following' ? 'following' : 'explore',
      });
      const mappedNewerPosts = newerPosts.map(mapApiPost);

      if (mappedNewerPosts.length > 0) {
        if (interactionActiveRef.current) {
          pendingPrependRef.current = dedupeAndSortPosts([...pendingPrependRef.current, ...mappedNewerPosts]);
        } else {
          applyPrepend(mappedNewerPosts);
        }
      } else {
        setManualRefreshReason(null);
      }
    } catch {
      if (!options.manual) {
        setManualRefreshReason('poll_failed');
      }
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }

  async function loadOlderPosts() {
    if (loadingOlderRef.current || !nextCursorRef.current || !hasMoreRef.current) return;

    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const page = await listPosts({ cursor: nextCursorRef.current, limit: FEED_PAGE_SIZE, feed: activeFilter === 'following' ? 'following' : 'explore' });
      const merged = mergeOlderPosts(feedPostsRef.current, page.items.map(mapApiPost));
      updateFeedPage(page, merged);
    } catch {
      // Keep the visible feed stable; the user can keep reading.
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }

  async function loadInitialFeed() {
    setLoadingInitial(true);
    setLoadError(null);

    const savedPosition = readSavedFeedPosition();

    try {
      if (savedPosition) {
        try {
          const context = await getFeedContext(savedPosition.postId, {
            beforeLimit: FEED_CONTEXT_BEFORE,
            afterLimit: FEED_CONTEXT_AFTER,
            feed: activeFilter === 'following' ? 'following' : 'explore',
          });
          const restoredPosts = dedupeAndSortPosts(context.items.map(mapApiPost));
          updateFeedPage(context, restoredPosts);
          setRestoreAnchorId(context.anchor_post_id);
          setManualRefreshReason('resume_pending');
          return;
        } catch {
          clearSavedFeedPosition();
        }
      }

      const page = await listPosts({ limit: FEED_PAGE_SIZE, feed: activeFilter === 'following' ? 'following' : 'explore' });
      const initialPosts = dedupeAndSortPosts(page.items.map(mapApiPost));
      updateFeedPage(page, initialPosts);
    } catch {
      if (activeFilter === 'all' && initialSeedPosts.length > 0) {
        setFeedPosts(initialSeedPosts);
        feedPostsRef.current = initialSeedPosts;
        setLoadError(null);
      } else {
        setLoadError('Could not load the Home feed.');
      }
    } finally {
      setLoadingInitial(false);
    }
  }

  useEffect(() => {
    feedPostsRef.current = [];
    setFeedPosts([]);
    nextCursorRef.current = null;
    hasMoreRef.current = true;
    setHasMore(true);
    setRestoreAnchorId(null);
    void loadInitialFeed();
  }, [activeFilter]);

  useEffect(() => {
    if (activeFilter === 'all' && feedPostsRef.current.length === 0 && initialSeedPosts.length > 0) {
      feedPostsRef.current = initialSeedPosts;
      setFeedPosts(initialSeedPosts);
    }
  }, [initialSeedPosts]);

  useLayoutEffect(() => {
    if (!restoreAnchorId || typeof window === 'undefined') return;

    const anchorElement = document.querySelector<HTMLElement>(`[data-feed-post-id="${restoreAnchorId}"]`);
    if (!anchorElement) return;

    const anchorTop = window.scrollY + anchorElement.getBoundingClientRect().top - RESTORE_SCROLL_OFFSET;
    window.scrollTo({ top: Math.max(0, anchorTop) });
    setRestoreAnchorId(null);
  }, [restoreAnchorId, visiblePosts]);

  useEffect(() => {
    feedPostsRef.current = feedPosts;
  }, [feedPosts]);

  useEffect(() => {
    setIsAtTop(isWindowAtTop());

    const updateTopState = () => {
      setIsAtTop(isWindowAtTop());
      markInteractionActive();

      if (persistTimeoutRef.current) {
        window.clearTimeout(persistTimeoutRef.current);
      }

      persistTimeoutRef.current = window.setTimeout(() => {
        const topVisiblePostId = getTopVisiblePostId();
        if (topVisiblePostId) {
          persistSavedFeedPosition(topVisiblePostId);
        }
      }, VIEW_PERSIST_THROTTLE_MS);
    };

    const startInteraction = () => markInteractionActive();
    const endInteraction = () => scheduleScrollIdleFlush();

    window.addEventListener('scroll', updateTopState, { passive: true });
    window.addEventListener('wheel', startInteraction, { passive: true });
    window.addEventListener('touchstart', startInteraction, { passive: true });
    window.addEventListener('touchmove', startInteraction, { passive: true });
    window.addEventListener('touchend', endInteraction, { passive: true });
    window.addEventListener('pointerdown', startInteraction, { passive: true });
    window.addEventListener('pointerup', endInteraction, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateTopState);
      window.removeEventListener('wheel', startInteraction);
      window.removeEventListener('touchstart', startInteraction);
      window.removeEventListener('touchmove', startInteraction);
      window.removeEventListener('touchend', endInteraction);
      window.removeEventListener('pointerdown', startInteraction);
      window.removeEventListener('pointerup', endInteraction);
      if (persistTimeoutRef.current) {
        window.clearTimeout(persistTimeoutRef.current);
      }
      if (scrollIdleTimeoutRef.current) {
        window.clearTimeout(scrollIdleTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px) and (pointer: fine)');
    const syncDesktopMode = () => setIsDesktopRefresh(media.matches);
    syncDesktopMode();
    media.addEventListener('change', syncDesktopMode);
    return () => media.removeEventListener('change', syncDesktopMode);
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadOlderPosts();
        }
      },
      {
        root: null,
        rootMargin: '0px 0px 320px 0px',
        threshold: 0,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeFilter, visiblePosts.length]);

  useEffect(() => {
    async function runForegroundRefresh() {
      if (document.hidden) {
        if (pollIntervalRef.current) {
          window.clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return;
      }

      setManualRefreshReason('resume_pending');
      await fetchLatestPosts();

      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
      }
      pollIntervalRef.current = window.setInterval(() => {
        void fetchLatestPosts();
      }, POLL_INTERVAL_MS);
    }

    void runForegroundRefresh();

    const handleVisibilityChange = () => {
      void runForegroundRefresh();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
      }
    };
  }, [activeFilter]);

  useEffect(() => {
    if (!injectedPost) return;
    if (feedPostsRef.current.some((post) => post.id === injectedPost.id)) {
      onInjectedPostConsumed?.();
      return;
    }

    if (interactionActiveRef.current) {
      pendingPrependRef.current = dedupeAndSortPosts([...pendingPrependRef.current, injectedPost]);
    } else {
      applyPrepend([injectedPost]);
    }
    onInjectedPostConsumed?.();
  }, [injectedPost, onInjectedPostConsumed]);

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    if (isDesktopRefresh || !isAtTop || manualRefreshReason === null || refreshing) return;
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
    pullActiveRef.current = touchStartYRef.current !== null;
  }

  function handleTouchMove(event: TouchEvent<HTMLElement>) {
    if (!pullActiveRef.current || touchStartYRef.current === null || isDesktopRefresh) return;

    const currentY = event.touches[0]?.clientY ?? touchStartYRef.current;
    const delta = currentY - touchStartYRef.current;
    if (delta <= 0 || !isAtTop) {
      setPullDistance(0);
      return;
    }

    event.preventDefault();
    setPullDistance(Math.min(MAX_PULL_PX, delta * 0.55));
  }

  function resetPullState() {
    pullActiveRef.current = false;
    touchStartYRef.current = null;
    setPullDistance(0);
  }

  async function handleManualRefresh() {
    await fetchLatestPosts({ manual: true });
  }

  async function handleTouchEnd() {
    const shouldTriggerRefresh = pullDistance >= PULL_TRIGGER_PX;
    resetPullState();
    if (shouldTriggerRefresh) {
      await handleManualRefresh();
    }
  }

  if (loadingInitial && visiblePosts.length === 0) {
    return (
      <PageSurface className="home-feed home-feed-state" variant="list">
        <div className="home-feed-message">Loading the latest posts...</div>
      </PageSurface>
    );
  }

  if (loadError && visiblePosts.length === 0) {
    return (
      <PageSurface className="home-feed home-feed-state" variant="list">
        <div className="home-feed-message">{loadError}</div>
      </PageSurface>
    );
  }

  const showRefreshAffordance = isAtTop && manualRefreshReason !== null;

  return (
    <PageSurface
      className="home-feed"
      variant="list"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => {
        void handleTouchEnd();
      }}
    >
      {showRefreshAffordance && (
        <button
          className={`home-feed-refresh${refreshing ? ' home-feed-refresh-loading' : ''}${!isDesktopRefresh ? ' home-feed-refresh-touch' : ''}`}
          type="button"
          onClick={() => {
            void handleManualRefresh();
          }}
          style={!isDesktopRefresh ? { height: `${Math.max(40, pullDistance)}px` } : undefined}
        >
          <span>{refreshing ? 'Refreshing...' : manualRefreshReason === 'poll_failed' ? 'Tap to refresh feed' : 'Check for new posts'}</span>
        </button>
      )}

      {visiblePosts.map((post) => (
        <div key={post.id} data-feed-post-id={post.id}>
          <FeedPost post={post} onReply={onReply} onQuote={onQuote} />
        </div>
      ))}

      <div ref={sentinelRef} className="home-feed-sentinel" aria-hidden="true" />

      {loadingOlder && <div className="home-feed-message">Loading older posts...</div>}
      {!hasMore && visiblePosts.length > 0 && <div className="home-feed-message">You're all caught up.</div>}
      {!loadingOlder && visiblePosts.length === 0 && <div className="home-feed-message">No posts to show yet.</div>}
    </PageSurface>
  );
}
