"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getSession, subscribeToSessionChanges } from '@/lib/session-manager';
import { identifyAnalyticsUser, resetAnalyticsUser, trackAnalyticsEvent } from '@/lib/analytics';

export function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    const session = getSession();
    if (session) identifyAnalyticsUser(session.user.id);

    return subscribeToSessionChanges((change) => {
      if (change.type === 'updated') {
        identifyAnalyticsUser(change.session.user.id);
      } else {
        resetAnalyticsUser();
      }
    });
  }, []);

  useEffect(() => {
    if (!pathname) return;
    trackAnalyticsEvent('Page Viewed', { path: pathname });
  }, [pathname]);

  return null;
}
