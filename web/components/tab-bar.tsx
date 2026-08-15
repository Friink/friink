"use client";

import React from "react";

type Tab = { id: string; label: string };

type TabBarProps = {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
  containerClass?: string;
  itemClass?: string;
  ariaLabel?: string;
};

export function TabBar({ tabs, activeId, onChange, containerClass = '', itemClass = '', ariaLabel }: TabBarProps) {
  return (
    <div className={containerClass} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          className={`${itemClass}${activeId === tab.id ? ' active' : ''}`}
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeId === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
