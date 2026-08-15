"use client";
import { useState } from 'react';
import { SettingsScreen, type AppearanceMode } from '@/components/account-screens';
import type { AuthUser } from '@/lib/auth';

const mockUser: AuthUser = {
  id: 'dev-user-1',
  name: 'Dev User',
  email: 'dev@example.com',
  username: 'devuser',
  status: 'active',
  emailVerifiedAt: new Date().toISOString(),
};

export default function DevSettingsPage() {
  const [appearance, setAppearance] = useState<AppearanceMode>('system');

  return <SettingsScreen user={mockUser} appearance={appearance} onAppearanceChange={setAppearance} />;
}
