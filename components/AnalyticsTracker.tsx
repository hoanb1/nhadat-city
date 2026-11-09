'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    const searchString = searchParams?.toString() || '';
    const currentUrl = `${pathname}${searchString ? '?' + searchString : ''}`;

    // Skip duplicate tracking for the same page view
    if (lastTracked.current === currentUrl) return;
    lastTracked.current = currentUrl;

    // Send pageview report
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pathname,
        search: searchString,
        referrer: typeof document !== 'undefined' ? document.referrer : '',
      }),
    }).catch((err) => {
      // Graceful error logging as per project rules
      console.error('[Analytics Tracker] Failed to send pageview:', err);
    });
  }, [pathname, searchParams]);

  return null;
}
