"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';

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
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const update = () => {
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

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [active, tabsList]);

  const handleClick = (id: string) => {
    if (typeof onChange === 'function') onChange(id);
    else setInternalActive(id);
  };

  const handleSwipeTab = (direction: 'next' | 'previous') => {
    if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) return;

    const activeIndex = tabsList.findIndex((tab) => tab.id === active);
    if (activeIndex === -1) return;

    const nextIndex = direction === 'next' ? activeIndex + 1 : activeIndex - 1;
    const nextTab = tabsList[nextIndex];
    if (!nextTab) return;

    handleClick(nextTab.id);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;

    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaY) > 40 || Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;

    handleSwipeTab(deltaX < 0 ? 'next' : 'previous');
  };

  return (
    <div
      className={`tabs ${className}`.trim()}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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
      <div ref={indicatorRef} className="tabs__indicator" aria-hidden="true" />
    </div>
  );
}
