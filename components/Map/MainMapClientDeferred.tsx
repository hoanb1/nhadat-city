'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// Dynamically import the heavy map component
const MainMapClient = dynamic(() => import('./MainMapClient'), {
  ssr: false,
});

/**
 * A wrapper for the main map that defers its rendering until the main thread is idle.
 * This dramatically improves TBT (Total Blocking Time) during the initial page load,
 * as MapLibre GL JS parsing and initialization is pushed out of the critical rendering path.
 */
export default function MainMapClientDeferred() {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleInteraction = () => {
      setShouldRender(true);
      ['mousemove', 'scroll', 'touchstart', 'keydown'].forEach(evt => 
        window.removeEventListener(evt, handleInteraction)
      );
      if (timeoutId) clearTimeout(timeoutId);
    };

    if (typeof window !== 'undefined') {
      ['mousemove', 'scroll', 'touchstart', 'keydown'].forEach(evt => 
        window.addEventListener(evt, handleInteraction, { once: true, passive: true })
      );
      
      // Fallback: load after 8 seconds if no interaction occurs
      timeoutId = setTimeout(() => {
        handleInteraction();
      }, 8000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (typeof window !== 'undefined') {
        ['mousemove', 'scroll', 'touchstart', 'keydown'].forEach(evt => 
          window.removeEventListener(evt, handleInteraction)
        );
      }
    };
  }, []);

  if (!shouldRender) {
    return null; // Return nothing while waiting, the SSR preview will cover the screen
  }

  return <MainMapClient />;
}
