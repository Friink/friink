"use client";

import React from 'react';
import { AppShell } from '@/components/app-shell';

export default function DevShellPage() {
  const mockUser = {
    id: 'dev-user',
    name: 'Dev User',
    username: 'devuser',
    email: 'dev@example.com',
  };

  // Render AppShell for quick local layout previews only.
  return <AppShell user={mockUser} onLogout={() => {}} />;
}
