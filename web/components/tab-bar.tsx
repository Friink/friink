"use client";

import React from 'react';

export type TabItem = { id: string; label: string };

type TabBarProps = {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
};

export function TabBar({ tabs, activeId, onChange, ariaLabel = 'Tabs' }: TabBarProps) {
  return (
    <div className="settings-tabs" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeId === tab.id}
          className={activeId === tab.id ? 'settings-tab active' : 'settings-tab'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
