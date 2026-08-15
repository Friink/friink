"use client";

import React from 'react';

export type TabItem<T extends string> = { id: T; label: string };

type TabBarProps<T extends string> = {
  tabs: TabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
};

export function TabBar<T extends string>({ tabs, activeId, onChange, ariaLabel = 'Tabs' }: TabBarProps<T>) {
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
