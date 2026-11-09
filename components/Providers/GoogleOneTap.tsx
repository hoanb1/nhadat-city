'use client';

import { useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (callback?: (notification: any) => void) => void;
          cancel: () => void;
        };
      };
    };
    __googleOneTapLoaded?: boolean;
  }
}

export default function GoogleOneTap() {
  const { data: session, status } = useSession();

  useEffect(() => {
    // Only for unauthenticated users, skip if loading
    if (status === 'loading' || session) return;
    if (!CLIENT_ID) return;

    let cancelled = false;

    const initOneTap = () => {
      if (cancelled) return;

      // Avoid loading script twice
      if (window.__googleOneTapLoaded) {
        startPrompt();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (cancelled) return;
        window.__googleOneTapLoaded = true;
        startPrompt();
      };
      document.head.appendChild(script);
    };

    const startPrompt = () => {
      if (!window.google || cancelled) return;

      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async (response: { credential: string }) => {
          // Send credential JWT directly to our NextAuth CredentialsProvider
          // This avoids OAuth redirect entirely — no redirect_uri needed
          await signIn('google-onetap', {
            credential: response.credential,
            redirect: false,
          });
        },
        auto_select: true,         // auto sign-in if only 1 account
        cancel_on_tap_outside: true,
        itp_support: true,         // ITP (Intelligent Tracking Prevention) support
        use_fedcm_for_prompt: true, // Use FedCM API when available (Chrome 116+)
      });

      window.google.accounts.id.prompt((notification) => {
        // If not displayed (e.g. user already dismissed 3 times), silently skip
        if (notification.isNotDisplayed?.()) {
          console.debug('[OneTap] not displayed:', notification.getNotDisplayedReason?.());
        }
      });
    };

    // Defer until CPU is idle — requestIdleCallback with 5s timeout
    // Fallback to setTimeout 3s for Safari which doesn't support requestIdleCallback
    let cleanup: () => void;

    if (typeof window !== 'undefined') {
      if ('requestIdleCallback' in window) {
        const id = (window as any).requestIdleCallback(initOneTap, { timeout: 5000 });
        cleanup = () => {
          cancelled = true;
          (window as any).cancelIdleCallback?.(id);
          window.google?.accounts.id.cancel?.();
        };
      } else {
        const t = setTimeout(initOneTap, 3000);
        cleanup = () => {
          cancelled = true;
          clearTimeout(t);
          window.google?.accounts.id.cancel?.();
        };
      }
    }

    return () => cleanup?.();
  }, [session, status]);

  return null;
}
