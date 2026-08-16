"use client";

import React, { useEffect, useRef, useState, useMemo } from 'react';

type Tab = { id: string; label: string };

type TabsProps = {
  tabs?: Tab[];
  activeId?: string;
  onChange?: (id: string) => void;
  ariaLabel?: string;
};

export function Tabs({ tabs, activeId, onChange, ariaLabel = 'Quick tabs' }: TabsProps) {
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

  return (
    <div className="tabs" ref={containerRef}>
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
      <div className="tabs__indicator" aria-hidden="true" style={{ left: `${indicator.left}px`, width: `${indicator.width}px` }} />
    </div>
  );
}
