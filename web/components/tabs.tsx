"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

type Tab = { id: string; label: string };

type TabsProps = {
  tabs?: Tab[];
  activeId?: string;
  onChange?: (id: string) => void;
  ariaLabel?: string;
  className?: string;
};

export function Tabs({ tabs, activeId, onChange, ariaLabel = 'Quick tabs', className = '' }: TabsProps) {
  const tabsList = useMemo<Tab[]>(() => {
    return (
      tabs ?? [
        { id: 'all', label: 'Explore' },
        { id: 'followers', label: 'Followers' },
        { id: 'following', label: 'Following' },
      ]
    );
  }, [tabs]);

  const [internalActive, setInternalActive] = useState(tabsList[0].id);
  const active = activeId ?? internalActive;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [scrollState, setScrollState] = useState({ hasOverflow: false, canScrollLeft: false, canScrollRight: false });

  useEffect(() => {
    const updateIndicator = () => {
      const container = containerRef.current;
      if (!container) return;
      const btn = container.querySelector<HTMLButtonElement>(`button[data-tab="${active}"]`);
      if (!btn) return setIndicator({ left: 0, width: 0 });
      const cRect = container.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      setIndicator((prev) => {
        const next = { left: Math.round(bRect.left - cRect.left), width: Math.round(bRect.width) };
        indicatorRef.current?.style.setProperty('--tabs-indicator-left', `${next.left}px`);
        indicatorRef.current?.style.setProperty('--tabs-indicator-width', `${next.width}px`);
        if (prev.left === next.left && prev.width === next.width) return prev;
        return next;
      });
    };

    const updateScrollState = () => {
      const viewport = scrollViewportRef.current;
      if (!viewport) return;
      const hasOverflow = viewport.scrollWidth > viewport.clientWidth + 1;
      const nextState = {
        hasOverflow,
        canScrollLeft: viewport.scrollLeft > 1,
        canScrollRight: viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1,
      };
      setScrollState((current) => current.hasOverflow === nextState.hasOverflow && current.canScrollLeft === nextState.canScrollLeft && current.canScrollRight === nextState.canScrollRight ? current : nextState);
    };

    const viewport = scrollViewportRef.current;
    updateIndicator();
    updateScrollState();
    window.addEventListener('resize', updateIndicator);
    viewport?.addEventListener('scroll', updateIndicator, { passive: true });
    viewport?.addEventListener('scroll', updateScrollState, { passive: true });
    const resizeObserver = typeof ResizeObserver === 'undefined' || !viewport
      ? null
      : new ResizeObserver(() => {
          updateIndicator();
          updateScrollState();
        });
    if (resizeObserver && viewport) resizeObserver.observe(viewport);

    return () => {
      window.removeEventListener('resize', updateIndicator);
      viewport?.removeEventListener('scroll', updateIndicator);
      viewport?.removeEventListener('scroll', updateScrollState);
      resizeObserver?.disconnect();
    };
  }, [active, tabsList]);

  const handleClick = (id: string) => {
    if (typeof onChange === 'function') onChange(id);
    else setInternalActive(id);
  };

  const scrollOneTab = (direction: 'next' | 'previous') => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const buttons = Array.from(viewport.querySelectorAll<HTMLButtonElement>('button[data-tab]'));
    const viewportRect = viewport.getBoundingClientRect();
    const firstButton = buttons[0];
    if (!firstButton) return;

    const firstButtonRect = firstButton.getBoundingClientRect();
    const contentInset = firstButtonRect.left - viewportRect.left + viewport.scrollLeft;
    const edge = viewportRect.left + contentInset;
    const target = direction === 'next'
      ? buttons.find((button) => button.getBoundingClientRect().left > edge + 1)
      : [...buttons].reverse().find((button) => button.getBoundingClientRect().left < edge - 1);
    if (!target) return;

    const targetRect = target.getBoundingClientRect();
    const targetScrollLeft = viewport.scrollLeft + targetRect.left - viewportRect.left - contentInset;
    viewport.scrollTo({ left: Math.max(0, targetScrollLeft), behavior: 'smooth' });
  };

  return (
    <div
      className={`tabs ${className}`.trim()}
      ref={containerRef}
    >
      <div className="tabs__viewport" ref={scrollViewportRef}>
        <div className="tabs__inner" role="tablist" aria-label={ariaLabel}>
          {tabsList.map((t) => (
            <button
              key={t.id}
              data-tab={t.id}
              className="tabs__pill"
              role="tab"
              aria-selected={active === t.id}
              onClick={() => handleClick(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {scrollState.hasOverflow && scrollState.canScrollLeft ? (
        <button className="tabs__arrow tabs__arrow-left" type="button" onClick={() => scrollOneTab('previous')} aria-label="Scroll tabs left">
          <i className="fa-solid fa-chevron-left" aria-hidden="true" />
        </button>
      ) : null}
      {scrollState.hasOverflow ? (
        <button className="tabs__arrow tabs__arrow-right" type="button" onClick={() => scrollOneTab('next')} aria-label="Scroll tabs right" disabled={!scrollState.canScrollRight}>
          <i className="fa-solid fa-chevron-right" aria-hidden="true" />
        </button>
      ) : null}
      <div ref={indicatorRef} className="tabs__indicator" aria-hidden="true" />
    </div>
  );
}
